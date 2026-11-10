using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using ArcGIS.Core.CIM;
using ArcGIS.Core.Geometry;
using ArcGIS.Desktop.Core;
using ArcGIS.Desktop.Core.Geoprocessing;
using ArcGIS.Desktop.Framework.Threading.Tasks;
using ArcGIS.Desktop.Mapping;
using SemanticMapArcGISPro.Models;

namespace SemanticMapArcGISPro.Services;

internal sealed class FeatureImportService
{
    public async Task<ImportSummary> ImportAsync(
        ImportRequest request,
        IProgress<string>? progress,
        CancellationToken cancellationToken)
    {
        if (MapView.Active?.Map == null)
        {
            throw new InvalidOperationException("Open or activate a map before importing UrbanFabric datapoints.");
        }

        if (Project.Current == null || string.IsNullOrWhiteSpace(Project.Current.DefaultGeodatabasePath))
        {
            throw new InvalidOperationException("Open an ArcGIS Pro project with a default geodatabase before importing.");
        }

        var prompts = request.Prompts.Where(prompt => !string.IsNullOrWhiteSpace(prompt)).ToArray();
        if (prompts.Length == 0)
        {
            throw new InvalidOperationException("Enter at least one prompt.");
        }

        var importDatasetId = request.Config.ImportDatasetId();
        progress?.Report($"Requesting merged backend export for {prompts.Length:n0} prompt(s), city: {DatasetLabel(importDatasetId)}...");

        var export = await WriteMergedCsvAsync(request.Config, prompts, importDatasetId, progress, cancellationToken);
        if (export.FeatureCount == 0)
        {
            progress?.Report("Merged export returned no points.");
            return new ImportSummary(prompts.Length, 0, 0);
        }

        var rendererField = RendererFieldName(request.Config.ScoreField, 1);
        var layerName = BuildLayerName(importDatasetId, request.Config.ScoreField, prompts.Length);
        var outputFeatureClass = Path.Combine(Project.Current.DefaultGeodatabasePath, layerName);

        progress?.Report($"Creating ArcGIS layer {layerName} with {export.FeatureCount:n0} shared points...");
        await CreatePointLayerAsync(export.CsvPath, outputFeatureClass, cancellationToken);

        progress?.Report("Writing prompt field aliases...");
        await ApplyPromptAliasesAsync(outputFeatureClass, export.Prompts, cancellationToken);

        progress?.Report($"Styling {layerName} by {rendererField}...");
        await ApplyRendererAsync(layerName, rendererField);

        progress?.Report($"Added one {DatasetLabel(importDatasetId)} layer with {export.FeatureCount:n0} points and {export.PromptCount:n0} prompt score set(s).");
        return new ImportSummary(prompts.Length, 1, export.FeatureCount);
    }

    private static async Task<CsvExportResult> WriteMergedCsvAsync(
        BackendConfig config,
        IReadOnlyList<string> prompts,
        string importDatasetId,
        IProgress<string>? progress,
        CancellationToken cancellationToken)
    {
        var cacheDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "UrbanFabric",
            "ArcGISPro",
            "feature-cache");
        Directory.CreateDirectory(cacheDirectory);

        var timestamp = DateTimeOffset.Now.ToString("yyyyMMdd_HHmmss_fff", CultureInfo.InvariantCulture);
        var csvPath = Path.Combine(cacheDirectory, $"{SafeFileName(importDatasetId)}_merged_{timestamp}.csv");

