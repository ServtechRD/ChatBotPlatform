---
name: backend-skill-routing
description: >-
  Route backend Cursor tasks to the correct skill. Use when unsure which
  backend skill to apply, or when invoking /backend-skill-routing.
disable-model-invocation: true
---

# Backend Skill Routing

## 路由

| 情境 | 使用 |
|------|------|
| 實作前對齊規範 | `backend-preflight` |
| 交付前審查 | `backend-review` |
| 建立功能骨架 | `backend-scaffold-feature` |
| 規範例外授權 | `backend-exception-request` |
| 整理／擴充 API 契約 | `backend-api-contract` |

## 共通要求

- 不得違反 backend hard constraints（`.cursor/rules/backend/hard-constraints.mdc`）
- 若與規範衝突，先停止並回報衝突點；需使用者明確例外授權後才可繼續
- API 與欄位需對齊 `docs/architeture.md`；不得臆造未約定 endpoint
