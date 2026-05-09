from __future__ import annotations

from src.semantic_map.app import APP_CSS, build_demo


def main() -> None:
    demo = build_demo()
    demo.queue()
    demo.launch(server_name="127.0.0.1", server_port=7860, css=APP_CSS)


if __name__ == "__main__":
    main()
