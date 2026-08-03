# SalesServiceSystem Frontend Agent Workflow

## 前端任務判定
若需求或變更涉及 `frontend/**`，視為前端任務。

## 必跑流程
1. 載入並遵守：
   - `.cursor/rules/frontend/hard-constraints.mdc`
   - `.cursor/rules/frontend/js-ts-structure.mdc`
   - `.cursor/rules/frontend/execution-checklist.mdc`
2. 先搜尋可重用元件、Hook、utils、lib、service。
3. 再進行實作（services / queries / pages / components / hooks 分層）。
4. 交付前用 checklist 逐項檢查。

## 衝突安全閥
- 違反 hard constraints 時，先停止並回報衝突點。
- 僅在使用者明確例外授權後才可繼續。

## 交付說明最低要求
需明確說明：
- API 如何經由 `src/services` 封裝
- 目錄分層與共用邏輯放置依據
- Hooks 與狀態管理合規性
- 是否涉及例外授權
- 是否對齊 `docs/architeture.md` 與 `assistant_id`

## 正式 Subagent
- `/frontend-orchestrator`：依任務編排 frontend skills（見 `frontend-orchestrator.md`）

## 對應 Skills（原 commands 已遷移）
- 實作前：`/frontend-preflight`
- 交付審查：`/frontend-review`
- 功能骨架：`/frontend-scaffold-feature`
- 規範例外：`/frontend-exception-request`
- SDD spec：`/frontend-spec-sdd-lite`
- 路由說明：`/frontend-skill-routing`

## Spec-Driven 任務（前端）
- 若任務為規格產生，優先使用 `frontend-spec-sdd-lite`（或 `frontend-spec-sdd` 若存在）。
- 規格輸出必須包含 step1~step6，並遵守狀態欄位規範：
  - `status: idle | loading | success | fail`
  - `error`
  - 含 CUD 時加上 `submitStatus`、`submitError`