        await using var stream = File.Create(csvPath);
        await using var writer = new StreamWriter(stream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));

        IReadOnlyList<string>? columns = null;
        var offset = 0;
        var featureCount = 0;
        var promptCount = prompts.Count;
        IReadOnlyList<ArcGisPromptRef> promptRefs = Array.Empty<ArcGisPromptRef>();

        while (featureCount < config.MaxFeatures)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var limit = Math.Min(config.PageSize, config.MaxFeatures - featureCount);
            var page = await Module1.Current.BackendClient.FetchMergedFeaturePageAsync(config, prompts, offset, limit, cancellationToken);
            promptCount = page.Prompts.Count > 0 ? page.Prompts.Count : promptCount;
            if (page.Prompts.Count > 0)
            {
                promptRefs = page.Prompts;
            }

            if (columns == null)
            {
                columns = CsvColumns(page, promptCount);
                await writer.WriteLineAsync(string.Join(",", columns.Select(CsvEscape)));
            }

            await WriteFeatureRowsAsync(writer, page.Features, columns, promptRefs, cancellationToken);
            featureCount += page.Features.Count;

            progress?.Report($"Fetched {featureCount:n0} of {page.Total:n0} shared {DatasetLabel(importDatasetId)} points.");

            if (!page.HasMore || page.NextOffset == null || page.Count == 0)
            {
                break;
            }

            offset = page.NextOffset.Value;
        }

        return new CsvExportResult(csvPath, featureCount, promptRefs);
    }

    private static IReadOnlyList<string> CsvColumns(ArcGisFeaturePage page, int promptCount)
    {
        var columns = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddColumn(string name)
        {
            if (string.IsNullOrWhiteSpace(name) || name.Equals("objectid", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (seen.Add(name))
            {
                columns.Add(name);
            }
        }

        foreach (var baseColumn in new[] { "lon", "lat", "pano_id", "dataset_id", "city_id", "capture_date" })
        {
            AddColumn(baseColumn);
        }

        for (var index = 1; index <= promptCount; index++)
        {
            AddColumn(PromptColumnName("prompt", index));
            AddColumn(PromptColumnName("prompt_id", index));
            AddColumn(RendererFieldName("score", index));
            AddColumn(RendererFieldName("zscore", index));
        }

        foreach (var field in page.Fields)
        {
            AddColumn(field.Name);
        }

        return columns;
    }

    private static async Task WriteFeatureRowsAsync(
        StreamWriter writer,
        IReadOnlyList<ArcGisFeature> features,
        IReadOnlyList<string> columns,
        IReadOnlyList<ArcGisPromptRef> prompts,
        CancellationToken cancellationToken)
    {
        foreach (var feature in features)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var values = columns.Select(column => CsvValue(feature, column, prompts));
            await writer.WriteLineAsync(string.Join(",", values.Select(CsvEscape)));
        }
    }

    private static async Task CreatePointLayerAsync(string csvPath, string outputFeatureClass, CancellationToken cancellationToken)
    {
        var values = Geoprocessing.MakeValueArray(
            csvPath,
            outputFeatureClass,
            "lon",
            "lat",
            null,
            SpatialReferences.WGS84);

        var result = await Geoprocessing.ExecuteToolAsync(
            "management.XYTableToPoint",
            values,
            null,
            cancellationToken,
            null,
            GPExecuteToolFlags.AddOutputsToMap | GPExecuteToolFlags.AddToHistory | GPExecuteToolFlags.RefreshProjectItems);

        if (result.IsFailed)
        {
            var message = string.Join(Environment.NewLine, result.ErrorMessages.Select(item => item.ToString()));
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(message) ? "XYTableToPoint failed." : message);
        }
    }

    private static async Task ApplyPromptAliasesAsync(
        string outputFeatureClass,
        IReadOnlyList<ArcGisPromptRef> prompts,
        CancellationToken cancellationToken)
    {
        foreach (var prompt in prompts)
        {
            cancellationToken.ThrowIfCancellationRequested();

            await AlterFieldAliasAsync(outputFeatureClass, PromptColumnName("prompt", prompt.Index), $"Prompt {prompt.Index:00}", cancellationToken);
            await AlterFieldAliasAsync(outputFeatureClass, PromptColumnName("prompt_id", prompt.Index), $"Prompt ID {prompt.Index:00}", cancellationToken);
            await AlterFieldAliasAsync(outputFeatureClass, RendererFieldName("score", prompt.Index), $"Score {prompt.Index:00}: {prompt.Prompt}", cancellationToken);
            await AlterFieldAliasAsync(outputFeatureClass, RendererFieldName("zscore", prompt.Index), $"Z-score {prompt.Index:00}: {prompt.Prompt}", cancellationToken);
        }
    }

    private static async Task AlterFieldAliasAsync(
        string table,
        string fieldName,
        string alias,
        CancellationToken cancellationToken)
    {
        var values = Geoprocessing.MakeValueArray(table, fieldName, "", ArcGisAlias(alias));
        var result = await Geoprocessing.ExecuteToolAsync(
            "management.AlterField",
            values,
            null,
            cancellationToken,
            null,
            GPExecuteToolFlags.None);

        if (result.IsFailed)
        {
            var message = string.Join(Environment.NewLine, result.ErrorMessages.Select(item => item.ToString()));
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(message) ? $"AlterField failed for {fieldName}." : message);
        }
    }

    private static Task ApplyRendererAsync(string layerName, string rendererField)
    {
        return QueuedTask.Run(() =>
        {
            var layer = MapView.Active?.Map.FindLayers(layerName, true).OfType<FeatureLayer>().FirstOrDefault();
            if (layer == null)
            {
                return;
            }

            var fromColor = ColorFactory.Instance.CreateRGBColor(44, 123, 182, 100);
            var toColor = ColorFactory.Instance.CreateRGBColor(215, 25, 28, 100);
            var ramp = new CIMLinearContinuousColorRamp
            {
                FromColor = fromColor,
                ToColor = toColor
            };

            var symbol = SymbolFactory.Instance
                .ConstructPointSymbol(ColorFactory.Instance.GreyRGB, 5.0, SimpleMarkerStyle.Circle)
                .MakeSymbolReference();

            var rendererDefinition = new GraduatedColorsRendererDefinition(
                rendererField,
                ClassificationMethod.NaturalBreaks,
                7,
                ramp,
                symbol);

            if (layer.CanCreateRenderer(rendererDefinition))
            {
                var renderer = layer.CreateRenderer(rendererDefinition);
                if (layer.CanSetRenderer(renderer))
                {
                    layer.SetRenderer(renderer);
                }
            }
        });
    }

    private static string CsvValue(ArcGisFeature feature, string name, IReadOnlyList<ArcGisPromptRef> prompts)
    {
        if (name.Equals("lon", StringComparison.OrdinalIgnoreCase))
        {
            return feature.Geometry.X.ToString("G17", CultureInfo.InvariantCulture);
        }

        if (name.Equals("lat", StringComparison.OrdinalIgnoreCase))
        {
            return feature.Geometry.Y.ToString("G17", CultureInfo.InvariantCulture);
        }

        var promptValue = PromptMetadataValue(name, prompts);
        if (promptValue != null)
        {
            return promptValue;
        }

        return AttributeText(feature, name);
    }

    private static string? PromptMetadataValue(string name, IReadOnlyList<ArcGisPromptRef> prompts)
    {
        foreach (var prompt in prompts)
        {
            if (name.Equals(PromptColumnName("prompt", prompt.Index), StringComparison.OrdinalIgnoreCase))
            {
                return prompt.Prompt;
            }

            if (name.Equals(PromptColumnName("prompt_id", prompt.Index), StringComparison.OrdinalIgnoreCase))
            {
                return prompt.PromptId;
            }
        }

        return null;
    }

    private static string AttributeText(ArcGisFeature feature, string name)
    {
        if (!feature.Attributes.TryGetValue(name, out var element))
        {
            return "";
        }

        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? "",
            JsonValueKind.Number => element.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => ""
        };
    }

    private static string CsvEscape(string value)
    {
        value ??= "";
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    private static string BuildLayerName(string datasetId, string scoreField, int promptCount)
    {
        var timestamp = DateTimeOffset.Now.ToString("yyyyMMdd_HHmmss_fff", CultureInfo.InvariantCulture);
        return Shorten(SafeFileName($"uf_{DatasetLabel(datasetId).ToLowerInvariant()}_batch_{promptCount}_{scoreField}_{timestamp}"), 120);
    }

    private static string RendererFieldName(string scoreFamily, int promptIndex)
    {
        return $"{scoreFamily}_{promptIndex:00}";
    }

    private static string PromptColumnName(string prefix, int promptIndex)
    {
        return $"{prefix}_{promptIndex:00}";
    }

    private static string ArcGisAlias(string value)
    {
        value = string.Join(" ", (value ?? "").Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries));
        return value.Length <= 250 ? value : value[..250];
    }

    private static string SafeFileName(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var character in value)
        {
            builder.Append(char.IsLetterOrDigit(character) || character == '_' ? character : '_');
        }

        var name = builder.ToString().Trim('_');
        return string.IsNullOrWhiteSpace(name) ? "urbanfabric" : name;
    }

    private static string Shorten(string value, int maxLength)
    {
        return value.Length <= maxLength ? value : value[..maxLength].Trim('_');
    }

    private static string DatasetLabel(string datasetId)
    {
        if (datasetId.Contains("shanghai", StringComparison.OrdinalIgnoreCase))
        {
            return "Shanghai";
        }

        if (datasetId.Contains("london", StringComparison.OrdinalIgnoreCase))
        {
            return "London";
        }

        return datasetId;
    }

    private sealed record CsvExportResult(string CsvPath, int FeatureCount, IReadOnlyList<ArcGisPromptRef> Prompts)
    {
        public int PromptCount => Prompts.Count;
    }
}
