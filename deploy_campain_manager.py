#!/usr/bin/env python3
"""Deploy Campaign Manager from Windows/macOS/Linux to a Linux server.

Configure the DEPLOY_* values below or set the matching environment variables.
The server must have SSH, Python3, Node.js/npm, PostgreSQL and unzip installed.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
SSH_HOST = os.getenv("DEPLOY_SSH_HOST", "194.60.230.179")
SSH_USER = os.getenv("DEPLOY_SSH_USER", "root")
REMOTE_DIR = os.getenv("DEPLOY_REMOTE_DIR", "/var/www/campain-manager")
SSH_PORT = os.getenv("DEPLOY_SSH_PORT", "9011")
SSH_KEY = os.getenv("DEPLOY_SSH_KEY", "")
PUBLIC_DOMAIN = os.getenv("DEPLOY_DOMAIN", "campain.auto-channel.ir")

EXCLUDED = {
    ".git", ".next", "node_modules", "test-results", "playwright-report",
    "__pycache__", ".env", "apps/api/.env", "apps/web/.env.local",
}


def command(program: str, *args: str) -> list[str]:
    result = [program]
    if SSH_PORT != "22":
        result += ["-P" if program == "scp" else "-p", SSH_PORT]
    if SSH_KEY:
        result += ["-i", SSH_KEY]
    return result + list(args)


def run(args: list[str], *, input_text: str | None = None) -> None:
    print(">>>", " ".join(args), flush=True)
    if input_text is not None:
        # Send LF-only UTF-8 bytes; otherwise Windows may convert the bash
        # script to CRLF and bash can report misleading syntax errors.
        subprocess.run(
            args,
            input=input_text.replace("\r\n", "\n").encode("utf-8"),
            check=True,
        )
    else:
        subprocess.run(args, check=True)


def ssh(script: str) -> None:
    run(command("ssh", f"{SSH_USER}@{SSH_HOST}", "bash", "-s"), input_text=script)


def make_archive(target: Path) -> None:
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in PROJECT_DIR.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(PROJECT_DIR).as_posix()
            parts = relative.split("/")
            if any(
                relative == excluded
                or relative.startswith(excluded + "/")
                or excluded in parts
                for excluded in EXCLUDED
            ):
                continue
            archive.write(path, relative)


def deploy(*, skip_build: bool = False, skip_migrate: bool = False) -> None:
    if shutil.which("ssh") is None or shutil.which("scp") is None:
        raise SystemExit("ابزارهای ssh و scp باید روی سیستم شما نصب و در PATH باشند.")

    with tempfile.TemporaryDirectory(prefix="campaign-deploy-") as temp:
        archive = Path(temp) / "release.zip"
        make_archive(archive)
        remote_archive = f"/tmp/campain-manager-{os.getpid()}.zip"
        print(f"Uploading project to {SSH_USER}@{SSH_HOST}:{REMOTE_DIR}")
        print(f"Public domain: https://{PUBLIC_DOMAIN}")
        run(command("scp", str(archive), f"{SSH_USER}@{SSH_HOST}:{remote_archive}"))

        steps = [
            "set -e",
            f"mkdir -p {REMOTE_DIR}",
            f"unzip -oq {remote_archive} -d {REMOTE_DIR}",
            f"rm -f {remote_archive}",
            f"cd {REMOTE_DIR}",
            "test -f apps/api/.env || { echo 'ERROR: apps/api/.env روی سرور وجود ندارد؛ آن را بسازید.'; exit 1; }",
            "npm config set registry https://registry.npmjs.org/",
            "find . -name package-lock.json -type f -exec sed -i 's#https://mirror-npm.runflare.com/#https://registry.npmjs.org/#g' {} +",
            "npm install --no-audit --no-fund",
            "npm install --prefix apps/api --no-audit --no-fund",
            "npm install --prefix apps/web --no-audit --no-fund",
            "npm --prefix apps/api run prisma:generate",
        ]
        if not skip_migrate:
            steps.append("cd apps/api && npx prisma migrate deploy && cd ../..")
        if not skip_build:
            steps += ["npm run build:api", "npm run build:web"]
        steps += [
            "systemctl daemon-reload || true",
            "systemctl restart campain-manager-api || true",
            "systemctl restart campain-manager-web || true",
            "curl -fsS http://127.0.0.1:${API_PORT:-4000}/health >/dev/null",
            "echo 'DEPLOY OK'",
        ]
        ssh("\n".join(steps) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy Campaign Manager to a Linux server")
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--skip-migrate", action="store_true")
    parser.add_argument("--check-only", action="store_true", help="only test SSH connection")
    args = parser.parse_args()
    if args.check_only:
        ssh("set -e; echo SSH_OK; test -d /var/www || true\n")
    else:
        deploy(skip_build=args.skip_build, skip_migrate=args.skip_migrate)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"Deployment failed with exit code {exc.returncode}") from exc
