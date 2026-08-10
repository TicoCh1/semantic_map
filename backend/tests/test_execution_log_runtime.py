from __future__ import annotations

import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

from backend.semantic_map.execution_log import ExecutionAuditLog


class ExecutionAuditLogRuntimeTest(unittest.TestCase):
    def test_record_does_not_wait_for_slow_writer(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            audit_log = ExecutionAuditLog(
                SimpleNamespace(
                    execution_log_root=Path(temp_dir),
                    execution_log_enabled=True,
                    execution_log_fsync=True,
                )
            )
            write_started = threading.Event()
            release_write = threading.Event()

            def slow_writer_loop() -> None:
                while True:
                    item = audit_log._write_queue.get()
                    try:
                        if not isinstance(item, tuple):
                            return
                        write_started.set()
                        release_write.wait(timeout=2)
                    finally:
                        audit_log._write_queue.task_done()

            audit_log._writer_loop = slow_writer_loop  # type: ignore[method-assign]
            try:
                started = time.perf_counter()
                audit_log.record("runtime_probe", request_id="request_test")
                elapsed = time.perf_counter() - started

                self.assertLess(elapsed, 0.1)
                self.assertTrue(write_started.wait(timeout=1))
            finally:
                release_write.set()
                audit_log.close()


if __name__ == "__main__":
    unittest.main()
