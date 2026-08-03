---
name: backend-api-contract
description: >-
  Derive or extend backend API contracts from architecture before
  implementation. Use when defining API method/path/fields/roles, or
  invoking /backend-api-contract.
disable-model-invocation: true
---

# backend:api-contract

依 architecture 整理或擴充 API 契約後再實作。

## 輸入

- 功能範圍
- 來源文件（`docs/architeture.md` / `docs/spec.md`）

## 輸出

- method
- path（含 `/api` 前綴說明）
- request / response 欄位
- role 權限
- Firestore collection 欄位

## 規則

- 不得臆造未約定 endpoint
- 需擴充時先列出差異並等待確認
