from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _parse_int_list(value: str) -> tuple[int, ...]:
    items = []
    for raw in value.split(","):
        raw = raw.strip()
        if not raw:
            continue
        items.append(int(raw))
    return tuple(items)


def _parse_str_list(value: str) -> tuple[str, ...]:
    items = []
    for raw in value.split(","):
        item = raw.strip()
        if item:
            items.append(item)
    return tuple(dict.fromkeys(items))


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class BackendSettings:
    workspace_root: Path
    qwen_repo_dir: Path
    model_dir: Path
    data_root: Path
    result_root: Path
    log_root: Path
    execution_log_root: Path
    execution_log_enabled: bool
    execution_log_fsync: bool
    tile_index_root: Path
    pano_tar_dir: Path
    pano_cache_root: Path
    pano_index_path: Path
    pano_tar_ranges: str
    public_base_url: str | None
    backend_token: str | None
    default_dataset_id: str
    default_dataset_ids: tuple[str, ...]
    default_dataset_group_id: str | None
    model_version: str
    scoring_version: str
    tile_index_version: str
    tile_zooms: tuple[int, ...]
    text_instruction: str
    selected_views: tuple[int, ...]
    embedding_device: str
    scoring_chunk_size: int
    density_trigger_points: int
    density_keep_points: int
    prompt_batch_window_ms: int
    prompt_batch_max_size: int
    prompt_queue_max_size: int
    job_memory_max_count: int
    job_memory_ttl_seconds: int
    prewrite_all_tiles: bool
    write_scores_jsonl: bool
    warmup_on_startup: bool
    temporary_scorer_enabled: bool
    temporary_point_count: int
    demo_alert_enabled: bool
    demo_alert_channel: str
    demo_alert_log_path: Path
    demo_alert_log_max_bytes: int
    demo_alert_log_backup_count: int
    demo_alert_log_dedupe_seconds: int
    demo_alert_heartbeat_retention_seconds: int
    demo_alert_email_to: tuple[str, ...]
    demo_alert_email_from: str
    demo_alert_gmail_client_id: str
    demo_alert_gmail_client_secret: str
    demo_alert_gmail_refresh_token: str
    demo_alert_gmail_user_id: str
    demo_alert_smtp_host: str
    demo_alert_smtp_port: int
    demo_alert_smtp_user: str
    demo_alert_smtp_password: str
    demo_alert_smtp_starttls: bool
    demo_alert_cooldown_seconds: int
    demo_alert_check_interval_seconds: int
    demo_alert_frontend_timeout_seconds: int
    demo_alert_watchdog_timeout_seconds: int
    demo_alert_job_stage_timeout_seconds: int
    demo_alert_pano_warmup_timeout_seconds: int
    demo_alert_min_disk_free_gb: float


def _default_workspace_root() -> Path:
    raw = os.getenv("WORKSPACE_ROOT")
    if raw:
        return Path(raw).expanduser()
    if (Path("/workspace") / "embedding" / "london_224_8_45").exists() or (Path("/workspace") / "Qwen3-VL-Embedding").exists():
        return Path("/workspace")
    return Path("~/workspace").expanduser()


def _path_env(name: str, default: Path) -> Path:
    return Path(os.getenv(name, str(default))).expanduser()


def _default_public_base_url() -> str | None:
    raw = os.getenv("PUBLIC_BASE_URL") or os.getenv("RUNPOD_PROXY_BASE_URL")
    if raw:
        return raw.rstrip("/")

    pod_id = os.getenv("RUNPOD_POD_ID") or os.getenv("RUNPOD_POD_HOSTNAME")
    port = os.getenv("PORT", "8000")
    if pod_id:
        return f"https://{pod_id}-{port}.proxy.runpod.net"
    return None


