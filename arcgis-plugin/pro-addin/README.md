# UrbanFabric ArcGIS Pro Add-In

This is the ArcGIS Pro-first prototype for UrbanFabric prompt search.

The add-in adds an `UrbanFabric` group to the ArcGIS Pro Add-In tab. The `Semantic Search` button opens a dockpane that:

1. treats each non-empty prompt line as one prompt job,
2. quickly submits those jobs with the configured scored dataset IDs, so the backend's prompt queue can batch them,
3. polls every scoring job until it is ready,
4. fetches feature pages only for the selected import city, currently London or Shanghai,
5. writes a local CSV cache per prompt/city result,
6. runs ArcGIS Pro's native `XYTableToPoint` geoprocessing tool into the project's default geodatabase,
7. applies a native graduated-color renderer on `zscore` or `score`.

`Scored dataset IDs` defaults to London plus Shanghai for backend scoring efficiency. `Import city` controls which single city is actually fetched and added to ArcGIS Pro.

The runtime cache is written outside the repository under:

```text
%LOCALAPPDATA%\UrbanFabric\ArcGISPro\
```

## Build

Open `SemanticMapArcGISPro.sln` in Visual Studio 2022 Community with the ArcGIS Pro SDK for .NET installed, then build the project. The SDK target imported from the local ArcGIS Pro install produces the `.esriAddInX` package during a normal build.

CLI build from this folder should use Visual Studio's MSBuild:

```powershell
& "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" `
  .\SemanticMapArcGISPro.sln /restore /p:Configuration=Debug
```

`dotnet build` reaches C# compilation but cannot run Esri's `.esriAddInX` packaging target because that target uses a .NET Framework MSBuild task.

## Install/Test

For manual testing, build in Visual Studio and either:

- press `Start` using the `ArcGIS Pro` launch profile, or
- double-click the generated `.esriAddInX` from the build output and restart ArcGIS Pro if needed.

Open an ArcGIS Pro project with an active map before running a prompt import.
