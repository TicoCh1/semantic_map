# UrbanFabric ArcGIS Plugin

This folder now treats the ArcGIS Pro Add-In as the primary prototype path.

The earlier Experience Builder widget remains under `experience-builder/` as reference code, but the active implementation is:

```text
arcgis-plugin/
  pro-addin/
    SemanticMapArcGISPro.sln
    SemanticMapArcGISPro/
```

## Current Decision

ArcGIS Pro can work with the same flat datapoint model used by the QGIS-style export path. The plugin therefore does not need a tiled z/x/y hierarchy for the first pass.

Prototype flow:

1. Open the `UrbanFabric` group on ArcGIS Pro's Add-In tab.
2. Open the `Semantic Search` dockpane.
3. Submit one or more text prompts to the UrbanFabric scoring backend; each non-empty line is submitted as one prompt job.
4. Let the backend queue batch those prompt jobs together when they share the same scored dataset set.
5. Poll each scoring job until it is ready.
6. Fetch feature pages only for the selected import city, currently London or Shanghai, to avoid pulling both cities into ArcGIS Pro at once.
7. Convert the result to a real point feature class in the project's default geodatabase with ArcGIS Pro's native `XYTableToPoint` tool.
8. Apply an ArcGIS Pro native graduated-color renderer using `zscore` or `score`.

Street-view preview is not implemented in this Pro prototype yet. Imported attributes include `pano_id`, `dataset_id`, `capture_date`, `score`, `zscore`, and `prompt`, so a later popup action can call existing pano/street-view endpoints.

## Build And Install

Use Visual Studio 2022 Community with the ArcGIS Pro SDK for .NET installed.

```powershell
cd arcgis-plugin\pro-addin
& "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" `
  .\SemanticMapArcGISPro.sln /restore /p:Configuration=Debug
```

The ArcGIS Pro SDK target imported from the local ArcGIS Pro install is responsible for producing the `.esriAddInX` package during build. Use Visual Studio Build or Visual Studio's `MSBuild.exe`; `dotnet build` compiles the DLL but does not support Esri's .NET Framework MSBuild packaging task.
