namespace SemanticMapArcGISPro.Models;

internal sealed class BackendConfig
{
    public string BackendUrl { get; set; } = "http://localhost:8000";

    public string Token { get; set; } = "";

    public string DatasetGroupId { get; set; } = "london_shanghai";

    public string DatasetIdsText { get; set; } = "london_224_8_45, shanghai_224_8_45_2B";

    public string ImportCity { get; set; } = "London";

    public string ScoreField { get; set; } = "zscore";

    public double RangeMin { get; set; } = -1;

    public double RangeMax { get; set; } = 3;

    public int PageSize { get; set; } = 50000;

    public int MaxFeatures { get; set; } = 500000;

    public IReadOnlyList<string> DatasetIds()
    {
        return DatasetIdsText
            .Split(new[] { ',', ';', '\r', '\n', '\t', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    public string ImportDatasetId()
    {
        if (ImportCity.Equals("Shanghai", StringComparison.OrdinalIgnoreCase))
        {
            return "shanghai_224_8_45_2B";
        }

        return "london_224_8_45";
    }
}
