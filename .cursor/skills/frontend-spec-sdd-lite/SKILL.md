---
name: frontend-spec-sdd-lite
description: >-
  Turn frontend requirements into implementable SDD-style specs with
  overview and *_spec.md files. Use when drafting frontend specs from UI
  spec/PRD/notes, or invoking /frontend-spec-sdd-lite.
disable-model-invocation: true
---

# frontend:spec-sdd-lite

將前端需求轉為可實作 spec（SDD 風格）。

## 輸入

- 功能範圍
- 來源文件（UI spec / PRD / 會議紀錄）
- 目標輸出目錄

## 輸出

- `overview` + 多份 `*_spec.md`

## 強制

每份 spec 需有：

- step1 ~ step6
- `status` / `error`
- 含 CUD 時需有 `submitStatus` / `submitError`

狀態欄位規範：

- `status: idle | loading | success | fail`
- `error`
- 含 CUD 時加上 `submitStatus`、`submitError`

## 建議

若存在更完整流程，搭配 `.cursor/skills/frontend-spec-sdd/SKILL.md` 一起使用。

不得違反 frontend hard constraints；衝突時先回報並等待例外授權。
