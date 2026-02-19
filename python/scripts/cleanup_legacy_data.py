"""Cleanup legacy ValueCell data files after storage path migration.

Usage:
    uv run python scripts/cleanup_legacy_data.py --dry-run
    uv run python scripts/cleanup_legacy_data.py
"""

from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from valuecell.utils.db import resolve_db_path, resolve_lancedb_uri
from valuecell.utils.env import get_system_env_dir


@dataclass
class CleanupAction:
    source: Path
    backup: Path
    should_delete: bool


def _legacy_db_paths() -> list[Path]:
    legacy_db = Path(get_system_env_dir()) / "valuecell.db"
    return [
        legacy_db,
        legacy_db.with_suffix(".db-wal"),
        legacy_db.with_suffix(".db-shm"),
        legacy_db.with_suffix(".db-journal"),
    ]


def _collect_actions() -> list[CleanupAction]:
    actions: list[CleanupAction] = []

    active_db = Path(resolve_db_path())
    active_lancedb = Path(resolve_lancedb_uri())

    legacy_base = Path(get_system_env_dir())
    backup_root = active_db.parent / "backups" / datetime.now().strftime("%Y%m%d_%H%M%S")

    if active_db.exists():
        for legacy_file in _legacy_db_paths():
            if legacy_file.exists() and legacy_file != active_db:
                backup_target = backup_root / "legacy_db" / legacy_file.name
                actions.append(
                    CleanupAction(
                        source=legacy_file,
                        backup=backup_target,
                        should_delete=True,
                    )
                )

    legacy_lancedb = legacy_base / "lancedb"
    if (
        legacy_lancedb.exists()
        and legacy_lancedb != active_lancedb
        and active_lancedb.exists()
        and any(active_lancedb.iterdir())
    ):
        actions.append(
            CleanupAction(
                source=legacy_lancedb,
                backup=backup_root / "legacy_lancedb",
                should_delete=True,
            )
        )

    return actions


def _run(actions: list[CleanupAction], dry_run: bool) -> None:
    if not actions:
        print("No legacy files found that require cleanup.")
        return

    print(f"Found {len(actions)} cleanup actions.")
    for action in actions:
        print(f"- {action.source} -> backup: {action.backup}")

    if dry_run:
        print("Dry-run mode enabled. No files were modified.")
        return

    for action in actions:
        action.backup.parent.mkdir(parents=True, exist_ok=True)
        if action.source.is_dir():
            shutil.copytree(action.source, action.backup, dirs_exist_ok=True)
            if action.should_delete:
                shutil.rmtree(action.source)
        else:
            shutil.copy2(action.source, action.backup)
            if action.should_delete:
                action.source.unlink(missing_ok=True)

    print("Legacy cleanup completed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Cleanup legacy ValueCell data files")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview cleanup actions without changing any files",
    )
    args = parser.parse_args()

    actions = _collect_actions()
    _run(actions, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
