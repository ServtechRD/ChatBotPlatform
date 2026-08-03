---
name: backend-scaffold-feature
description: >-
  Scaffold a backend feature with routes/controllers/services/repositories/
  models layering. Use when creating a new backend feature skeleton or
  invoking /backend-scaffold-feature.
disable-model-invocation: true
---

# backend:scaffold-feature

建立後端功能骨架。

## 依據

- `.cursor/rules/backend/hard-constraints.mdc`
- `.cursor/rules/backend/js-structure.mdc`
- `docs/architeture.md`

## 內容

依資源建立基本結構與責任分離：

- `routes`
- `controllers`
- `services`
- `repositories`
- `models`

必要時補 middleware（auth、requireRole）。

## 強制

- controller 不直接打 Firestore / Auth
- repository 不做業務規則
- 不得臆造未約定 endpoint；衝突時先回報並等待例外授權
