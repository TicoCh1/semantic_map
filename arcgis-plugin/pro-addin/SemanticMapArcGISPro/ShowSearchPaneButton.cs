using ArcGIS.Desktop.Framework.Contracts;

namespace SemanticMapArcGISPro;

internal class ShowSearchPaneButton : Button
{
    protected override void OnClick()
    {
        SearchDockPaneViewModel.Show();
    }
}
