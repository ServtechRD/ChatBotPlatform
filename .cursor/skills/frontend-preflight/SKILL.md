---
name: frontend-preflight
description: >-
  Align frontend implementation with project constraints before coding.
  Use when starting a frontend feature, when the user asks for frontend
  preflight, or invokes /frontend-preflight.
disable-model-invocation: true
---

# frontend:preflight

實作前對齊前端規範。

## 依據

- `.cursor/rules/frontend/hard-constraints.mdc`
- `.cursor/rules/frontend/js-ts-structure.mdc`
- `.cursor/rules/frontend/execution-checklist.mdc`
- `docs/architeture.md`

## 步驟

1. 確認任務範圍是否涉及 `frontend/**`。
2. 搜尋可重用的 `services` / `queries` / `components` / `hooks` / `utils`。
3. 規劃分層（services → queries → pages/components；必要時 hooks）。
4. 標出風險與與 architecture / hard constraints 的衝突點。
5. 有衝突則停止實作，先回報；需使用者明確例外授權後才可繼續。

## 輸出

- Scope
- 可復用候選
- 分層計畫
- 風險
- 衝突點
