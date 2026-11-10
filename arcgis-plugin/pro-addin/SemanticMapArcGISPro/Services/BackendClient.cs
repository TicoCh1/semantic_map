using System.Net.Http.Headers;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using SemanticMapArcGISPro.Models;

namespace SemanticMapArcGISPro.Services;

internal sealed class BackendClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(30)
    };

    public async Task<IReadOnlyList<ScoringJobResponse>> SubmitPromptBatchAsync(
        BackendConfig config,
        IReadOnlyList<string> prompts,
        CancellationToken cancellationToken)
    {
        if (prompts.Count == 0)
        {
            throw new InvalidOperationException("At least one prompt is required.");
        }

        var tasks = prompts.Select(prompt => SubmitPromptAsync(config, prompt, cancellationToken)).ToArray();
        return await Task.WhenAll(tasks);
    }

    public async Task<ScoringJobResponse> SubmitPromptAsync(BackendConfig config, string prompt, CancellationToken cancellationToken)
    {
        var datasetIds = config.DatasetIds();
        if (datasetIds.Count == 0)
        {
            throw new InvalidOperationException("At least one dataset ID is required.");
        }

        var body = datasetIds.Count > 1
            ? new Dictionary<string, object?>
            {
                ["dataset_group_id"] = config.DatasetGroupId,
                ["dataset_ids"] = datasetIds,
                ["prompt"] = prompt,
                ["query_type"] = "text"
            }
            : new Dictionary<string, object?>
            {
                ["dataset_id"] = datasetIds[0],
                ["prompt"] = prompt,
                ["query_type"] = "text"
            };

        using var request = NewJsonRequest(config, HttpMethod.Post, "/api/scoring/jobs", body);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        return await CheckedJsonAsync<ScoringJobResponse>(response, "Prompt submission failed", cancellationToken);
    }

    public async Task<ScoringJobResponse> PollJobAsync(
        BackendConfig config,
        string jobId,
        IProgress<string>? progress,
        CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 720; attempt++)
        {
            using var request = NewRequest(config, HttpMethod.Get, $"/api/scoring/jobs/{Uri.EscapeDataString(jobId)}");
            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var job = await CheckedJsonAsync<ScoringJobResponse>(response, "Job polling failed", cancellationToken);

            progress?.Report(job.Message ?? job.CurrentStage ?? job.Status);

            if (string.Equals(job.Status, "ready", StringComparison.OrdinalIgnoreCase))
            {
                return job;
            }

            if (string.Equals(job.Status, "failed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(job.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(job.Message ?? $"Scoring job {job.Status}.");
            }

            await Task.Delay(TimeSpan.FromMilliseconds(1500), cancellationToken);
        }

        throw new TimeoutException("Scoring job polling timed out.");
    }

    public async Task<ArcGisFeaturePage> FetchFeaturePageAsync(
        BackendConfig config,
        ScoringResultRef result,
        int offset,
        int limit,
        CancellationToken cancellationToken)
    {
        var path = new StringBuilder($"/api/scoring/results/{Uri.EscapeDataString(result.PromptId)}/features/page");
        path.Append($"?dataset_id={Uri.EscapeDataString(result.DatasetId)}");
        path.Append($"&field={Uri.EscapeDataString(config.ScoreField)}");
        path.Append($"&limit={limit}");
        path.Append($"&offset={offset}");

        using var request = NewRequest(config, HttpMethod.Get, path.ToString());
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        return await CheckedJsonAsync<ArcGisFeaturePage>(response, "Feature export failed", cancellationToken);
    }

    public async Task<ArcGisFeaturePage> FetchMergedFeaturePageAsync(
        BackendConfig config,
        IReadOnlyList<string> prompts,
        int offset,
        int limit,
        CancellationToken cancellationToken)
    {
        if (prompts.Count == 0)
        {
            throw new InvalidOperationException("At least one prompt is required.");
        }

        var datasetIds = config.DatasetIds();
        if (datasetIds.Count == 0)
        {
            throw new InvalidOperationException("At least one dataset ID is required.");
        }

        var body = new Dictionary<string, object?>
        {
            ["dataset_id"] = config.ImportDatasetId(),
            ["dataset_group_id"] = config.DatasetGroupId,
            ["dataset_ids"] = datasetIds,
            ["prompts"] = prompts,
            ["limit"] = limit,
            ["offset"] = offset
        };

        using var request = NewJsonRequest(config, HttpMethod.Post, "/api/scoring/arcgis/merged-features/page", body);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        return await CheckedJsonAsync<ArcGisFeaturePage>(response, "Merged feature export failed", cancellationToken);
    }

    public static IReadOnlyList<ScoringResultRef> ResultRefs(ScoringJobResponse job)
    {
        if (job.Results is { Count: > 0 })
        {
            return job.Results;
        }

        return new[]
        {
            new ScoringResultRef
            {
                DatasetId = job.DatasetId,
                PromptId = job.PromptId
            }
        };
    }

    private static HttpRequestMessage NewJsonRequest(BackendConfig config, HttpMethod method, string path, object body)
    {
        var request = NewRequest(config, method, path);
        request.Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
        return request;
    }

    private static HttpRequestMessage NewRequest(BackendConfig config, HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, ResolveUrl(config.BackendUrl, path));

        if (!string.IsNullOrWhiteSpace(config.Token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.Token.Trim());
        }

        return request;
    }

    private static string ResolveUrl(string backendUrl, string path)
    {
        var normalizedBackend = (backendUrl ?? "").Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(normalizedBackend))
        {
            throw new InvalidOperationException("Backend URL is required.");
        }

        return $"{normalizedBackend}/{path.TrimStart('/')}";
    }

    private static async Task<T> CheckedJsonAsync<T>(HttpResponseMessage response, string message, CancellationToken cancellationToken)
    {
        var json = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var detail = TryReadErrorDetail(json);
            throw new InvalidOperationException($"{message} ({(int)response.StatusCode}){detail}");
        }

        return JsonSerializer.Deserialize<T>(json, JsonOptions)
               ?? throw new InvalidOperationException($"{message}: empty response.");
    }

    private static string TryReadErrorDetail(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return "";
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.TryGetProperty("detail", out var detail))
            {
                return $": {detail}";
            }

            if (document.RootElement.TryGetProperty("message", out var message))
            {
                return $": {message}";
            }
        }
        catch (JsonException)
        {
            return $": {json}";
        }

        return $": {json}";
    }
}
