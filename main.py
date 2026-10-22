from __future__ import annotations


def main() -> None:
    raise SystemExit(
        "The legacy Gradio demo is retired: its Pillow<13 dependency blocks "
        "critical image-decoder security fixes. Use start_demo.bat for the "
        "current React demo, or run npm.cmd run dev in frontend/. "
        "Install Python dependencies with Python 3.11+ and requirements.txt."
    )


if __name__ == "__main__":
    main()
