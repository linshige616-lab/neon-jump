#!/usr/bin/env python3
"""Push one local file to the GitHub repo via the MCP create_or_update_file
tool (PUT /contents), which works where the push_files git/trees API 403s.

Usage: push-one.py <repo-path> [sha] [message]
  repo-path: path inside the repo, e.g. src/main.js
  sha:       blob SHA when updating an existing file (omit for new files)
  message:   commit message (default: per-file message)
Reads content from ~/workspace/neon-jump/<repo-path>.
"""
import json
import subprocess
import sys

ROOT = "/home/hatch/workspace/neon-jump"
OWNER = "linshige616-lab"
REPO = "neon-jump"
BRANCH = "main"


def main() -> int:
    path = sys.argv[1]
    sha = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "-" else None
    message = sys.argv[3] if len(sys.argv) > 3 else f"Add {path}"
    with open(f"{ROOT}/{path}", encoding="utf-8") as f:
        content = f.read()
    args = {
        "owner": OWNER,
        "repo": REPO,
        "branch": BRANCH,
        "path": path,
        "content": content,
        "message": message,
    }
    if sha:
        args["sha"] = sha
    result = subprocess.run(
        ["/opt/hatch/bin/github", "call-tool", "--name", "create_or_update_file",
         "--arguments-json", json.dumps(args, ensure_ascii=False)],
        capture_output=True, text=True, timeout=120,
    )
    print(result.stdout[-2000:])
    print(result.stderr[-500:], file=sys.stderr)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
