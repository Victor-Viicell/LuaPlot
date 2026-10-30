#!/usr/bin/env python3
"""Deploy the built LuaPlot web bundle to Vercel through the Hermes Vercel connector.

Reads dist/, builds the file tree, and calls the connector tool in-process so the
payload never has to be emitted through the chat/tool-call channel.

Usage: deploy.py [--target production|preview] [--name luaplot] [--dir dist] [--verify]
Prints DEPLOY_URL=<url> and the production alias on success.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.request

HERMES = os.path.expanduser("~/.hermes/hermes-agent")
sys.path.insert(0, HERMES)

PROD_ALIAS = "luaplot-viicell.vercel.app"


def collect(root: str):
    files = []
    for dirpath, _, fnames in os.walk(root):
        for fn in sorted(fnames):
            p = os.path.join(dirpath, fn)
            rel = os.path.relpath(p, root).replace(os.sep, "/")
            raw = open(p, "rb").read()
            try:
                files.append({"file": rel, "data": raw.decode("utf-8"), "encoding": "utf-8"})
            except UnicodeDecodeError:
                files.append({"file": rel, "data": base64.b64encode(raw).decode(), "encoding": "base64"})
    return files


def unwrap(result):
    """Pull the connector's text payload (the string carrying the deployment lines)."""
    node = result
    # The dispatch layer returns a JSON string; inner payloads may be escaped again.
    for _ in range(4):
        if isinstance(node, str):
            try:
                node = json.loads(node)
                continue
            except Exception:
                return node
        break

    found = []

    def walk(n):
        if isinstance(n, str):
            found.append(n)
        elif isinstance(n, dict):
            for v in n.values():
                walk(v)
        elif isinstance(n, (list, tuple)):
            for v in n:
                walk(v)

    walk(node)
    for s in found:
        if "Deployment" in s or "URL:" in s:
            return s
    return found[0] if found else json.dumps(result)


def wait_live(url: str, timeout: int = 120) -> str | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                if r.status == 200:
                    return url
        except Exception:
            pass
        time.sleep(5)
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="dist")
    ap.add_argument("--name", default="luaplot")
    ap.add_argument("--target", default="production", choices=["production", "preview"])
    ap.add_argument("--verify", action="store_true", help="wait until the URL answers 200")
    args = ap.parse_args()

    if not os.path.isdir(args.dir):
        print(f"deploy: {args.dir} missing — run `bun run build` first", file=sys.stderr)
        return 2

    files = collect(args.dir)
    if not any(f["file"] == "index.html" for f in files):
        print("deploy: no index.html at the root of the deploy dir", file=sys.stderr)
        return 2

    from tools.connectors.dispatch import dispatch_connector_call

    arguments = {
        "name": args.name,
        "target": args.target,
        "files": files,
        "projectSettings": {"framework": None, "outputDirectory": "."},
    }
    text = unwrap(dispatch_connector_call(
        "connectors__vercel_mcp__DEPLOY_TO_VERCEL", arguments, "luaplot-deploy"
    ))

    url = None
    dep_id = None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("URL:"):
            url = s.split("URL:", 1)[1].strip()
        if s.startswith("Deployment id:"):
            dep_id = s.split("Deployment id:", 1)[1].strip()
    if not url:
        print("deploy: FAILED\n" + text, file=sys.stderr)
        return 1

    print(f"DEPLOY_URL={url}")
    print(f"DEPLOY_ID={dep_id or '?'}")
    print(f"TARGET={args.target}")
    live = url
    if args.target == "production":
        live = f"https://{PROD_ALIAS}"
        print(f"PROD_ALIAS={live}")
    if args.verify:
        ok = wait_live(live if args.target == "production" else url)
        if ok:
            print(f"VERIFIED={ok}")
        else:
            print(f"VERIFY_FAILED={live}", file=sys.stderr)
            return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
