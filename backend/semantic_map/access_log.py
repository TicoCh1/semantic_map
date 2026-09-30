"""Persistent HTTP access records with explicitly trusted proxy handling."""
from __future__ import annotations

from datetime import datetime, timezone
from ipaddress import ip_address, ip_network
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import time
from uuid import uuid4


class PrivateRotatingHandler(RotatingFileHandler):
    def _open(self):
        fd = os.open(self.baseFilename, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        return os.fdopen(fd, 'a', encoding='utf-8')


def access_logger(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger('semantic_map.http_access.' + str(path.resolve()))
    if not logger.handlers:
        handler = PrivateRotatingHandler(path, maxBytes=10 * 1024 * 1024, backupCount=5)
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def visitor_address(peer: str, forwarded: str, networks):
    """Walk XFF right-to-left; never trust headers from an untrusted peer."""
    def trusted(value):
        try:
            address = ip_address(value)
            return any(address in network for network in networks)
        except ValueError:
            return False

    if not forwarded or not trusted(peer):
        return peer, 'peer', []
    try:
        parts = forwarded.split(',')
        if len(parts) > 32:
            raise ValueError('Oversized proxy chain')
        chain = [str(ip_address(part.strip())) for part in parts]
    except ValueError:
        return peer, 'peer_invalid_forwarded_for', []
    for value in reversed(chain):
        if not trusted(value):
            return value, 'x_forwarded_for', chain
    # No independently identifiable visitor in an all-proxy chain.
    return peer, 'peer_only_trusted_hops', chain


class AccessLogMiddleware:
    def __init__(self, app, path, trusted_proxies=''):
        self.app = app
        self.logger = access_logger(Path(path))
        self.networks = tuple(ip_network(x.strip()) for x in trusted_proxies.split(',') if x.strip())

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        started = datetime.now(timezone.utc).isoformat(timespec='milliseconds')
        clock = time.monotonic()
        peer = (scope.get('client') or ('unknown', 0))[0]
        headers = scope.get('headers', [])
        forwarded = ','.join(v.decode('latin1') for k, v in headers if k.lower() == b'x-forwarded-for')
        client, source, chain = visitor_address(peer, forwarded, self.networks)
        agent = next((v.decode('latin1')[:512] for k, v in headers if k.lower() == b'user-agent'), '')
        request_id = uuid4().hex
        status = 500
        sent = 0
        complete = False
        error = None

        async def wrapped_send(message):
            nonlocal status, sent, complete
            if message['type'] == 'http.response.start':
                status = message['status']
                message = {**message, 'headers': [*message.get('headers', []),
                                                 (b'x-request-id', request_id.encode('ascii'))]}
            elif message['type'] == 'http.response.body':
                sent += len(message.get('body', b''))
            await send(message)
            if message['type'] == 'http.response.body' and not message.get('more_body', False):
                complete = True

        try:
            await self.app(scope, receive, wrapped_send)
        except BaseException as exc:
            error = type(exc).__name__
            raise
        finally:
            self.logger.info(json.dumps({
                'timestamp_utc': started,
                'completed_at_utc': datetime.now(timezone.utc).isoformat(timespec='milliseconds'),
                'request_id': request_id, 'client_ip': client, 'peer_ip': peer,
                'client_ip_source': source, 'forwarded_for': chain,
                'method': scope['method'], 'path': scope.get('path', '')[:2048],
                'status': status, 'duration_ms': round((time.monotonic() - clock) * 1000, 3),
                'response_bytes': sent, 'response_complete': complete,
                'user_agent': agent, 'error_type': error,
            }, ensure_ascii=True, separators=(',', ':')))


def install_access_logging(app, workspace_root):
    path = os.getenv('ACCESS_LOG_PATH', str(Path(workspace_root) / 'semantic_backend/logs/access.jsonl'))
    # Empty by default: non-RunPod callers do not implicitly trust proxy headers.
    trusted = os.getenv('ACCESS_LOG_TRUSTED_PROXIES', '')
    app.add_middleware(AccessLogMiddleware, path=path, trusted_proxies=trusted)
