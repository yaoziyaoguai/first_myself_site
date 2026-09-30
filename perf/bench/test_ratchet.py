import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("ratchet.py")
METRICS = {
    "ttfb_ms": 100.0,
    "usable_ms": 200.0,
    "full_load_ms": 400.0,
    "requests_started": 8.0,
    "encoded_bytes": 12000.0,
}


def result_payload():
    def version(app_sha, multiplier=1.0):
        summary = {
            "n": 10,
            "n_ok": 10,
            "complete": 10,
            "acceptance_valid": True,
        }
        for metric, value in METRICS.items():
            summary[metric] = {
                "p50": value * multiplier,
                "p75": value * multiplier,
                "p95": value * multiplier,
            }
        return {
            "url": "http://127.0.0.1:3200/blog/article",
            "app_sha": app_sha,
            "functional": {"ok": True, "skipped": True},
            "summary": summary,
        }

    return {
        "protocol_version": "perf-v2",
        "tool_sha": "tool-v2",
        "fixture": {"id": "fixture-v1", "hash": "fixture-hash"},
        "environment": {"environment_id": "environment-v1"},
        "results": {
            "A": version("baseline-sha"),
            "B": version("candidate-sha", 0.95),
        },
    }


class RatchetTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.result = self.root / "result.json"
        self.ceilings = self.root / "ceilings.json"
        self.write_result(result_payload())

    def tearDown(self):
        self.temp.cleanup()

    def write_result(self, value):
        self.result.write_text(json.dumps(value), encoding="utf-8")

    def run_ratchet(self, action, version, *extra):
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                action,
                "--result",
                str(self.result),
                "--ceilings",
                str(self.ceilings),
                "--version",
                version,
                *extra,
            ],
            check=False,
            capture_output=True,
            text=True,
        )

    def initialize(self):
        completed = self.run_ratchet("init", "A")
        self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_check_is_read_only_and_explicitly_checks_candidate(self):
        self.initialize()
        before = hashlib.sha256(self.ceilings.read_bytes()).hexdigest()
        completed = self.run_ratchet(
            "check",
            "B",
            "--expected-app-sha",
            "candidate-sha",
        )
        after = hashlib.sha256(self.ceilings.read_bytes()).hexdigest()
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(before, after)

    def test_requires_explicit_expected_candidate_sha(self):
        self.initialize()
        completed = self.run_ratchet("check", "B")
        self.assertEqual(completed.returncode, 2)
        self.assertIn("--expected-app-sha", completed.stderr)

    def test_rejects_missing_version_and_old_protocol(self):
        self.initialize()
        missing = self.run_ratchet(
            "check",
            "C",
            "--expected-app-sha",
            "candidate-sha",
        )
        self.assertEqual(missing.returncode, 2)
        payload = result_payload()
        payload["protocol_version"] = "perf-v1"
        self.write_result(payload)
        old = self.run_ratchet(
            "check",
            "B",
            "--expected-app-sha",
            "candidate-sha",
        )
        self.assertEqual(old.returncode, 2)

    def test_rejects_fixture_environment_and_tool_mismatch(self):
        self.initialize()
        for path, replacement in [
            (("fixture", "hash"), "different-fixture"),
            (("environment", "environment_id"), "different-environment"),
            (("tool_sha",), "different-tool"),
        ]:
            payload = result_payload()
            target = payload
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = replacement
            self.write_result(payload)
            completed = self.run_ratchet(
                "check",
                "B",
                "--expected-app-sha",
                "candidate-sha",
            )
            self.assertEqual(completed.returncode, 2, completed.stdout)

    def test_rejects_partial_or_insufficient_batches(self):
        self.initialize()
        for patch in [
            {"n": 9, "n_ok": 9, "complete": 9},
            {"n": 10, "n_ok": 9, "complete": 9},
            {"n": 10, "n_ok": 10, "complete": 9},
        ]:
            payload = result_payload()
            payload["results"]["B"]["summary"].update(patch)
            self.write_result(payload)
            completed = self.run_ratchet(
                "check",
                "B",
                "--expected-app-sha",
                "candidate-sha",
            )
            self.assertEqual(completed.returncode, 2)

    def test_rejects_null_zero_nan_and_infinity(self):
        self.initialize()
        for invalid in [None, 0, float("nan"), float("inf")]:
            payload = result_payload()
            payload["results"]["B"]["summary"]["usable_ms"]["p75"] = invalid
            self.write_result(payload)
            completed = self.run_ratchet(
                "check",
                "B",
                "--expected-app-sha",
                "candidate-sha",
            )
            self.assertEqual(completed.returncode, 2)

    def test_request_regression_has_zero_tolerance(self):
        self.initialize()
        payload = result_payload()
        payload["results"]["B"]["summary"]["requests_started"]["p75"] = 9
        self.write_result(payload)
        completed = self.run_ratchet(
            "check",
            "B",
            "--expected-app-sha",
            "candidate-sha",
        )
        self.assertEqual(completed.returncode, 1)

    def test_only_explicit_update_baseline_can_replace_existing_values(self):
        self.initialize()
        duplicate = self.run_ratchet("init", "A")
        self.assertEqual(duplicate.returncode, 2)
        payload = result_payload()
        payload["results"]["A"]["summary"]["usable_ms"]["p75"] = 180
        self.write_result(payload)
        updated = self.run_ratchet("update-baseline", "A")
        self.assertEqual(updated.returncode, 0, updated.stderr)
        data = json.loads(self.ceilings.read_text(encoding="utf-8"))
        key = "http://127.0.0.1:3200/blog/article::usable_ms_p75"
        self.assertEqual(data["entries"][key]["baseline_value"], 180)


if __name__ == "__main__":
    unittest.main()
