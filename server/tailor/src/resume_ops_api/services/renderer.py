from __future__ import annotations

import asyncio
import json
import os
import shutil
from pathlib import Path

from resume_ops_api.core.exceptions import AppError


# Themes rendered by the bundled folio exporter. Any other allowed theme is
# rendered with `resumed export --theme <name>`, which resolves the theme as
# a Node package (bundled, or user-installed under /data/themes).
FOLIO_EXPORTER_THEMES = frozenset(
    {
        "jsonresume-theme-folio",
        "jsonresume-theme-folio-concise",
    }
)

# `resumed` is pure ESM, and Node.js ignores NODE_PATH for `import()`, so a
# theme installed only under these directories would fail to load by bare
# name. Resolve such themes to an absolute file URL instead; anything else
# is passed through for normal node_modules resolution (global install or
# the packaged node-tools bundle).
USER_THEME_PATHS = (
    Path("/data/themes/node_modules"),
    Path.home() / ".npm-global" / "lib" / "node_modules",
)


def _resolve_theme_spec(theme: str, search_paths: tuple[Path, ...] = USER_THEME_PATHS) -> str:
    for base in search_paths:
        package_json = base / theme / "package.json"
        if not package_json.is_file():
            continue
        try:
            manifest = json.loads(package_json.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        entry = _package_entry_point(base / theme, manifest)
        if entry is not None:
            return entry.as_uri()
    return theme


def _package_entry_point(package_dir: Path, manifest: dict) -> Path | None:
    exports = manifest.get("exports")
    candidate: str | None = None
    if isinstance(exports, str):
        candidate = exports
    elif isinstance(exports, dict):
        dot = exports.get(".")
        if isinstance(dot, str):
            candidate = dot
        elif isinstance(dot, dict):
            candidate = dot.get("import") or dot.get("default")
    if candidate is None and isinstance(manifest.get("main"), str):
        candidate = manifest["main"]
    if candidate is None:
        index_js = package_dir / "index.js"
        return index_js if index_js.is_file() else None
    entry = (package_dir / candidate).resolve()
    return entry if entry.is_file() else None


class ResumeRenderer:
    def __init__(
        self,
        binary: str = "folio-export",
        resumed_binary: str = "resumed",
        theme_search_paths: tuple[Path, ...] = USER_THEME_PATHS,
    ) -> None:
        self.binary = binary
        self.resumed_binary = resumed_binary
        self.theme_search_paths = theme_search_paths

    def _resolve_binary(self, name: str | None = None) -> str:
        # If binary is just a name, try to find it in PATH
        # including common local npm paths if not found
        target = name or self.binary
        resolved = shutil.which(target)
        if resolved:
            return resolved

        # Check common local npm path if not in system path
        local_npm = Path.home() / ".npm-global" / "bin" / target
        if local_npm.exists():
            return str(local_npm)

        return target

    async def render(self, *, resume: dict, theme: str, output_dir: Path) -> Path:
        use_folio_exporter = theme in FOLIO_EXPORTER_THEMES
        binary = self._resolve_binary() if use_folio_exporter else self._resolve_binary(self.resumed_binary)
        output_dir.mkdir(parents=True, exist_ok=True)
        input_path = output_dir / "resume.json"
        pdf_path = output_dir / "output.pdf"
        input_path.write_text(json.dumps(resume, ensure_ascii=True, indent=2), encoding="utf-8")

        env = os.environ.copy()
        extra_paths = ["/data/themes/node_modules", str(Path.home() / ".npm-global" / "lib" / "node_modules")]
        existing_node_path = env.get("NODE_PATH", "")
        paths = [p for p in extra_paths + existing_node_path.split(":") if p]
        env["NODE_PATH"] = ":".join(dict.fromkeys(paths))

        if use_folio_exporter:
            meta = resume.get("meta") if isinstance(resume.get("meta"), dict) else {}
            is_multi_page = bool(meta.get("multiPage", False) or (meta.get("singlePage") is False))
            page_flag = "--multi-page" if is_multi_page else "--single-page"

            argv = [
                binary,
                str(input_path),
                str(pdf_path),
                page_flag,
                "--puppeteer-arg=--no-sandbox",
                "--puppeteer-arg=--disable-setuid-sandbox",
            ]
        else:
            # `resumed` has no single/multi-page flags; themes paginate from
            # the resume meta. Keep the puppeteer sandbox flags identical.
            # The theme spec is resolved to a file URL when it lives in a
            # user theme directory that ESM `import()` cannot see via NODE_PATH.
            theme_spec = _resolve_theme_spec(theme, self.theme_search_paths)
            argv = [
                binary,
                "export",
                str(input_path),
                "-o",
                str(pdf_path),
                "--theme",
                theme_spec,
                "--puppeteer-arg=--no-sandbox",
                "--puppeteer-arg=--disable-setuid-sandbox",
            ]

        process = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0:
            raise AppError(
                "PDF rendering failed.",
                code="render_failed",
                status_code=500,
                details={"stderr": stderr.decode("utf-8", errors="ignore")},
            )
        header = pdf_path.read_bytes()[:5]
        if header != b"%PDF-":
            raise AppError(
                "Renderer output was not a valid PDF.",
                code="invalid_pdf_output",
                status_code=500,
                details={"output_path": str(pdf_path)},
            )
        return pdf_path
