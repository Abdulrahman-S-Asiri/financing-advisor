"""Input validation helpers shared by all MCP tools.

Every tool input is validated before any work happens. Errors name the valid
range or set so the calling model can self-correct without a retry loop.
"""
from __future__ import annotations


def require_number(name: str, value: float, lo: float, hi: float) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{name} must be a number.")
    if not (lo <= value <= hi):
        raise ValueError(f"{name} must be between {lo:,g} and {hi:,g} (got {value:,g}).")
    return float(value)


def require_int(name: str, value: int, lo: int, hi: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} must be an integer.")
    if not (lo <= value <= hi):
        raise ValueError(f"{name} must be between {lo} and {hi} (got {value}).")
    return value


def require_choice(name: str, value: str, choices: tuple[str, ...]) -> str:
    if value not in choices:
        raise ValueError(f"{name} must be one of: {', '.join(sorted(choices))} (got {value!r}).")
    return value


def require_text(name: str, value: str, min_len: int = 1, max_len: int = 200) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string.")
    stripped = value.strip()
    if not (min_len <= len(stripped) <= max_len):
        raise ValueError(
            f"{name} must be {min_len}-{max_len} characters after trimming "
            f"(got {len(stripped)})."
        )
    return stripped
