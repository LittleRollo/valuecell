import os
import shutil
from pathlib import Path

from .env import get_system_env_dir
from .path import get_repo_root_path


def resolve_default_data_dir() -> Path:
    """Resolve default application data directory for persistent storage.

    Resolution order:
    1) `VALUECELL_DATA_DIR` environment variable
    2) Windows: `D:/ValueCell/data`
    3) Other OS: system app config directory (same base as `.env`)
    """
    configured_dir = os.environ.get("VALUECELL_DATA_DIR")
    if configured_dir:
        return Path(configured_dir).expanduser()

    if os.name == "nt":
        return Path("D:/ValueCell/data")

    return Path(get_system_env_dir())


def _strip_sqlite_prefix(url_or_path: str) -> str:
    """Normalize a potential SQLite DSN to a filesystem path.

    - If `url_or_path` starts with `sqlite:///`, return the stripped path portion.
    - Otherwise, return it unchanged.
    """
    if url_or_path.startswith("sqlite:///"):
        return url_or_path.replace("sqlite:///", "", 1)
    return url_or_path


def _legacy_db_path() -> Path:
    return Path(get_system_env_dir()) / "valuecell.db"


def _move_if_exists(src: Path, dst: Path) -> None:
    if not src.exists() or dst.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))


def _migrate_legacy_db_files(target_db_path: Path) -> None:
    legacy_db_path = _legacy_db_path()
    if target_db_path.exists() or legacy_db_path == target_db_path:
        return

    _move_if_exists(legacy_db_path, target_db_path)
    _move_if_exists(legacy_db_path.with_suffix(".db-wal"), target_db_path.with_suffix(".db-wal"))
    _move_if_exists(legacy_db_path.with_suffix(".db-shm"), target_db_path.with_suffix(".db-shm"))
    _move_if_exists(legacy_db_path.with_suffix(".db-journal"), target_db_path.with_suffix(".db-journal"))


def resolve_db_path() -> str:
    """Resolve the SQLite database file path used by conversation stores.

    Resolution order:
    1) `DATABASE_URL` env var (if starts with `sqlite:///`, strip to path; otherwise ignore)
    2) Default to system application directory (e.g., `~/Library/Application Support/ValueCell/valuecell.db` on macOS)

    Note: This function returns a filesystem path, not a SQLAlchemy DSN.
    """
    # Prefer VALUECELL_DATABASE_URL if it points to SQLite
    db_url = os.environ.get("VALUECELL_DATABASE_URL")
    if db_url and db_url.startswith("sqlite:///"):
        db_path = Path(_strip_sqlite_prefix(db_url))
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return str(db_path)

    default_db_path = resolve_default_data_dir() / "valuecell.db"
    try:
        _migrate_legacy_db_files(default_db_path)
    except Exception:
        pass
    default_db_path.parent.mkdir(parents=True, exist_ok=True)
    return str(default_db_path)


def resolve_lancedb_uri() -> str:
    """Resolve LanceDB directory path.

    Resolution order:
    1) Default to system application directory: `<system_env_dir>/lancedb`

    Additionally, if an old repo-root `lancedb` directory exists and the new
    system directory does not, migrate the contents once for continuity.
    """
    # Default: use application data directory
    new_path = resolve_default_data_dir() / "lancedb"
    new_path.mkdir(parents=True, exist_ok=True)

    # Migrate from old locations if needed
    old_path = Path(get_repo_root_path()) / "lancedb"
    legacy_system_path = Path(get_system_env_dir()) / "lancedb"
    try:
        if not any(new_path.iterdir()):
            migration_source = None
            if legacy_system_path.exists() and any(legacy_system_path.iterdir()):
                migration_source = legacy_system_path
            elif old_path.exists() and any(old_path.iterdir()):
                migration_source = old_path

            if migration_source is not None:
                for item in migration_source.iterdir():
                    src = item
                    dst = new_path / item.name
                    if item.is_dir():
                        shutil.copytree(src, dst, dirs_exist_ok=True)
                    else:
                        shutil.copy2(src, dst)
    except Exception:
        # Non-fatal: if migration fails, just proceed with new_path
        pass

    return str(new_path)
