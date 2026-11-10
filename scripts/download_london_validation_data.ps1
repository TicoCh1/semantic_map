param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\data\external_validation\london')
)

$ErrorActionPreference = 'Stop'

$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Get-Download {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if ((Test-Path -LiteralPath $Destination) -and ((Get-Item -LiteralPath $Destination).Length -gt 0)) {
        Write-Host "Already present: $Destination"
        return
    }

    $partial = "$Destination.part"
    Write-Host "Downloading: $([System.IO.Path]::GetFileName($Destination))"
    & curl.exe --location --fail --retry 4 --continue-at - --output $partial $Url
    if ($LASTEXITCODE -ne 0) {
        throw "Download failed: $Url"
    }
    Move-Item -LiteralPath $partial -Destination $Destination -Force
}

function Save-NhleLayer {
    param(
        [Parameter(Mandatory = $true)][int]$Layer,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if ((Test-Path -LiteralPath $Destination) -and ((Get-Item -LiteralPath $Destination).Length -gt 0)) {
        Write-Host "Already present: $Destination"
        return
    }

    # Conservative BNG envelope containing Greater London. It is intentionally kept
    # as a bounding-box extract so that no heritage record touching the edge is lost.
    $service = 'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer'
    $bbox = '503000,155000,561000,201000'
    $offset = 0
    $first = $true
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    $writer = [System.IO.StreamWriter]::new($Destination, $false, $utf8)

    try {
        $writer.Write('{"type":"FeatureCollection","features":[')
        do {
            $url = "$service/$Layer/query?where=1%3D1&geometry=$bbox&geometryType=esriGeometryEnvelope&inSR=27700&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=27700&resultOffset=$offset&resultRecordCount=2000&f=geojson"
            $page = Invoke-RestMethod -Uri $url
            $features = @($page.features)
            foreach ($feature in $features) {
                if (-not $first) {
                    $writer.Write(',')
                }
                $writer.Write(($feature | ConvertTo-Json -Depth 20 -Compress))
                $first = $false
            }
            $offset += $features.Count
            Write-Host "NHLE layer ${Layer}: $offset features"
        } while ($features.Count -eq 2000)
        $writer.Write(']}')
    }
    finally {
        $writer.Dispose()
    }
}

$downloads = @(
    @{
        Url = 'https://data.london.gov.uk/download/2k55d/60d8d648-ed64-4f2d-97e0-02d59d2a9b35/LBSMv2_London.zip'
        Name = 'lbsm2_all_london_2024.zip'
    },
    @{
        Url = 'https://data.london.gov.uk/download/2k55d/826853d0-0c2e-4550-b297-feafdd7e2afc/LBSMv2%20-%20Data%20Dictionary.xlsx'
        Name = 'lbsm2_data_dictionary.xlsx'
    },
    @{
        Url = 'https://download.openstreetmap.fr/extracts/europe/united_kingdom/england/greater_london-latest.osm.pbf'
        Name = 'greater_london-latest.osm.pbf'
    },
    @{
        Url = 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-surface-model-last-return-dsm-1m/wcs?service=WCS&version=2.0.1&request=GetCoverage&coverageId=9ba4d5ac-d596-445a-9056-dae3ddec0178__Lidar_Composite_Elevation_LZ_DSM_1m&format=image/tiff&subset=E(503000,561000)&subset=N(155000,201000)&scaleFactor=0.1'
        Name = 'ea_lidar_composite_dsm_10m_london_bbox.tif'
    },
    @{
        Url = 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs?service=WCS&version=2.0.1&request=GetCoverage&coverageId=13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m&format=image/tiff&subset=E(503000,561000)&subset=N(155000,201000)&scaleFactor=0.1'
        Name = 'ea_lidar_composite_dtm_10m_london_bbox.tif'
    }
)

foreach ($download in $downloads) {
    Get-Download -Url $download.Url -Destination (Join-Path $OutputDirectory $download.Name)
}

Save-NhleLayer -Layer 0 -Destination (Join-Path $OutputDirectory 'nhle_listed_buildings_points_london_bbox.geojson')
Save-NhleLayer -Layer 3 -Destination (Join-Path $OutputDirectory 'nhle_listed_buildings_polygons_london_bbox.geojson')

$manifest = [ordered]@{
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    spatial_extent = 'British National Grid bbox: 503000,155000,561000,201000 (a conservative envelope around Greater London)'
    datasets = [ordered]@{
        lbsm2 = 'GLA London Building Stock Model 2, all London data (October 2024 source version)'
        nhle = 'Historic England NHLE listed-building layers, queried from the daily-updated FeatureServer'
        lidar = 'Environment Agency composite DSM and DTM requested through WCS with scaleFactor=0.1 (~10 m output)'
        osm = 'OpenStreetMap France Greater London PBF extract'
    }
    excluded = [ordered]@{
        gla_walkpotential = 'Excluded: not a measure of observed pedestrian density'
        foursquare_os_places = 'Excluded: dataset requires acceptance of gated access terms before download'
    }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'README_sources.json') -Encoding utf8
Write-Host "Completed: $OutputDirectory"
