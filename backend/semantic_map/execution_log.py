"""Append-only request and execution audit log for semantic scoring.

The result cache intentionally stores only the latest materialised result for a
prompt. This module is separate from that cache: every API admission and every
physical worker batch is appended to JSONL, so historic prompt-to-batch and
timing relationships remain recoverable after cache hits or overrides.
"""

from __future__ import annotations

import json
import os
import queue
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .backend_config import BackendSettings


AUDIT_SCHEMA_VERSION = 1
_AUDIT_STOP = object()


def utc_now_precise() -> str:
    """Return an ISO-8601 UTC timestamp with millisecond precision."""

    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class ExecutionAuditLog:
    """Durable, process-safe JSONL writer used by the query scheduler."""

    def __init__(self, settings: BackendSettings) -> None:
        self.root = settings.execution_log_root
        self.enabled = settings.execution_log_enabled
        self.fsync = settings.execution_log_fsync
        self._state_lock = threading.Lock()
        self._write_queue: queue.Queue[tuple[Path, str] | object] = queue.Queue()
        self._writer_thread: threading.Thread | None = None
        self._closed = False

    def record(self, event: str, **fields: Any) -> dict[str, Any]:
        payload = {
            "schema_version": AUDIT_SCHEMA_VERSION,
            "event": event,
            "recorded_at": utc_now_precise(),
            **fields,
        }
        if not self.enabled:
            return payload

        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str) + "\n"
        path = self._path_for(payload["recorded_at"])
        with self._state_lock:
            if self._closed:
                return payload
            if self._writer_thread is None:
                self._writer_thread = threading.Thread(
                    target=self._writer_loop,
                    name="semantic-audit-writer",
                    daemon=True,
                )
                self._writer_thread.start()
            self._write_queue.put_nowait((path, encoded))
        return payload

    def close(self) -> None:
        """Flush all accepted events and stop the ordered writer thread."""

        if not self.enabled:
            return
        with self._state_lock:
            if self._closed:
                writer_thread = self._writer_thread
            else:
                self._closed = True
                writer_thread = self._writer_thread
                if writer_thread is not None:
                    self._write_queue.put_nowait(_AUDIT_STOP)
        if writer_thread is not None:
            self._write_queue.join()
            writer_thread.join()

    def _writer_loop(self) -> None:
        while True:
            item = self._write_queue.get()
            try:
                if item is _AUDIT_STOP:
                    return
                path, encoded = item
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open("a", encoding="utf-8") as handle:
                    handle.write(encoded)
                    handle.flush()
                    if self.fsync:
                        os.fsync(handle.fileno())
            except OSError as exc:
                print(f"Execution audit write skipped: {type(exc).__name__}: {exc}", flush=True)
            finally:
                self._write_queue.task_done()

    def _path_for(self, timestamp: str) -> Path:
        date = timestamp[:10]
        return self.root / f"query-execution-{date}.jsonl"
