using System.IO;
using System.Text.Json;
using SemanticMapArcGISPro.Models;

namespace SemanticMapArcGISPro.Services;

internal sealed class SettingsService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private readonly string _settingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "UrbanFabric",
        "ArcGISPro",
        "settings.json");

    public BackendConfig Load()
    {
        try
        {
            if (!File.Exists(_settingsPath))
            {
                return new BackendConfig();
            }

            var json = File.ReadAllText(_settingsPath);
            return JsonSerializer.Deserialize<BackendConfig>(json, JsonOptions) ?? new BackendConfig();
        }
        catch
        {
            return new BackendConfig();
        }
    }

    public void Save(BackendConfig config)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_settingsPath)!);
        File.WriteAllText(_settingsPath, JsonSerializer.Serialize(config, JsonOptions));
    }
}
