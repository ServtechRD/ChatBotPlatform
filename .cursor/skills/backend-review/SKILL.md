---
name: backend-review
description: >-
  Review backend work against layering, auth, API contract, and checklist
  before handoff. Use when finishing a backend task, backend review, or
  invoking /backend-review.
disable-model-invocation: true
---

# backend:review

交付前審查。

## 依據

- `.cursor/rules/backend/execution-checklist.mdc`
- `.cursor/rules/backend/hard-constraints.mdc`
- `docs/architeture.md`

## 檢查項目

- 分層是否被穿透
- Auth middleware / role
- API path 與欄位是否對齊 architecture
- 錯誤格式 `{ message }`
- Firestore collection 命名
- 套件是否已在 `backend/package.json`
- users 相關規則：
  - `user_id` = Auth UID
  - `email` 不可改
  - password 不進 DB
  - 無硬刪除

## 輸出

Pass/Fail 與必修項（對照 `execution-checklist.mdc`）。
