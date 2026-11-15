#!/usr/bin/env python3
"""Deploy dist/ to Cloudflare Pages via cf-publish, using the registered
custom.cloudflare credential through its hsurr: surrogate.

The surrogate is never printed or written to disk; it is passed only as an
environment variable to the cf-publish subprocess, and the runtime swaps it
for the real token on requests to api.cloudflare.com.
"""
import os
import subprocess
import sys

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import dynamic_credential_entry  # noqa: E402

ACCOUNT_ID = "d344e0fa6a2fd656baf5c1241790387e"


def main() -> int:
    entry = dynamic_credential_entry("custom.cloudflare", "access_token")
    env = dict(os.environ)
    env["CLOUDFLARE_API_TOKEN"] = entry["surrogate"]
    env["CLOUDFLARE_ACCOUNT_ID"] = ACCOUNT_ID
    # httpx 1.x mis-parses NO_PROXY's "[::1]" entry into the invalid
    # URLPattern "all://*[::1]" (Invalid port ':1]'). Keep the egress proxy
    # vars (direct TLS fails without them) but drop the bracketed entry.
    env["NO_PROXY"] = "localhost,127.0.0.1,::1,198.19.0.1,198.19.0.2"
    env["no_proxy"] = env["NO_PROXY"]
    cmd = [
        os.path.expanduser("~/workspace/cfvenv/bin/cf-publish"),
        "dist",
        "--project",
        "neon-jump",
        "--json",
    ]
    result = subprocess.run(cmd, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), env=env)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
