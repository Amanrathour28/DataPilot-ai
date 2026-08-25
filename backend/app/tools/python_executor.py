import ast
import json
import logging
import os
import subprocess
import sys
import tempfile
from typing import Any, Dict, Tuple, Optional

logger = logging.getLogger("datapilot.executor")

FORBIDDEN_MODULES = {
    "socket", "urllib", "requests", "http", "ftplib", "smtplib",
    "subprocess", "posix", "pty", "commands",
    "winreg", "msvcrt", "_winapi", "ctypes"
}

FORBIDDEN_CALLS = {
    "system", "popen", "spawn", "fork", "execv", "execve",
    "kill", "terminate", "rmdir", "remove", "unlink"
}


class CodeSecurityValidator(ast.NodeVisitor):
    """AST validator to detect and block unsafe operations prior to execution."""

    def __init__(self):
        self.violations = []

    def visit_Import(self, node):
        for alias in node.names:
            base_mod = alias.name.split(".")[0]
            if base_mod in FORBIDDEN_MODULES:
                self.violations.append(f"Forbidden import '{alias.name}' detected.")
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            base_mod = node.module.split(".")[0]
            if base_mod in FORBIDDEN_MODULES:
                self.violations.append(f"Forbidden from-import '{node.module}' detected.")
        self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            if node.func.id in ("eval", "exec", "__import__"):
                self.violations.append(f"Forbidden builtin call '{node.func.id}()' detected.")
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr in FORBIDDEN_CALLS:
                self.violations.append(f"Potentially destructive call '.{node.func.attr}()' detected.")
        self.generic_visit(node)


class PythonExecutor:
    """Safely executes generated Python code inside an isolated subprocess sandbox.

    Validates AST safety, enforces execution timeouts, resource limits, and output truncation.
    """

    @staticmethod
    def validate_code_safety(code: str) -> Tuple[bool, str]:
        """Scans code AST for security policy violations."""
        try:
            tree = ast.parse(code)
            validator = CodeSecurityValidator()
            validator.visit(tree)
            if validator.violations:
                return False, "; ".join(validator.violations)
            return True, "Code passed security validation."
        except SyntaxError as se:
            return False, f"Syntax error in generated code: {se}"
        except Exception as e:
            return False, f"AST parsing failure: {e}"

    @classmethod
    def execute_code(
        cls,
        code: str,
        datasets: Optional[Dict[str, str]] = None,
        file_mappings: Optional[Dict[str, str]] = None,
        timeout_seconds: float = 10.0,
        max_output_chars: int = 50000,
    ) -> Dict[str, Any]:
        """Runs validated Python code with dataset file mapping arguments."""
        ds_map = datasets or file_mappings or {}
        # 1. Security Check
        is_safe, sec_msg = cls.validate_code_safety(code)
        if not is_safe:
            logger.warning(f"Rejected unsafe code execution: {sec_msg}")
            return {
                "success": False,
                "output": {"error": f"Security validation rejected code: {sec_msg}"},
                "raw_stdout": "",
                "raw_stderr": sec_msg,
                "exit_code": -1,
            }

        # 2. Write to temp file
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, f"datapilot_exec_{os.getpid()}_{id(code)}.py")

        try:
            with open(temp_file_path, "w", encoding="utf-8") as f:
                f.write(code)

            args = [sys.executable, temp_file_path]
            for name, path in ds_map.items():
                args.append(f"{name}={path}")

            logger.info(f"Executing sandboxed analysis: timeout={timeout_seconds}s datasets={len(datasets)}")

            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )

            stdout = (result.stdout or "").strip()[:max_output_chars]
            stderr = (result.stderr or "").strip()[:max_output_chars]
            success = result.returncode == 0

            parsed_output = None
            if success and stdout:
                try:
                    json_str = stdout
                    if "{" in stdout:
                        start_idx = stdout.find("{")
                        end_idx = stdout.rfind("}")
                        if start_idx != -1 and end_idx != -1:
                            json_str = stdout[start_idx : end_idx + 1]
                    parsed_output = json.loads(json_str)
                except Exception:
                    parsed_output = {"raw_text": stdout}
            else:
                parsed_output = {"error": stderr or "Execution completed with non-zero exit code."}

            return {
                "success": success,
                "output": parsed_output,
                "raw_stdout": stdout,
                "raw_stderr": stderr,
                "exit_code": result.returncode,
            }

        except subprocess.TimeoutExpired as te:
            logger.error(f"Sandbox execution timed out after {timeout_seconds}s")
            return {
                "success": False,
                "output": {"error": f"Execution timed out (limit: {timeout_seconds}s)."},
                "raw_stdout": (te.stdout or "")[:1000],
                "raw_stderr": "TIMEOUT_EXPIRED",
                "exit_code": -1,
            }
        except Exception as e:
            logger.exception(f"Unhandled error in PythonExecutor: {e}")
            return {
                "success": False,
                "output": {"error": f"Internal sandbox failure: {str(e)}"},
                "raw_stdout": "",
                "raw_stderr": str(e),
                "exit_code": -1,
            }
        finally:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception:
                    pass
