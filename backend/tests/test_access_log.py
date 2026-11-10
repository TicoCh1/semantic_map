import asyncio
from datetime import datetime
from ipaddress import ip_network
import json
from pathlib import Path
import tempfile
import unittest

from semantic_map.access_log import AccessLogMiddleware, visitor_address


class AccessLogTests(unittest.TestCase):
    def test_proxy_chain_and_spoofed_prefix(self):
        networks = [ip_network('100.64.1.0/24'), ip_network('127.0.0.1/32'), ip_network('104.16.0.0/13')]
        value = visitor_address('100.64.1.4', '192.0.2.66, 198.51.100.7, 100.64.1.3', networks)
        self.assertEqual(value[:2], ('198.51.100.7', 'x_forwarded_for'))
        self.assertEqual(visitor_address('100.64.1.2', '192.0.2.66, 198.51.100.7, 104.23.170.29', networks)[0], '198.51.100.7')
        self.assertEqual(visitor_address('203.0.113.7', '192.0.2.66', networks)[0], '203.0.113.7')
        self.assertEqual(visitor_address('100.64.1.4', 'garbage', networks)[1], 'peer_invalid_forwarded_for')
        self.assertEqual(visitor_address('100.64.1.4', '2001:db8::7', networks)[0], '2001:db8::7')
        self.assertEqual(visitor_address('100.64.1.4', ','.join(['192.0.2.1'] * 33), networks)[0], '100.64.1.4')

    def exercise(self, fail=False):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'access.jsonl'
            async def app(scope, receive, send):
                if fail:
                    raise RuntimeError('private error detail')
                await send({'type':'http.response.start', 'status':404, 'headers':[]})
                await send({'type':'http.response.body', 'body':b'not found'})
            middleware = AccessLogMiddleware(app, path, '100.64.1.0/24')
            messages=[]
            async def send(message): messages.append(message)
            async def receive(): return {'type':'http.request', 'body':b''}
            scope={'type':'http', 'client':('100.64.1.2', 10), 'method':'GET', 'path':'/missing',
                   'query_string':b'token=secret', 'headers':[(b'x-forwarded-for',b'198.51.100.8'),
                   (b'authorization',b'Bearer secret'), (b'user-agent',b'test\nagent')]}
            try:
                if fail:
                    with self.assertRaises(RuntimeError): asyncio.run(middleware(scope,receive,send))
                else: asyncio.run(middleware(scope,receive,send))
                lines=path.read_text().splitlines();self.assertEqual(len(lines),1)
                row=json.loads(lines[0]);self.assertEqual(row['client_ip'],'198.51.100.8')
                self.assertIsNotNone(datetime.fromisoformat(row['timestamp_utc']).tzinfo)
                self.assertGreaterEqual(row['duration_ms'],0)
                self.assertNotIn('secret',lines[0]);self.assertNotIn('private error detail',lines[0])
                self.assertEqual(row['status'],500 if fail else 404)
                self.assertEqual(row['response_complete'],not fail)
                if not fail:
                    self.assertIn((b'x-request-id',row['request_id'].encode()),messages[0]['headers'])
            finally:
                for handler in list(middleware.logger.handlers):
                    handler.close();middleware.logger.removeHandler(handler)

    def test_response_and_private_fields(self): self.exercise()
    def test_unhandled_exception_logged(self): self.exercise(fail=True)

    def test_rotation(self):
        with tempfile.TemporaryDirectory() as tmp:
            middleware=AccessLogMiddleware(None,Path(tmp)/'access.jsonl')
            handler=middleware.logger.handlers[0]
            try:
                handler.maxBytes=100
                for i in range(20): middleware.logger.info(json.dumps({'i':i,'payload':'x'*60}))
                files=list(Path(tmp).glob('access.jsonl*'))
                self.assertLessEqual(len(files),6);self.assertGreater(len(files),1)
                for p in files:
                    for line in p.read_text().splitlines():json.loads(line)
                    self.assertEqual(p.stat().st_mode & 0o777,0o600)
            finally:
                handler.close();middleware.logger.removeHandler(handler)