@lru_cache(maxsize=1)
def get_backend_settings() -> BackendSettings:
    workspace_root = _default_workspace_root()
    default_dataset_id = os.getenv("DEFAULT_DATASET_ID", "london_224_8_45")
    default_dataset_ids = _parse_str_list(os.getenv("DEFAULT_DATASET_IDS", "london_224_8_45,shanghai_224_8_45_2B")) or (default_dataset_id,)
    return BackendSettings(
        workspace_root=workspace_root,
        qwen_repo_dir=_path_env("QWEN_REPO_DIR", Path("/tmp/Qwen3-VL-Embedding")),
        model_dir=_path_env("MODEL_DIR", workspace_root / "models" / "Qwen3-VL-Embedding-2B"),
        data_root=_path_env("DATA_ROOT", workspace_root / "embedding"),
        result_root=_path_env("RESULT_ROOT", workspace_root / "semantic_backend" / "results"),
        log_root=_path_env("LOG_ROOT", workspace_root / "semantic_backend" / "logs"),
        execution_log_root=_path_env(
            "EXECUTION_LOG_ROOT",
            _path_env("LOG_ROOT", workspace_root / "semantic_backend" / "logs") / "query_execution",
        ),
        execution_log_enabled=_parse_bool(os.getenv("EXECUTION_LOG_ENABLED"), default=True),
        execution_log_fsync=_parse_bool(os.getenv("EXECUTION_LOG_FSYNC"), default=True),
        tile_index_root=_path_env("TILE_INDEX_ROOT", workspace_root / "semantic_backend" / "tile_index"),
        pano_tar_dir=_path_env("PANO_TAR_DIR", workspace_root / "pano"),
        pano_cache_root=_path_env("PANO_CACHE_ROOT", workspace_root / "semantic_backend" / "pano_cache"),
        pano_index_path=_path_env("PANO_INDEX_PATH", workspace_root / "semantic_backend" / "pano_index" / "pano_index.sqlite"),
        pano_tar_ranges=os.getenv(
            "PANO_TAR_RANGES",
            "01:10002:100005,02:100006:200001,03:200002:300001,04:300002:400001,05:400002:500001,06:500002:",
        ),
        public_base_url=_default_public_base_url(),
        backend_token=os.getenv("SEMANTIC_BACKEND_TOKEN"),
        default_dataset_id=default_dataset_id,
        default_dataset_ids=default_dataset_ids,
        default_dataset_group_id=os.getenv("DEFAULT_DATASET_GROUP_ID", "london_shanghai" if len(default_dataset_ids) > 1 else ""),
        model_version=os.getenv("MODEL_VERSION", "qwen3-vl-embedding-2b"),
        scoring_version=os.getenv("SCORING_VERSION", "text-cor-t-qwen-cred-v1"),
        tile_index_version=os.getenv("TILE_INDEX_VERSION", "xyz-z13-area-v1"),
        tile_zooms=_parse_int_list(os.getenv("TILE_ZOOMS", "10,11,12,13")),
        text_instruction=os.getenv("TEXT_INSTRUCTION", "Find images matching this description."),
        selected_views=_parse_int_list(os.getenv("SELECTED_VIEWS", "0,1,2,3,4,5,6,7")),
        embedding_device=os.getenv("EMBEDDING_DEVICE", "cuda").strip().lower(),
        scoring_chunk_size=int(os.getenv("SCORING_CHUNK_SIZE", "32768")),
        density_trigger_points=int(os.getenv("DENSITY_TRIGGER_POINTS", "10000")),
        density_keep_points=int(os.getenv("DENSITY_KEEP_POINTS", "5000")),
        prompt_batch_window_ms=int(os.getenv("PROMPT_BATCH_WINDOW_MS", "250")),
        prompt_batch_max_size=int(os.getenv("PROMPT_BATCH_MAX_SIZE", "32")),
        prompt_queue_max_size=int(os.getenv("PROMPT_QUEUE_MAX_SIZE", "256")),
        job_memory_max_count=int(os.getenv("JOB_MEMORY_MAX_COUNT", "1000")),
        job_memory_ttl_seconds=int(os.getenv("JOB_MEMORY_TTL_SECONDS", "21600")),
        prewrite_all_tiles=_parse_bool(os.getenv("PREWRITE_ALL_TILES"), default=False),
        write_scores_jsonl=_parse_bool(os.getenv("WRITE_SCORES_JSONL"), default=False),
        warmup_on_startup=_parse_bool(os.getenv("WARMUP_ON_STARTUP"), default=True),
        temporary_scorer_enabled=_parse_bool(os.getenv("TEMPORARY_SCORER_ENABLED"), default=False),
        temporary_point_count=int(os.getenv("TEMPORARY_POINT_COUNT", "12000")),
        demo_alert_enabled=_parse_bool(os.getenv("DEMO_ALERT_ENABLED"), default=False),
        demo_alert_channel=os.getenv("DEMO_ALERT_CHANNEL", os.getenv("ALERT_CHANNEL", "auto")).strip().lower(),
        demo_alert_log_path=_path_env(
            "DEMO_ALERT_LOG_PATH",
            workspace_root / "semantic_backend" / "alerts" / "alerts.jsonl",
        ),
        demo_alert_log_max_bytes=int(os.getenv("DEMO_ALERT_LOG_MAX_BYTES", str(20 * 1024 * 1024))),
        demo_alert_log_backup_count=int(os.getenv("DEMO_ALERT_LOG_BACKUP_COUNT", "3")),
        demo_alert_log_dedupe_seconds=int(os.getenv("DEMO_ALERT_LOG_DEDUPE_SECONDS", "60")),
        demo_alert_heartbeat_retention_seconds=int(os.getenv("DEMO_ALERT_HEARTBEAT_RETENTION_SECONDS", "21600")),
        demo_alert_email_to=_parse_str_list(os.getenv("DEMO_ALERT_EMAIL_TO", os.getenv("ALERT_EMAIL_TO", ""))),
        demo_alert_email_from=os.getenv("DEMO_ALERT_EMAIL_FROM", os.getenv("ALERT_EMAIL_FROM", "")).strip(),
        demo_alert_gmail_client_id=os.getenv("DEMO_ALERT_GMAIL_CLIENT_ID", os.getenv("GMAIL_CLIENT_ID", "")).strip(),
        demo_alert_gmail_client_secret=os.getenv("DEMO_ALERT_GMAIL_CLIENT_SECRET", os.getenv("GMAIL_CLIENT_SECRET", "")),
        demo_alert_gmail_refresh_token=os.getenv("DEMO_ALERT_GMAIL_REFRESH_TOKEN", os.getenv("GMAIL_REFRESH_TOKEN", "")),
        demo_alert_gmail_user_id=os.getenv("DEMO_ALERT_GMAIL_USER_ID", "me").strip() or "me",
        demo_alert_smtp_host=os.getenv("DEMO_ALERT_SMTP_HOST", os.getenv("ALERT_SMTP_HOST", "")).strip(),
        demo_alert_smtp_port=int(os.getenv("DEMO_ALERT_SMTP_PORT", os.getenv("ALERT_SMTP_PORT", "587"))),
        demo_alert_smtp_user=os.getenv("DEMO_ALERT_SMTP_USER", os.getenv("ALERT_SMTP_USER", "")).strip(),
        demo_alert_smtp_password=os.getenv("DEMO_ALERT_SMTP_PASSWORD", os.getenv("ALERT_SMTP_PASSWORD", "")),
        demo_alert_smtp_starttls=_parse_bool(os.getenv("DEMO_ALERT_SMTP_STARTTLS", os.getenv("ALERT_SMTP_STARTTLS")), default=True),
        demo_alert_cooldown_seconds=int(os.getenv("DEMO_ALERT_COOLDOWN_SECONDS", "600")),
        demo_alert_check_interval_seconds=int(os.getenv("DEMO_ALERT_CHECK_INTERVAL_SECONDS", "15")),
        demo_alert_frontend_timeout_seconds=int(os.getenv("DEMO_ALERT_FRONTEND_TIMEOUT_SECONDS", "60")),
        demo_alert_watchdog_timeout_seconds=int(os.getenv("DEMO_ALERT_WATCHDOG_TIMEOUT_SECONDS", "60")),
        demo_alert_job_stage_timeout_seconds=int(os.getenv("DEMO_ALERT_JOB_STAGE_TIMEOUT_SECONDS", "60")),
        demo_alert_pano_warmup_timeout_seconds=int(os.getenv("DEMO_ALERT_PANO_WARMUP_TIMEOUT_SECONDS", "900")),
        demo_alert_min_disk_free_gb=float(os.getenv("DEMO_ALERT_MIN_DISK_FREE_GB", "5")),
    )
