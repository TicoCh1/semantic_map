using System.Text.Json;
using System.Text.Json.Serialization;

namespace SemanticMapArcGISPro.Models;

internal sealed class ScoringJobResponse
{
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = "";

    [JsonPropertyName("prompt_id")]
    public string PromptId { get; set; } = "";

    [JsonPropertyName("dataset_id")]
    public string DatasetId { get; set; } = "";

    [JsonPropertyName("dataset_group_id")]
    public string? DatasetGroupId { get; set; }

    [JsonPropertyName("prompt")]
    public string Prompt { get; set; } = "";

    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("progress")]
    public double Progress { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("current_stage")]
    public string? CurrentStage { get; set; }

    [JsonPropertyName("results")]
    public List<ScoringResultRef>? Results { get; set; }
}

internal sealed class ScoringResultRef
{
    [JsonPropertyName("dataset_id")]
    public string DatasetId { get; set; } = "";

    [JsonPropertyName("prompt_id")]
    public string PromptId { get; set; } = "";
}

internal sealed class ArcGisFeaturePage
{
    [JsonPropertyName("prompt_id")]
    public string PromptId { get; set; } = "";

    [JsonPropertyName("dataset_id")]
    public string DatasetId { get; set; } = "";

    [JsonPropertyName("dataset_group_id")]
    public string? DatasetGroupId { get; set; }

    [JsonPropertyName("prompt")]
    public string Prompt { get; set; } = "";

    [JsonPropertyName("prompts")]
    public List<ArcGisPromptRef> Prompts { get; set; } = new();

    [JsonPropertyName("fields")]
    public List<ArcGisFeatureField> Fields { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("features")]
    public List<ArcGisFeature> Features { get; set; } = new();

    [JsonPropertyName("offset")]
    public int Offset { get; set; }

    [JsonPropertyName("limit")]
    public int Limit { get; set; }

    [JsonPropertyName("count")]
    public int Count { get; set; }

    [JsonPropertyName("has_more")]
    public bool HasMore { get; set; }

    [JsonPropertyName("next_offset")]
    public int? NextOffset { get; set; }
}

internal sealed class ArcGisPromptRef
{
    [JsonPropertyName("index")]
    public int Index { get; set; }

    [JsonPropertyName("prompt")]
    public string Prompt { get; set; } = "";

    [JsonPropertyName("prompt_id")]
    public string PromptId { get; set; } = "";

    [JsonPropertyName("dataset_id")]
    public string DatasetId { get; set; } = "";
}

internal sealed class ArcGisFeatureField
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("alias")]
    public string? Alias { get; set; }

    [JsonPropertyName("length")]
    public int? Length { get; set; }
}

internal sealed class ArcGisFeature
{
    [JsonPropertyName("geometry")]
    public ArcGisGeometry Geometry { get; set; } = new();

    [JsonPropertyName("attributes")]
    public Dictionary<string, JsonElement> Attributes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

internal sealed class ArcGisGeometry
{
    [JsonPropertyName("x")]
    public double X { get; set; }

    [JsonPropertyName("y")]
    public double Y { get; set; }
}
