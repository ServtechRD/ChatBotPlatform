---
name: backend-preflight
description: >-
  Align backend implementation with project layering and architecture before
  coding. Use when starting a backend feature, backend preflight, or invoking
  /backend-preflight.
disable-model-invocation: true
---

# backend:preflight

實作前對齊後端規範。

## 依據

- `.cursor/rules/backend/hard-constraints.mdc`
- `.cursor/rules/backend/js-structure.mdc`
- `docs/architeture.md`
- `docs/spec.md`

## 步驟

1. 確認任務範圍與相關資源。
2. 搜尋可復用候選（既有 routes / service / repository）。
3. 規劃分層：routes → controller → service → repository → model。
4. 標出風險與與 architecture 的衝突點。
5. 有衝突則停止實作，先回報；需使用者明確例外授權後才可繼續。

## 輸出

- Scope
- 可復用候選（既有 routes/service/repository）
- 分層計畫（routes→controller→service→repository→model）
- 風險
- 與 architecture 的衝突點
