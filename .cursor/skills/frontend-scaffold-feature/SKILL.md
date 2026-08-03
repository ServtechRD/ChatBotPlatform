---
name: frontend-scaffold-feature
description: >-
  Scaffold a frontend feature with correct services/queries/pages/components
  layering. Use when creating a new frontend feature skeleton or invoking
  /frontend-scaffold-feature.
disable-model-invocation: true
---

# frontend:scaffold-feature

建立前端功能骨架。

## 依據

- `.cursor/rules/frontend/hard-constraints.mdc`
- `.cursor/rules/frontend/js-ts-structure.mdc`
- `docs/architeture.md`

## 內容

依功能建立基本結構與責任分離：

- `src/services`：API / Firebase 封裝（無 React Query）
- `src/queries`：`useQuery` / `useMutation` 與 `queryKey`
- `src/pages`：頁面元件
- `src/components`：可複用 UI
- `src/hooks`：非 React Query 的 UI/流程狀態（可 `useQueryClient`）
- 必要時 `src/utils`、`src/types`

## 強制

- 頁面/元件不得直接 import `services` 做 CRUD
- 資源鍵使用 `assistant_id`
- 函數與元件使用 `function` 宣告
- 不得違反 hard constraints；衝突時先回報並等待例外授權
