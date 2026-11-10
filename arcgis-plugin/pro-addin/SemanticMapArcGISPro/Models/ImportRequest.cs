namespace SemanticMapArcGISPro.Models;

internal sealed record ImportRequest(BackendConfig Config, IReadOnlyList<string> Prompts);

internal sealed record ImportSummary(int PromptCount, int LayerCount, int FeatureCount);
