#!/usr/bin/env python3
"""
Export or check the committed FastAPI OpenAPI schema.
"""

import argparse
import difflib
import filecmp
import json
import os
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DEBUG", "true")

from app.main import app  # noqa: E402


def render_schema() -> str:
    return json.dumps(app.openapi(), ensure_ascii=True, indent=2) + "\n"


def print_diff(expected: str, actual: str) -> None:
    diff = difflib.unified_diff(
        expected.splitlines(keepends=True),
        actual.splitlines(keepends=True),
        fromfile="openapi.json",
        tofile="current FastAPI schema",
    )
    sys.stderr.writelines(diff)


def check_schema(output_path: Path) -> None:
    current_schema = render_schema()
    with tempfile.TemporaryDirectory(prefix="mt-engine-openapi-") as tmp_dir:
        current_path = Path(tmp_dir) / "openapi.json"
        current_path.write_text(current_schema, encoding="utf-8")
        if output_path.exists() and filecmp.cmp(output_path, current_path, shallow=False):
            print(f"{output_path.relative_to(ROOT)} is up to date")
            return

    if not output_path.exists():
        print(f"{output_path.relative_to(ROOT)} does not exist", file=sys.stderr)
        raise SystemExit(1)

    expected_schema = output_path.read_text(encoding="utf-8")
    print(
        f"{output_path.relative_to(ROOT)} is stale; run scripts/export-openapi.py to regenerate it.",
        file=sys.stderr,
    )
    print_diff(expected_schema, current_schema)
    raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if openapi.json does not match the current FastAPI schema.",
    )
    args = parser.parse_args()

    output_path = ROOT / "openapi.json"
    if args.check:
        check_schema(output_path)
        return

    output_path.write_text(render_schema(), encoding="utf-8")
    print(f"Wrote {output_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
