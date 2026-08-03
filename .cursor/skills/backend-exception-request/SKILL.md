---
name: backend-exception-request
description: >-
  Handle backend rule exceptions with explicit user authorization before
  writing conflicting code. Use when a backend constraint conflict appears
  or when invoking /backend-exception-request.
disable-model-invocation: true
---

# backend:exception-request

處理後端規範例外。

## 輸入

- 例外原因
- 影響範圍
- 替代風險控管

## 規則

未取得使用者明確例外授權前，不可繼續產生衝突程式碼（例如改用 `project_id`、跳過分層、新增未約定 endpoint）。

## 步驟

1. 停止產生與 hard constraints / architecture 衝突的程式碼。
2. 清楚列出衝突點、原因、影響範圍、替代控管。
3. 等待使用者明確例外授權與描述。
4. 僅在授權範圍內繼續；交付說明需註明例外授權。
