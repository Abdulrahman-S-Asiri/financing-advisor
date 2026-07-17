"""Test process isolation from local private environment files."""
from __future__ import annotations

import os


os.environ.setdefault("PYTHON_DOTENV_DISABLED", "1")
