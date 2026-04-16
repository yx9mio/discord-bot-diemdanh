"""
JSON storage helper for attendance bot.
"""
import json
import os
from pathlib import Path
from threading import Lock
from datetime import datetime

STORAGE_PATH = Path(__file__).parent / "data" / "sessions.json"


def _ensure_storage():
    """Ensure data directory exists."""
    STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not STORAGE_PATH.exists():
        _save({})


def _load() -> dict:
    """Load sessions from JSON file."""
    _ensure_storage()
    try:
        with open(STORAGE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def _save(data: dict):
    """Save sessions to JSON file."""
    STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STORAGE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


_storage_lock = Lock()


class SessionStore:
    """Thread-safe session storage using JSON file."""

    @classmethod
    def get(cls, gid: int) -> dict | None:
        """Get session by guild ID."""
        with _storage_lock:
            data = _load()
            return data.get(str(gid))

    @classmethod
    def set(cls, gid: int, session: dict):
        """Create or update session."""
        with _storage_lock:
            data = _load()
            data[str(gid)] = session
            _save(data)

    @classmethod
    def delete(cls, gid: int):
        """Delete session by guild ID."""
        with _storage_lock:
            data = _load()
            data.pop(str(gid), None)
            _save(data)

    @classmethod
    def all(cls) -> dict:
        """Get all sessions."""
        with _storage_lock:
            return _load()
