---
name: frontend-skill-routing
description: >-
  Route frontend Cursor tasks to the correct skill or built-in workflow.
  Use when unsure which frontend skill to apply, or when invoking
  /frontend-skill-routing.
disable-model-invocation: true
---

# Frontend Skill Routing

## 路由

| 情境 | 使用 |
|------|------|
| 實作前對齊規範 | `frontend-preflight` |
| 交付前審查 | `frontend-review` |
| 建立功能骨架 | `frontend-scaffold-feature` |
| 規範例外授權 | `frontend-exception-request` |
| 需求轉 SDD spec | `frontend-spec-sdd-lite`（或 `frontend-spec-sdd` 若存在） |
| 規範新增或調整 | create-rule 流程 |
| PR 留言、衝突、CI | babysit 流程 |
| Cursor 編輯器設定 | update-cursor-settings |
| CLI 設定 | update-cli-config |

## 共通要求

- 不得違反 frontend hard constraints（`.cursor/rules/frontend/hard-constraints.mdc`）
- 若與規範衝突，先停止並回報衝突點；需使用者明確例外授權後才可繼續
- 若任務為規格產生，需套用 step1~step6 結構與 `status/error`（含 CUD 的 `submitStatus/submitError`）規則
