#!/usr/bin/env python3
"""
30 人併發上傳壓測（方案 A：真實 HTTP API）

前置：後端已啟動，且測試帳號為目標 assistant 的 owner。

情境 1 — 同一 assistant（30 人同時上傳到同一個 bot）：
    cd backend
    python load_tests/load_test_upload.py \\
        --base-url http://127.0.0.1:3100 \\
        --email owner@example.com \\
        --password secret \\
        --assistant-id 1 \\
        --workers 30

情境 2 — 不同 assistant（每人一個 bot）：
    python load_tests/load_test_upload.py \\
        --base-url http://127.0.0.1:3100 \\
        --token eyJhbG... \\
        --assistant-ids 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30 \\
        --workers 30

若尚未建立 30 個 assistant，可先自動建立：
    python load_tests/load_test_upload.py \\
        --base-url http://127.0.0.1:3100 \\
        --email owner@example.com \\
        --password secret \\
        --prepare-assistants 30 \\
        --workers 30
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class UploadResult:
    worker: int
    assistant_id: int
    status: int | str
    elapsed_s: float
    body: str


async def login(client: httpx.AsyncClient, base_url: str, email: str, password: str) -> str:
    resp = await client.post(
        f"{base_url}/auth/login",
        data={"username": email, "password": password},
    )
    if resp.status_code != 200:
        raise RuntimeError(f"登入失敗 HTTP {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    token = data.get("access_token")
    if not token:
        if data.get("mfa_setup_required") or data.get("mfa_verify_required"):
            raise RuntimeError("此帳號啟用 MFA，請改用 --token 傳入 JWT")
        raise RuntimeError(f"登入回應無 access_token: {data}")
    return token


async def create_assistant(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    index: int,
) -> int:
    suffix = uuid.uuid4().hex[:8]
    resp = await client.post(
        f"{base_url}/assistant/create",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "name": f"LoadTest-{index:02d}-{suffix}",
            "description": f"壓測用助理 #{index}",
            "language": "zh-TW",
            "note": "",
            "welcome": "welcome",
            "noidea": "no idea",
            "other": "",
        },
        timeout=120.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"建立 assistant #{index} 失敗 HTTP {resp.status_code}: {resp.text[:300]}")
    payload = resp.json()
    assistant_id = payload.get("assistant_id")
    if assistant_id is None:
        raise RuntimeError(f"建立 assistant #{index} 回應異常: {payload}")
    return int(assistant_id)


async def prepare_assistants(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    count: int,
) -> list[int]:
    print(f"[準備] 建立 {count} 個 assistant ...")
    ids: list[int] = []
    for i in range(1, count + 1):
        aid = await create_assistant(client, base_url, token, i)
        ids.append(aid)
        print(f"  assistant #{i:02d} -> id={aid}")
    return ids


async def upload_one(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    assistant_id: int,
    worker_id: int,
    *,
    timeout_s: float,
    content_lines: int,
) -> UploadResult:
    url = f"{base_url}/assistant/{assistant_id}/upload"
    filename = f"loadtest_user_{worker_id:02d}.txt"
    content = (
        f"loadtest worker={worker_id} assistant={assistant_id} ts={time.time()}\n"
        * content_lines
    )

    t0 = time.perf_counter()
    try:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (filename, content.encode("utf-8"), "text/plain")},
            timeout=timeout_s,
        )
        elapsed = time.perf_counter() - t0
        return UploadResult(
            worker=worker_id,
            assistant_id=assistant_id,
            status=resp.status_code,
            elapsed_s=round(elapsed, 2),
            body=resp.text[:300],
        )
    except httpx.TimeoutException:
        return UploadResult(
            worker=worker_id,
            assistant_id=assistant_id,
            status="timeout",
            elapsed_s=round(time.perf_counter() - t0, 2),
            body=f"超過 {timeout_s}s",
        )
    except Exception as exc:
        return UploadResult(
            worker=worker_id,
            assistant_id=assistant_id,
            status="error",
            elapsed_s=round(time.perf_counter() - t0, 2),
            body=str(exc)[:300],
        )


def _parse_assistant_ids(raw: str | None, workers: int, single_id: int | None) -> list[int]:
    if single_id is not None:
        return [single_id] * workers
    if not raw:
        raise SystemExit("請指定 --assistant-id（同一 assistant）或 --assistant-ids（不同 assistant）")
    ids = [int(x.strip()) for x in raw.split(",") if x.strip()]
    if len(ids) != workers:
        raise SystemExit(f"--assistant-ids 數量 ({len(ids)}) 必須等於 --workers ({workers})")
    return ids


def _print_summary(results: list[UploadResult], total_s: float, scenario: str) -> int:
    ok = [r for r in results if r.status == 200]
    err429 = [r for r in results if r.status == 429]
    err504 = [r for r in results if r.status == 504]
    timeouts = [r for r in results if r.status == "timeout"]
    errors = [r for r in results if r.status not in (200, 429, 504, "timeout")]

    elapsed_list = [r.elapsed_s for r in results]
    print()
    print("=" * 60)
    print(f"情境: {scenario}")
    print(f"總耗時: {total_s:.2f}s")
    print(f"成功 200: {len(ok)}")
    print(f"佇列滿 429: {len(err429)}")
    print(f"逾時 504: {len(err504)}")
    print(f"客戶端 timeout: {len(timeouts)}")
    print(f"其他錯誤: {len(errors)}")
    if elapsed_list:
        print(
            "單次耗時 (s): "
            f"min={min(elapsed_list):.2f} "
            f"p50={statistics.median(elapsed_list):.2f} "
            f"max={max(elapsed_list):.2f}"
        )
        if len(elapsed_list) >= 2:
            print(f"平均: {statistics.mean(elapsed_list):.2f}s")
    print("=" * 60)

    failed = [r for r in results if r.status != 200]
    if failed:
        print("\n失敗明細:")
        for r in sorted(failed, key=lambda x: x.worker):
            print(
                f"  worker={r.worker:02d} assistant={r.assistant_id} "
                f"status={r.status} elapsed={r.elapsed_s}s"
            )
            print(f"    {r.body}")

    return 0 if len(ok) == len(results) else 1


async def run_load_test(args: argparse.Namespace) -> int:
    base_url = args.base_url.rstrip("/")

    async with httpx.AsyncClient() as client:
        token = args.token
        if not token:
            if not args.email or not args.password:
                raise SystemExit("請提供 --token，或同時提供 --email 與 --password")
            print(f"[登入] {args.email} ...")
            token = await login(client, base_url, args.email, args.password)
            print("[登入] 成功")

        assistant_ids: list[int]
        if args.prepare_assistants:
            assistant_ids = await prepare_assistants(
                client, base_url, token, args.prepare_assistants
            )
            if args.prepare_assistants != args.workers:
                print(
                    f"[警告] --prepare-assistants={args.prepare_assistants} "
                    f"與 --workers={args.workers} 不一致，使用前 {args.workers} 個 ID"
                )
            assistant_ids = assistant_ids[: args.workers]
            scenario = f"不同 assistant（自動建立 {len(assistant_ids)} 個）"
        else:
            assistant_ids = _parse_assistant_ids(
                args.assistant_ids, args.workers, args.assistant_id
            )
            if args.assistant_id is not None:
                scenario = f"同一 assistant (id={args.assistant_id})"
            else:
                scenario = f"不同 assistant（{len(assistant_ids)} 個）"

        print(
            f"[壓測] {args.workers} 併發上傳 -> {base_url} "
            f"(timeout={args.timeout}s, content_lines={args.content_lines})"
        )
        if args.assistant_id is not None:
            print(f"       全部指向 assistant_id={args.assistant_id}")
        else:
            print(f"       assistant_ids={assistant_ids[:5]}{'...' if len(assistant_ids) > 5 else ''}")

        t_start = time.perf_counter()
        results = await asyncio.gather(
            *[
                upload_one(
                    client,
                    base_url,
                    token,
                    assistant_ids[i],
                    i + 1,
                    timeout_s=args.timeout,
                    content_lines=args.content_lines,
                )
                for i in range(args.workers)
            ]
        )
        total_s = time.perf_counter() - t_start

    return _print_summary(list(results), total_s, scenario)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="30 人併發知識庫上傳壓測（真實 HTTP）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:3100",
        help="後端 API 根 URL（預設 http://127.0.0.1:3100）",
    )
    parser.add_argument("--token", help="Bearer JWT（已登入可直接傳入）")
    parser.add_argument("--email", help="登入 email（與 --password 搭配）")
    parser.add_argument("--password", help="登入密碼")

    target = parser.add_mutually_exclusive_group()
    target.add_argument(
        "--assistant-id",
        type=int,
        help="情境 1：所有 worker 上傳到同一 assistant",
    )
    target.add_argument(
        "--assistant-ids",
        help="情境 2：逗號分隔的 assistant ID 列表，數量需等於 --workers",
    )
    parser.add_argument(
        "--prepare-assistants",
        type=int,
        metavar="N",
        help="壓測前自動建立 N 個 assistant（適用不同 assistant 情境）",
    )

    parser.add_argument("--workers", type=int, default=30, help="併發數（預設 30）")
    parser.add_argument(
        "--timeout",
        type=float,
        default=600.0,
        help="單次上傳 HTTP timeout 秒數（預設 600）",
    )
    parser.add_argument(
        "--content-lines",
        type=int,
        default=20,
        help="每個測試檔案行數（預設 20，影響 embedding 耗時）",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.prepare_assistants and args.assistant_id is not None:
        parser.error("--prepare-assistants 不可與 --assistant-id 同時使用")

    if (
        not args.prepare_assistants
        and args.assistant_id is None
        and not args.assistant_ids
    ):
        parser.error(
            "請指定 --assistant-id、--assistant-ids，或 --prepare-assistants"
        )

    try:
        return asyncio.run(run_load_test(args))
    except KeyboardInterrupt:
        print("\n已中斷")
        return 130
    except Exception as exc:
        print(f"錯誤: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
