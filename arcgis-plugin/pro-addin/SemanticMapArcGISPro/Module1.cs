using ArcGIS.Desktop.Framework;
using ArcGIS.Desktop.Framework.Contracts;
using SemanticMapArcGISPro.Services;

namespace SemanticMapArcGISPro;

internal class Module1 : Module
{
    private static Module1? _this;

    public static Module1 Current => _this ??= (Module1)FrameworkApplication.FindModule("SemanticMapArcGISPro_Module");

    public SettingsService Settings { get; } = new();

    public BackendClient BackendClient { get; } = new();

    public FeatureImportService FeatureImporter { get; } = new();

    protected override bool CanUnload()
    {
        return true;
    }
}
