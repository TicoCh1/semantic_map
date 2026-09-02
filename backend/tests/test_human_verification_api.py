import unittest

from starlette.requests import Request

from backend.semantic_map.human_verification_api import verification_client_ip


class HumanVerificationApiTests(unittest.TestCase):
    def test_forwarded_visitor_ip_is_preferred_over_runpod_proxy_ip(self) -> None:
        request = Request(
            {
                "type": "http",
                "headers": [(b"x-forwarded-for", b"203.0.113.8, 100.64.1.1")],
                "client": ("100.64.1.1", 1234),
            }
        )
        self.assertEqual(verification_client_ip(request), "203.0.113.8")

    def test_connection_ip_is_used_when_forwarding_headers_are_absent(self) -> None:
        request = Request(
            {
                "type": "http",
                "headers": [],
                "client": ("100.64.1.2", 1234),
            }
        )
        self.assertEqual(verification_client_ip(request), "100.64.1.2")


if __name__ == "__main__":
    unittest.main()
