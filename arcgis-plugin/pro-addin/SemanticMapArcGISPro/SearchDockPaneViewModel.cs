using System.Collections.ObjectModel;
using System.Threading;
using ArcGIS.Desktop.Framework;
using ArcGIS.Desktop.Framework.Contracts;
using ArcGIS.Desktop.Framework.Dialogs;
using SemanticMapArcGISPro.Models;
using SemanticMapArcGISPro.Services;

namespace SemanticMapArcGISPro;

internal class SearchDockPaneViewModel : DockPane
{
    private const string DockPaneId = "SemanticMapArcGISPro_SearchDockPane";

    private readonly DelegateCommand _searchCommand;
    private readonly DelegateCommand _cancelCommand;
    private CancellationTokenSource? _activeImport;

    private string _backendUrl = "";
    private string _token = "";
    private string _datasetGroupId = "";
    private string _datasetIdsText = "";
    private string _importCity = "London";
    private string _prompt = "";
    private string _scoreField = "zscore";
    private double _rangeMin = -1;
    private double _rangeMax = 3;
    private int _pageSize = 50000;
    private int _maxFeatures = 500000;
    private string _status = "Ready.";
    private bool _isImporting;

    protected SearchDockPaneViewModel()
    {
        var settings = Module1.Current.Settings.Load();
        _backendUrl = settings.BackendUrl;
        _token = settings.Token;
        _datasetGroupId = settings.DatasetGroupId;
        _datasetIdsText = settings.DatasetIdsText;
        _importCity = settings.ImportCity;
        _scoreField = settings.ScoreField;
        _rangeMin = settings.RangeMin;
        _rangeMax = settings.RangeMax;
        _pageSize = settings.PageSize;
        _maxFeatures = settings.MaxFeatures;

        _searchCommand = new DelegateCommand(_ => StartImport(), _ => !IsImporting && !string.IsNullOrWhiteSpace(Prompt));
        _cancelCommand = new DelegateCommand(_ => CancelImport(), _ => IsImporting);
    }

    public static void Show()
    {
        try
        {
            var pane = FrameworkApplication.DockPaneManager.Find(DockPaneId);
            if (pane == null)
            {
                MessageBox.Show($"Could not find dockpane '{DockPaneId}'. Rebuild and reinstall the add-in.", "UrbanFabric Semantic Search");
                return;
            }

            pane.Activate();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.ToString(), "UrbanFabric Semantic Search");
        }
    }

    public string Heading
    {
        get => "UrbanFabric Search";
    }

    public ReadOnlyCollection<string> ScoreFields { get; } = new(new[] { "zscore", "score" });

    public ReadOnlyCollection<string> ImportCities { get; } = new(new[] { "London", "Shanghai" });

    public DelegateCommand SearchCommand => _searchCommand;

    public DelegateCommand CancelCommand => _cancelCommand;

    public string BackendUrl
    {
        get => _backendUrl;
        set => SetProperty(ref _backendUrl, value, () => BackendUrl);
    }

    public string Token
    {
        get => _token;
        set => SetProperty(ref _token, value, () => Token);
    }

    public string DatasetGroupId
    {
        get => _datasetGroupId;
        set => SetProperty(ref _datasetGroupId, value, () => DatasetGroupId);
    }

    public string DatasetIdsText
    {
        get => _datasetIdsText;
        set => SetProperty(ref _datasetIdsText, value, () => DatasetIdsText);
    }

    public string ImportCity
    {
        get => _importCity;
        set => SetProperty(ref _importCity, value, () => ImportCity);
    }

    public string Prompt
    {
        get => _prompt;
        set
        {
            if (SetProperty(ref _prompt, value, () => Prompt))
            {
                _searchCommand.RaiseCanExecuteChanged();
            }
        }
    }

    public string ScoreField
    {
        get => _scoreField;
        set => SetProperty(ref _scoreField, value, () => ScoreField);
    }

    public double RangeMin
    {
        get => _rangeMin;
        set => SetProperty(ref _rangeMin, value, () => RangeMin);
    }

    public double RangeMax
    {
        get => _rangeMax;
        set => SetProperty(ref _rangeMax, value, () => RangeMax);
    }

    public int PageSize
    {
        get => _pageSize;
        set => SetProperty(ref _pageSize, value, () => PageSize);
    }

    public int MaxFeatures
    {
        get => _maxFeatures;
        set => SetProperty(ref _maxFeatures, value, () => MaxFeatures);
    }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value, () => Status);
    }

    public bool IsImporting
    {
        get => _isImporting;
        private set
        {
            if (SetProperty(ref _isImporting, value, () => IsImporting))
            {
                _searchCommand.RaiseCanExecuteChanged();
                _cancelCommand.RaiseCanExecuteChanged();
            }
        }
    }

    private void StartImport()
    {
        _ = ImportAsync();
    }

    private void CancelImport()
    {
        _activeImport?.Cancel();
    }

    private async Task ImportAsync()
    {
        if (IsImporting)
        {
            return;
        }

        IsImporting = true;
        _activeImport = new CancellationTokenSource();

        try
        {
            var prompts = PromptLines();
            if (prompts.Count == 0)
            {
                Status = "Enter at least one prompt.";
                return;
            }

            var config = BuildConfig();
            Module1.Current.Settings.Save(config);

            var request = new ImportRequest(config, prompts);
            var progress = new Progress<string>(message => Status = message);

            var summary = await Module1.Current.FeatureImporter.ImportAsync(request, progress, _activeImport.Token);
            Status = $"Imported {summary.PromptCount:n0} prompt(s), {summary.FeatureCount:n0} points across {summary.LayerCount:n0} layer(s).";
        }
        catch (OperationCanceledException)
        {
            Status = "Cancelled.";
        }
        catch (Exception ex)
        {
            Status = "Import failed.";
            MessageBox.Show(ex.Message, "UrbanFabric Semantic Search");
        }
        finally
        {
            _activeImport.Dispose();
            _activeImport = null;
            IsImporting = false;
        }
    }

    private BackendConfig BuildConfig()
    {
        return new BackendConfig
        {
            BackendUrl = BackendUrl,
            Token = Token,
            DatasetGroupId = DatasetGroupId,
            DatasetIdsText = DatasetIdsText,
            ImportCity = ImportCity,
            ScoreField = ScoreField,
            RangeMin = RangeMin,
            RangeMax = RangeMax,
            PageSize = Math.Max(1000, Math.Min(PageSize, 200000)),
            MaxFeatures = Math.Max(1000, Math.Min(MaxFeatures, 2000000))
        };
    }

    private IReadOnlyList<string> PromptLines()
    {
        return Prompt
            .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToArray();
    }
}
