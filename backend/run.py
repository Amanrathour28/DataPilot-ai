#!/usr/bin/env python3
"""DataPilot AI — Backend Runner Script.

Automatically executes FastAPI backend using the project's virtual environment (venv).
"""

import os
import sys
import subprocess
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
VENV_DIR = BACKEND_DIR / "venv"

if sys.platform == "win32":
    PYTHON_VENV = VENV_DIR / "Scripts" / "python.exe"
    UVICORN_VENV = VENV_DIR / "Scripts" / "uvicorn.exe"
else:
    PYTHON_VENV = VENV_DIR / "bin" / "python"
    UVICORN_VENV = VENV_DIR / "bin" / "uvicorn"


def main():
    if not VENV_DIR.exists():
        print(f"Creating virtual environment at {VENV_DIR}...")
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
        print("Installing requirements into virtual environment...")
        subprocess.run([str(PYTHON_VENV), "-m", "pip", "install", "-r", "requirements.txt"], check=True)
        subprocess.run([str(PYTHON_VENV), "-m", "pip", "install", "aiosqlite"], check=True)

    print("Starting DataPilot AI Backend (using venv)...")
    os.chdir(BACKEND_DIR)
    
    cmd = [str(UVICORN_VENV), "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\nBackend stopped.")

if __name__ == "__main__":
    main()
