#!/usr/bin/env python3
"""perf-v2 性能棘轮。

check 永远只读；只有 init 和 update-baseline 会写 ceilings。输入必须是完整、
同协议、同 fixture、同工具和同环境的批次，候选 SHA 也必须由调用者明确指定。
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import tempfile
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "perf-v2"
DEFAULT_METRICS = [
    "ttfb_ms",
    "usable_ms",
    "full_load_ms",
    "requests_started",
    "encoded_bytes",
]


class ValidationError(ValueError):
    pass


def read_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValidationError(f"{path} 顶层必须是 JSON object")
    return value


def finite_positive(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"{label} 必须是数字")
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise ValidationError(f"{label} 必须是有限正数")
    return number


def validate_result(
    result: dict[str, Any],
    version: str,
    metrics: list[str],
    minimum_samples: int,
    expected_app_sha: str | None,
) -> dict[str, Any]:
    if result.get("protocol_version") != PROTOCOL_VERSION:
        raise ValidationError(
            f"协议必须是 {PROTOCOL_VERSION}，实际为 {result.get('protocol_version')!r}",
        )
    fixture = result.get("fixture")
    environment = result.get("environment")
    if not isinstance(fixture, dict) or not fixture.get("hash"):
        raise ValidationError("结果缺少 fixture.hash")
    if not isinstance(environment, dict) or not environment.get("environment_id"):
        raise ValidationError("结果缺少 environment.environment_id")
    if not result.get("tool_sha"):
        raise ValidationError("结果缺少 tool_sha")
    versions = result.get("results")
    if not isinstance(versions, dict) or version not in versions:
        raise ValidationError(f"结果里没有明确版本 {version}")
    candidate = versions[version]
    if not isinstance(candidate, dict):
        raise ValidationError(f"results.{version} 必须是 object")
    app_sha = candidate.get("app_sha")
    if not isinstance(app_sha, str) or not app_sha or app_sha == "unknown":
        raise ValidationError(f"results.{version}.app_sha 无效")
    if expected_app_sha is not None and app_sha != expected_app_sha:
        raise ValidationError(
            f"候选 SHA 不匹配：期望 {expected_app_sha}，实际 {app_sha}",
        )
    functional = candidate.get("functional")
    if not isinstance(functional, dict) or functional.get("ok") is not True:
        raise ValidationError(f"results.{version}.functional 未通过")
    summary = candidate.get("summary")
    if not isinstance(summary, dict):
        raise ValidationError(f"results.{version}.summary 缺失")
    n = summary.get("n")
    n_ok = summary.get("n_ok")
    complete = summary.get("complete")
    if not isinstance(n, int) or n < minimum_samples:
        raise ValidationError(f"样本数 {n!r} 小于要求 {minimum_samples}")
    if n_ok != n or complete != n or summary.get("acceptance_valid") is not True:
        raise ValidationError(
            f"批次不完整：n={n}, n_ok={n_ok}, complete={complete}",
        )
    values: dict[str, float] = {}
    for metric in metrics:
        metric_summary = summary.get(metric)
        if not isinstance(metric_summary, dict):
            raise ValidationError(f"缺少指标 {metric}")
        values[metric] = finite_positive(
            metric_summary.get("p75"),
            f"{version}.{metric}.p75",
        )
    return {
        "url": candidate.get("url"),
        "app_sha": app_sha,
        "fixture_hash": fixture["hash"],
        "environment_id": environment["environment_id"],
        "tool_sha": result["tool_sha"],
        "values": values,
    }


def policy_for(metric: str, baseline: float) -> dict[str, float]:
    if metric == "requests_started":
        return {"absolute_tolerance": 0.0, "relative_tolerance": 0.0}
    if metric == "encoded_bytes":
        return {"absolute_tolerance": 0.0, "relative_tolerance": 0.05}
    if metric in {"ttfb_ms", "usable_ms", "full_load_ms"}:
        return {"absolute_tolerance": 50.0, "relative_tolerance": 0.10}
    raise ValidationError(f"没有为指标 {metric} 定义容差策略")


def allowed_value(entry: dict[str, Any]) -> float:
    baseline = finite_positive(entry.get("baseline_value"), "baseline_value")
    policy = entry.get("policy")
    if not isinstance(policy, dict):
        raise ValidationError("ceiling entry 缺少 policy")
    absolute = policy.get("absolute_tolerance")
    relative = policy.get("relative_tolerance")
    if not isinstance(absolute, (int, float)) or not isinstance(relative, (int, float)):
        raise ValidationError("ceiling policy 非法")
    return baseline + max(float(absolute), baseline * float(relative))


def entry_key(label: str, metric: str) -> str:
    return f"{label}::{metric}_p75"


def write_json_atomic(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        dir=path.parent,
        text=True,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["init", "update-baseline", "check"])
    parser.add_argument("--result", required=True, type=Path)
    parser.add_argument("--ceilings", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--expected-app-sha", help="check 时必填，防止检查错候选")
    parser.add_argument("--label", help="默认使用结果里的 URL")
    parser.add_argument("--metric", action="append", choices=DEFAULT_METRICS)
    parser.add_argument("--minimum-samples", type=int, default=10)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    metrics = args.metric or DEFAULT_METRICS
    if args.minimum_samples < 1:
        raise ValidationError("--minimum-samples 必须大于 0")
    if args.action == "check" and not args.expected_app_sha:
        raise ValidationError("check 必须提供 --expected-app-sha")

    result = read_json(args.result)
    validated = validate_result(
        result,
        args.version,
        metrics,
        args.minimum_samples,
        args.expected_app_sha if args.action == "check" else None,
    )
    label = args.label or validated["url"]
    if not isinstance(label, str) or not label:
        raise ValidationError("缺少 ceiling label/URL")

    if args.action in {"init", "update-baseline"}:
        if args.ceilings.exists():
            ceilings = read_json(args.ceilings)
            if ceilings.get("protocol_version") != PROTOCOL_VERSION:
                raise ValidationError("不能用 perf-v2 覆盖旧协议 ceilings")
        else:
            ceilings = {"protocol_version": PROTOCOL_VERSION, "entries": {}}
        entries = ceilings.setdefault("entries", {})
        if not isinstance(entries, dict):
            raise ValidationError("ceilings.entries 必须是 object")
        for metric, value in validated["values"].items():
            key = entry_key(label, metric)
            if args.action == "init" and key in entries:
                raise ValidationError(f"{key} 已存在；更新请使用 update-baseline")
            entries[key] = {
                "baseline_value": value,
                "baseline_app_sha": validated["app_sha"],
                "tool_sha": validated["tool_sha"],
                "fixture_hash": validated["fixture_hash"],
                "environment_id": validated["environment_id"],
                "policy": policy_for(metric, value),
            }
            print(f"基线已记录：{key} = {value}")
        write_json_atomic(args.ceilings, ceilings)
        return 0

    ceilings = read_json(args.ceilings)
    if ceilings.get("protocol_version") != PROTOCOL_VERSION:
        raise ValidationError("ceilings 协议不是 perf-v2")
    entries = ceilings.get("entries")
    if not isinstance(entries, dict):
        raise ValidationError("ceilings.entries 缺失")

    failures = []
    for metric, value in validated["values"].items():
        key = entry_key(label, metric)
        entry = entries.get(key)
        if not isinstance(entry, dict):
            raise ValidationError(f"没有 {key} 的 perf-v2 基线")
        for field, current in [
            ("tool_sha", validated["tool_sha"]),
            ("fixture_hash", validated["fixture_hash"]),
            ("environment_id", validated["environment_id"]),
        ]:
            if entry.get(field) != current:
                raise ValidationError(
                    f"{key} 的 {field} 不匹配：基线 {entry.get(field)!r}，候选 {current!r}",
                )
        allowed = allowed_value(entry)
        if value > allowed:
            failures.append(
                f"{key} = {value}，基线 {entry['baseline_value']}，允许上限 {allowed:.1f}",
            )
        else:
            print(
                f"✓ {key} = {value}，基线 {entry['baseline_value']}，允许上限 {allowed:.1f}",
            )
    if failures:
        for failure in failures:
            print(f"✗ {failure}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, json.JSONDecodeError, ValidationError, KeyError) as error:
        print(f"ratchet: {error}", file=sys.stderr)
        raise SystemExit(2) from error
