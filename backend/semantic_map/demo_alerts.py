from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import smtplib
import time
from email.message import EmailMessage
from pathlib import Path
from typing import Any
from urllib import error, parse, request

from .backend_config import BackendSettings
from .prompt_ids import utc_now
from .remote_schemas import DemoMonitorEvent, DemoMonitorHeartbeat


class DemoAlertManager:
    def __init__(self, settings: BackendSettings) -> None:
        self.settings = settings
        self._lock = asyncio.Lock()
        self._last_email_at: dict[str, float] = {}
        self._email_inflight_keys: set[str] = set()
        self._last_logged_at: dict[str, float] = {}
        self._recent_event_fingerprints: dict[str, float] = {}
        self._heartbeats: dict[tuple[str, str], dict[str, Any]] = {}
        self._recent_events: list[dict[str, Any]] = []

    @property
    def enabled(self) -> bool:
        return self.settings.demo_alert_enabled

    @property
    def email_configured(self) -> bool:
        return self.gmail_api_configured if self.alert_channel == "gmail_api" else self.smtp_configured

    @property
    def alert_channel(self) -> str:
        channel = (self.settings.demo_alert_channel or "auto").strip().lower().replace("-", "_")
        if channel in {"gmail", "gmailapi", "google_gmail"}:
            return "gmail_api"
        if channel in {"smtp", "gmail_api"}:
            return channel
        if channel == "auto":
            if self.gmail_api_configured:
                return "gmail_api"
            if self.smtp_configured:
                return "smtp"
        return "smtp"

    @property
    def gmail_api_configured(self) -> bool:
        return bool(
            self.settings.demo_alert_email_from
            and self.settings.demo_alert_email_to
            and self.settings.demo_alert_gmail_client_id
            and self.settings.demo_alert_gmail_client_secret
            and self.settings.demo_alert_gmail_refresh_token
        )

    @property
    def smtp_configured(self) -> bool:
        from_addr = self.settings.demo_alert_email_from or self.settings.demo_alert_smtp_user
        return bool(
            self.settings.demo_alert_smtp_host
            and from_addr
            and self.settings.demo_alert_email_to
        )

    async def record_heartbeat(self, heartbeat: DemoMonitorHeartbeat) -> None:
        if not self.enabled:
            return
        session_id = safe_session_id(heartbeat.session_id)
        payload = heartbeat.model_dump()
        payload["session_id"] = session_id
        payload["received_at"] = utc_now()
        payload["received_timestamp"] = time.time()

        async with self._lock:
            self._prune_heartbeats_locked(payload["received_timestamp"])
            self._heartbeats[(heartbeat.source, session_id)] = payload

    async def record_event(self, event: DemoMonitorEvent) -> bool:
        if not self.enabled:
            return False

        session_id = safe_session_id(event.session_id)
        payload = redact_jsonable(event.model_dump())
        payload["session_id"] = session_id
        payload["received_at"] = utc_now()
        emailed = False
        email_key = self._email_dedupe_key(event, session_id)
        fingerprint = self._event_fingerprint(event, session_id)

        async with self._lock:
            now = time.time()
            if fingerprint and self._is_duplicate_fingerprint_locked(fingerprint, now):
                return False
            should_log = self._should_log_locked(event, session_id, now)
            if should_log:
                self._last_logged_at[email_key] = now
                self._recent_events.insert(0, payload)
                self._recent_events = self._recent_events[:200]
                self._write_event_locked({**payload, "emailed": False})
            should_email = self._should_email_locked(event, session_id)
            if should_email:
                self._email_inflight_keys.add(email_key)

        if should_email:
            try:
                await asyncio.to_thread(self._send_email, payload)
                emailed = True
            except Exception as exc:
                async with self._lock:
                    self._email_inflight_keys.discard(email_key)
                    self._write_event_locked(
                        {
                            "source": "backend",
                            "severity": "warning",
                            "code": "demo_alert_email_failed",
                            "message": f"{type(exc).__name__}: {exc}",
                            "session_id": "backend",
                            "details": {"original_code": event.code, "original_source": event.source},
                            "received_at": utc_now(),
                            "emailed": False,
                        }
                    )

        if emailed:
            async with self._lock:
                self._email_inflight_keys.discard(email_key)
                self._last_email_at[email_key] = time.time()
                if should_log:
                    self._write_event_locked({**payload, "emailed": True})
        return emailed

    async def snapshot(self) -> dict[str, Any]:
        async with self._lock:
            now = time.time()
            heartbeats = []
            for (source, session_id), payload in sorted(self._heartbeats.items()):
                received_timestamp = float(payload.get("received_timestamp") or 0)
                heartbeats.append(
                    {
                        "source": source,
                        "session_id": session_id,
                        "status": payload.get("status"),
                        "received_at": payload.get("received_at"),
                        "age_seconds": round(now - received_timestamp, 1) if received_timestamp else None,
                        "frontend_url": payload.get("frontend_url"),
                        "backend_url": payload.get("backend_url"),
                    }
                )
            return {
                "enabled": self.enabled,
                "email_configured": self.email_configured,
                "alert_channel": self.alert_channel,
                "log_path": str(self.settings.demo_alert_log_path),
                "heartbeats": heartbeats,
                "recent_events": list(self._recent_events[:50]),
            }

    async def latest_heartbeat(self, source: str) -> dict[str, Any] | None:
        async with self._lock:
            candidates = [
                {**payload, "session_id": session_id}
                for (heartbeat_source, session_id), payload in self._heartbeats.items()
                if heartbeat_source == source
            ]
        if not candidates:
            return None
        return max(candidates, key=lambda item: float(item.get("received_timestamp") or 0))

    async def stale_heartbeats(self, source: str, timeout_seconds: int) -> list[dict[str, Any]]:
        if not self.enabled:
            return []
        now = time.time()
        stale = []
        async with self._lock:
            for (heartbeat_source, session_id), payload in self._heartbeats.items():
                if heartbeat_source != source:
                    continue
                received_timestamp = float(payload.get("received_timestamp") or 0)
                if received_timestamp and now - received_timestamp > timeout_seconds:
                    stale.append({**payload, "session_id": session_id, "age_seconds": round(now - received_timestamp, 1)})
        return stale

    def _should_email_locked(self, event: DemoMonitorEvent, session_id: str) -> bool:
        if event.severity not in {"warning", "critical", "recovered"}:
            return False
        if not self.email_configured:
            return False

        now = time.time()
        key = self._email_dedupe_key(event, session_id)
        if key in self._email_inflight_keys:
            return False
        last_sent_at = self._last_email_at.get(key)
        if last_sent_at is not None and now - last_sent_at < max(0, self.settings.demo_alert_cooldown_seconds):
            return False
        return True

    def _should_log_locked(self, event: DemoMonitorEvent, session_id: str, now: float) -> bool:
        if event.severity in {"critical", "recovered"}:
            return True
        key = self._email_dedupe_key(event, session_id)
        last_logged_at = self._last_logged_at.get(key)
        if last_logged_at is not None and now - last_logged_at < max(0, self.settings.demo_alert_log_dedupe_seconds):
            return False
        return True

    def _is_duplicate_fingerprint_locked(self, fingerprint: str, now: float) -> bool:
        retention_seconds = 600
        stale = [key for key, seen_at in self._recent_event_fingerprints.items() if now - seen_at > retention_seconds]
        for key in stale:
            self._recent_event_fingerprints.pop(key, None)
        if fingerprint in self._recent_event_fingerprints:
            return True
        self._recent_event_fingerprints[fingerprint] = now
        return False

    def _email_dedupe_key(self, event: DemoMonitorEvent, session_id: str) -> str:
        return f"{event.source}:{session_id}:{event.code}:{event.severity}"

    def _event_fingerprint(self, event: DemoMonitorEvent, session_id: str) -> str | None:
        if not event.observed_at:
            return None
        raw = json.dumps(
            {
                "source": event.source,
                "session_id": session_id,
                "severity": event.severity,
                "code": event.code,
                "message": event.message,
                "observed_at": event.observed_at,
            },
            ensure_ascii=True,
            sort_keys=True,
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _prune_heartbeats_locked(self, now: float) -> None:
        retention_seconds = max(300, self.settings.demo_alert_heartbeat_retention_seconds)
        stale_keys = [
            key
            for key, payload in self._heartbeats.items()
            if now - float(payload.get("received_timestamp") or 0) > retention_seconds
        ]
        for key in stale_keys:
            self._heartbeats.pop(key, None)

    def _write_event_locked(self, payload: dict[str, Any]) -> None:
        path = self.settings.demo_alert_log_path
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            self._rotate_log_if_needed(path)
            with path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(redact_jsonable(payload), ensure_ascii=True, sort_keys=True) + "\n")
        except OSError as exc:
            print(f"Demo alert log write failed: {type(exc).__name__}: {exc}", flush=True)

    def _rotate_log_if_needed(self, path: Path) -> None:
        max_bytes = max(0, self.settings.demo_alert_log_max_bytes)
        backup_count = max(0, self.settings.demo_alert_log_backup_count)
        if max_bytes <= 0 or not path.exists() or path.stat().st_size < max_bytes:
            return
        if backup_count <= 0:
            path.unlink(missing_ok=True)
            return
        oldest = path.with_name(f"{path.name}.{backup_count}")
        oldest.unlink(missing_ok=True)
        for index in range(backup_count - 1, 0, -1):
            source = path.with_name(f"{path.name}.{index}")
            if source.exists():
                source.replace(path.with_name(f"{path.name}.{index + 1}"))
        path.replace(path.with_name(f"{path.name}.1"))

    def _send_email(self, payload: dict[str, Any]) -> None:
        channel = self.alert_channel
        from_addr = self.settings.demo_alert_email_from or self.settings.demo_alert_smtp_user
        subject = f"[SemanticMap demo] {payload.get('severity', 'alert').upper()} {payload.get('source')}:{payload.get('code')}"
        message = EmailMessage()
        message["Subject"] = sanitize_header(subject)[:180]
        message["From"] = from_addr
        message["To"] = ", ".join(self.settings.demo_alert_email_to)
        message.set_content(format_email_body(payload, self.settings.demo_alert_log_path))

        if channel == "gmail_api":
            self._send_email_with_gmail_api(message)
            return

        if self.settings.demo_alert_smtp_port == 465 and not self.settings.demo_alert_smtp_starttls:
            smtp_cls = smtplib.SMTP_SSL
        else:
            smtp_cls = smtplib.SMTP

        with smtp_cls(self.settings.demo_alert_smtp_host, self.settings.demo_alert_smtp_port, timeout=20) as smtp:
            if self.settings.demo_alert_smtp_starttls and smtp_cls is smtplib.SMTP:
                smtp.starttls()
            if self.settings.demo_alert_smtp_user:
                smtp.login(self.settings.demo_alert_smtp_user, self.settings.demo_alert_smtp_password)
            smtp.send_message(message)

    def _send_email_with_gmail_api(self, message: EmailMessage) -> None:
        access_token = self._gmail_api_access_token()
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")
        user_id = parse.quote(self.settings.demo_alert_gmail_user_id or "me", safe="")
        url = f"https://gmail.googleapis.com/gmail/v1/users/{user_id}/messages/send"
        body = json.dumps({"raw": raw_message}).encode("utf-8")
        req = request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as response:
                if response.status >= 400:
                    raise RuntimeError(f"Gmail API send failed with HTTP {response.status}")
        except error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(f"Gmail API send failed with HTTP {exc.code}: {error_body}") from exc

    def _gmail_api_access_token(self) -> str:
        form = parse.urlencode(
            {
                "client_id": self.settings.demo_alert_gmail_client_id,
                "client_secret": self.settings.demo_alert_gmail_client_secret,
                "refresh_token": self.settings.demo_alert_gmail_refresh_token,
                "grant_type": "refresh_token",
            }
        ).encode("utf-8")
        req = request.Request(
            "https://oauth2.googleapis.com/token",
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(f"Gmail OAuth refresh failed with HTTP {exc.code}: {error_body}") from exc
        access_token = payload.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise RuntimeError("Gmail OAuth refresh did not return an access_token.")
        return access_token


def safe_session_id(session_id: str | None) -> str:
    raw = (session_id or "default").strip()
    return raw[:128] if raw else "default"


def sanitize_header(value: str) -> str:
    return value.replace("\r", " ").replace("\n", " ").strip()


def format_email_body(payload: dict[str, Any], log_path: Path) -> str:
    details = payload.get("details") if isinstance(payload.get("details"), dict) else {}
    analysis = details.get("analysis") or infer_alert_analysis(payload)
    lines = [
        "Semantic Map demo monitor alert",
        "",
        f"Severity: {payload.get('severity')}",
        f"Source:   {payload.get('source')}",
        f"Code:     {payload.get('code')}",
        f"Session:  {payload.get('session_id')}",
        f"Time:     {payload.get('received_at')}",
        "",
        str(payload.get("message") or ""),
        "",
    ]
    if analysis:
        lines.extend(["Analysis:", *format_analysis_lines(analysis), ""])
    lines.extend(
        [
            "Details:",
            json.dumps(redact_jsonable(details), ensure_ascii=True, indent=2, sort_keys=True)[:6000],
            "",
            f"Backend log: {log_path}",
        ]
    )
    return "\n".join(lines)


def infer_alert_analysis(payload: dict[str, Any]) -> dict[str, str] | str | None:
    code = str(payload.get("code") or "")
    source = str(payload.get("source") or "")
    details = payload.get("details") if isinstance(payload.get("details"), dict) else {}

    if code == "frontend_heartbeat_stale":
        status = str(details.get("status") or "").lower()
        frontend_details = details.get("details") if isinstance(details.get("details"), dict) else {}
        visibility = str(frontend_details.get("visibility_state") or "").lower()
        latest_watchdog = details.get("latest_watchdog") if isinstance(details.get("latest_watchdog"), dict) else {}
        watchdog_details = latest_watchdog.get("details") if isinstance(latest_watchdog.get("details"), dict) else {}
        frontend_probe = watchdog_details.get("frontend_probe") if isinstance(watchdog_details.get("frontend_probe"), dict) else {}
        backend_probe = watchdog_details.get("backend_ready_probe") if isinstance(watchdog_details.get("backend_ready_probe"), dict) else {}
        if status == "hidden" or visibility == "hidden":
            return {
                "likely_condition": "browser_background_timer_throttling",
                "signals": "The last frontend heartbeat reported visibility_state=hidden.",
                "suggested_action": "No action is usually needed unless the demo browser should be visible on screen.",
            }
        if frontend_probe.get("ok") is True and backend_probe.get("ok") is True:
            return {
                "likely_condition": "frontend_page_closed_crashed_or_javascript_stalled",
                "signals": "The A-side watchdog can reach both the local frontend server and backend, but browser heartbeat stopped.",
                "suggested_action": "Check the demo computer browser. The A-side watchdog should reopen the frontend in demo mode.",
            }
        if backend_probe.get("ok") is False:
            return {
                "likely_condition": "frontend_or_demo_computer_network_path_problem",
                "signals": "The A-side watchdog reported backend /api/ready failure while frontend heartbeat was stale.",
                "suggested_action": "Check the demo computer network and RunPod backend URL.",
            }
        return {
            "likely_condition": "frontend_heartbeat_missing",
            "signals": "Backend has not received a fresh frontend heartbeat within the timeout window.",
            "suggested_action": "Check whether the demo browser is open, responsive, and connected.",
        }

    if code == "watchdog_heartbeat_stale":
        return {
            "likely_condition": "a_side_watchdog_or_demo_computer_unreachable",
            "signals": "Backend has not received a fresh A-side watchdog heartbeat.",
            "suggested_action": "Check whether the demo BAT window/computer is still running and whether it can reach the backend.",
        }

    if code in {"frontend_local_unreachable", "frontend_local_monitor_unavailable"}:
        return {
            "likely_condition": "a_side_frontend_or_local_monitor_problem",
            "signals": str(details.get("analysis") or "The A-side watchdog reported a local frontend/monitor failure."),
            "suggested_action": "Check whether the demo BAT window is still running and whether the local frontend URL opens on the demo computer.",
        }

    if code in {"watchdog_backend_connection_recovered", "frontend_browser_online"}:
        return {
            "likely_condition": "a_side_network_recovered",
            "signals": "The demo computer or browser reported that backend/network connectivity recovered.",
            "suggested_action": "Check earlier emails/log entries for watchdog_heartbeat_stale or backend_ready_probe_failed to estimate outage duration.",
        }

    if code in {"frontend_page_hidden_or_closing", "frontend_background_timer_suspended"}:
        return {
            "likely_condition": "frontend_page_hidden_or_closing",
            "signals": "The browser reported pagehide/hidden state, or browser timers were throttled in the background.",
            "suggested_action": "If this was a close/navigation, the A-side watchdog should reopen the page. If this was a background tab/window, no action is usually needed.",
        }

    if code in {"frontend_window_error", "frontend_unhandled_rejection"}:
        return {
            "likely_condition": "frontend_javascript_runtime_error",
            "signals": str(details.get("error") or details.get("reason") or payload.get("message") or "The browser reported a frontend JavaScript error."),
            "suggested_action": "Check the demo browser console and frontend build around the reported stack/message. The A-side watchdog should reopen the page if visible heartbeats stop.",
        }

    if code == "frontend_main_thread_stall":
        return {
            "likely_condition": "frontend_main_thread_blocked_or_render_overloaded",
            "signals": f"Reported lag ms: {details.get('lag_ms')}.",
            "suggested_action": "Check whether both city maps are rendering too many features, tile requests, or expensive synchronization work at once.",
        }

    if code == "frontend_remote_operation_failed":
        return {
            "likely_condition": "frontend_backend_operation_failed",
            "signals": str(details.get("current_stage") or details.get("message") or payload.get("message") or "A remote frontend operation failed."),
            "suggested_action": "Check the backend job/event log for the matching layer_id or job_id and verify the RunPod backend URL/token.",
        }

    if code == "scoring_job_stage_stale":
        stage = details.get("current_stage") or details.get("status") or "unknown"
        age = details.get("age_seconds")
        return {
            "likely_condition": "backend_data_processing_slow_or_stuck",
            "signals": f"Job has stayed at stage {stage} for {age} seconds.",
            "suggested_action": "Check backend logs, GPU memory, and whether tile writing or scoring is still making progress.",
        }

    if code == "scoring_job_failed":
        return {
            "likely_condition": "backend_scoring_job_failed",
            "signals": str(details.get("message") or payload.get("message") or "The job status is failed."),
            "suggested_action": "Check the backend job details and server log for the exception before restarting the demo.",
        }

    if code in {"backend_ready_probe_failed", "backend_ready_probe_slow"}:
        return {
            "likely_condition": "backend_unreachable_or_slow_from_demo_computer",
            "signals": "The A-side watchdog could not get a fast successful response from /api/ready.",
            "suggested_action": "Check RunPod health, proxy URL, and network from the demo computer.",
        }

    if code == "frontend_browser_restarted":
        return {
            "likely_condition": "a_side_watchdog_reopened_frontend",
            "signals": "Local frontend server was reachable, but browser heartbeat was missing or stale.",
            "suggested_action": "Verify that a fresh frontend tab/window is visible on the demo computer.",
        }

    if code in {"pano_index_warmup_slow", "pano_index_warmup_stale"}:
        return {
            "likely_condition": "backend_pano_index_warmup_slow",
            "signals": f"Pano index warmup elapsed seconds: {details.get('elapsed_seconds')}; timeout seconds: {details.get('timeout_seconds')}.",
            "suggested_action": "This is expected on first Shanghai tar indexing if the SQLite index is not built yet. Treat it as a problem only if it repeats after the index exists or blocks pano fetching for too long.",
        }

    if code == "pano_index_warmup_failed":
        return {
            "likely_condition": "backend_pano_index_warmup_failed",
            "signals": str(details.get("exception_type") or payload.get("message") or "Pano index warmup failed."),
            "suggested_action": "Check RunPod logs and pano tar/index paths before relying on street-view fetching.",
        }

    if code in {"backend_startup_failed", "prompt_worker_missing", "prompt_worker_stopped", "demo_monitor_check_failed"}:
        return {
            "likely_condition": "backend_runtime_failure",
            "signals": str(details.get("exception_type") or payload.get("message") or "Backend runtime monitor reported a failure."),
            "suggested_action": "Check the RunPod backend log and restart the backend after the underlying exception is understood.",
        }

    if code == "disk_space_low":
        return {
            "likely_condition": "backend_storage_low",
            "signals": f"Free disk GB: {details.get('free_gb')}; threshold GB: {details.get('threshold_gb')}.",
            "suggested_action": "Clean old result/tile/pano caches or expand the RunPod volume before running long demos.",
        }

    if code == "frontend_browser_offline":
        return {
            "likely_condition": "demo_browser_offline",
            "signals": "The frontend reported navigator.onLine=false.",
            "suggested_action": "Check the demo computer network connection.",
        }

    if payload.get("severity") == "recovered":
        return {
            "likely_condition": "previous_alert_recovered",
            "signals": f"{source}:{code} reported recovery.",
            "suggested_action": "Confirm the demo view is visible if this recovery followed a frontend interruption.",
        }

    return None


def format_analysis_lines(analysis: dict[str, str] | str) -> list[str]:
    if isinstance(analysis, str):
        return [analysis.strip()]
    labels = {
        "likely_condition": "Likely cause",
        "signals": "Signals",
        "suggested_action": "Suggested action",
    }
    lines: list[str] = []
    for key in ("likely_condition", "signals", "suggested_action"):
        value = analysis.get(key)
        if value:
            lines.append(f"{labels[key]}: {str(value).replace(chr(10), ' ').strip()}")
    return lines


def redact_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            key_text = str(key)
            if any(secret in key_text.lower() for secret in ("password", "token", "authorization", "secret")):
                redacted[key_text] = "***"
            else:
                redacted[key_text] = redact_jsonable(item)
        return redacted
    if isinstance(value, list):
        return [redact_jsonable(item) for item in value[:100]]
    if isinstance(value, tuple):
        return [redact_jsonable(item) for item in value[:100]]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)
