---
name: frontend-review
description: >-
  Review frontend work against project delivery checklist before handoff.
  Use when finishing a frontend task, doing a frontend review, or invoking
  /frontend-review.
disable-model-invocation: true
---

# frontend:review

交付前審查。

## 依據

- `.cursor/rules/frontend/execution-checklist.mdc`
- `.cursor/rules/frontend/hard-constraints.mdc`
- `.cursor/rules/frontend/js-ts-structure.mdc`

## 檢查項目

- API 是否皆經 `src/services`，頁面/元件未直接打 API
- CRUD 是否經 `src/queries`（`useQuery` / `useMutation`），mutation 後有 invalidate 或更新 cache
- 原始碼是否皆為 `.ts` / `.tsx`
- 元件/函數是否使用 `function` 宣告
- 是否避免 render 內 inline component
- Hooks 規則是否合規
- 目錄與套件是否合規（未新增未核准 top-level、未引入未核准套件）
- 是否未使用原生 `alert` / `confirm` / `prompt`，改用 `react-toastify`
- 資源鍵是否使用 `assistant_id`，並對齊 `docs/architeture.md`

## 輸出

Pass/Fail 與必修項（對照 execution-checklist）。
