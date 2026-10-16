#!/usr/bin/env python3
"""Validate the exact installable release and deterministic package generation."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile
root = Path(__file__).resolve().parents[1]
def build():
    subprocess.run([sys.executable, "tools/build_release.py"], cwd=root, check=True, capture_output=True)
    return {name: (root / "dist" / name).read_bytes() for name in ("piratez-manager.zip", "release.json", "SHA256SUMS")}
first = build()
assert first == build(), "Rebuilding changed release artifacts"
manifest = json.loads(first["release.json"])
assert hashlib.sha256(first["piratez-manager.zip"]).hexdigest() == manifest["sha256"]
with zipfile.ZipFile(root / "dist/piratez-manager.zip") as package:
    names = package.namelist()
    assert "piratez-manager/piratez-manager.php" in names
    for entry in package.infolist():
        parts = Path(entry.filename).parts
        assert parts[0] == "piratez-manager"
        assert not any(p.startswith(".") or p in ("tests", "tools", "dist", "node_modules") for p in parts)
        assert (entry.external_attr >> 16) & 0o777 == 0o644
print("PASS: deterministic runtime-only ZIP, fixed root, permissions and SHA-256 manifest")
