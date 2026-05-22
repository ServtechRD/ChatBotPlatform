# Software Design Document (SDD)

### Speech Correction Rule System（語音文字正規化系統）

## 1. 功能目標

建立一套「語音輸入後處理規則系統」，將語音辨識輸出的錯誤文字，轉換為標準化正確文字，並支援：

- 錯字 → 正字轉換
- 使用者可透過 UI 維護規則
- 在語音輸入與 UI 顯示之間進行即時修正
- 支援 B 頁面選字快速建立規則

## 2. 系統範圍

包含

- 規則 CRUD（A 頁面）
- 選取文字建立規則（B 頁面）
- replace engine（核心邏輯）
- 前端即時文字轉換

不包含（MVP）

- fuzzy matching
- AI 自動建議
- 權限系統
- 多語言翻譯
- analytics / logging pipeline

## 3. 核心資料模型

### 3.1 SpeechCorrectionRule

```typescript
type SpeechCorrectionRule = {
  id: string;
  wrongText: string;
  correctText: string;
  enabled: boolean;
  priority: number;
  createdAt: number;
};
```

### 設計說明

- wrongText：語音辨識錯誤輸出
- correctText：標準化輸出
- priority：控制替換順序（預設 100）
- enabled：是否啟用規則
- createdAt：確保穩定排序 fallback

## 4. 系統架構

### 4.1 高階資料流

```
Speech Input / Text Input
        ↓
Speech Recognition Result
        ↓
Replace Engine (SpeechCorrectionRule)
        ↓
Normalized Text
        ↓
UI Display / Send to AI
```

## 5. Replace Engine 設計

### 5.1 核心原則

- deterministic（相同輸入必須相同輸出）
- no side effects
- predictable ordering
- avoid substring pollution
- rule conflict safe

### 5.2 Rule sorting strategy

```javascript
rules.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
```

### 5.3 Replace strategy（MVP）

approach: regex-safe replace

```typescript
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

engine

```typescript
function applyRules(text: string, rules: SpeechCorrectionRule[]) {
  const activeRules = rules
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);

  let result = text;

  for (const rule of activeRules) {
    const regex = new RegExp(escapeRegExp(rule.wrongText), "g");
    result = result.replace(regex, rule.correctText);
  }

  return result;
}
```

## 5.4 設計限制

- 不支援 fuzzy match（MVP）
- 不支援 partial semantic replacement
- 不處理語意斷詞
- 不處理 NLP parsing

## 6. 前端架構

### 6.1 A 頁面（Rule Management）

功能

- rule list
- create / edit / delete
- enable / disable
- priority（僅內部使用，UI 不強制編輯）

state

```typescript
rules: SpeechCorrectionRule[]
```

UI 示意圖

1. 關鍵字列表
   [關鍵字A 編輯圖示]
   [關鍵字B 編輯圖示]
   [關鍵字C 編輯圖示]

2. 關鍵字新增/編輯 modal (SpeechRulesModal)

[正確關鍵字]
可能錯誤文字：
[input tags ]
是否啟用 [ ] (checkbox)
[取消][送出]

### 6.2 B 頁面（Chat / Transcript）

B 頁面：ConversationDialog內的ReactMarkdown內的文字(偵測 mouseup 事件的地方)

功能流程

```
mouseup event
  ↓
getSelection()
  ↓
open modal with selectedText
  ↓
create rule
  ↓
update rules state
  ↓
re-run replace engine
```

selection handler

```
onMouseUp → extract selected text → modal open
```

B 頁面事件後點開的 modal UI 示意

選取文字： {文字}
要對應到哪個正確關鍵字？
○ 新增關鍵字 (跳到modal<SpeechRulesModal>)
○ 既有關鍵字
[search input ] [確認] (選既有關鍵字時出現)

## 7. State Design（簡化版）

### 7.1 State Ownership

#### Global State

Speech correction rules 為全域共享資料。

用途：

- replace engine
- A 頁面 rule management
- B 頁面選字後建立規則
- 即時文字轉換

```typescript
rules: SpeechCorrectionRule[];
```

建議由：

```typescript
useSpeechCorrectionRules();
```

集中管理 CRUD / refresh / cache。

---

### 7.2 Local State

#### A 頁面（Rule Management）

僅負責 UI 編輯狀態。

```typescript
editingRule: SpeechCorrectionRule | null;
modalOpen: boolean;
formState: SpeechCorrectionRuleForm;
```

用途：

- modal 開關
- rule 編輯
- form 暫存

---

#### B 頁面（Chat / Transcript）

```typescript
selectedText: string;
modalOpen: boolean;
selectionRange: Range | null;
```

用途：

- 暫存使用者選取文字
- modal 顯示
- 避免 selection 在 modal 開啟後消失

---

### 7.3 Derived State

replace 後的文字為 derived state。

不直接存回 global state。

```typescript
normalizedText = applyRules(rawText, rules);
```

設計原則：

- raw text 保持原始資料
- replace engine 為 pure function
- normalized text runtime 計算

---

### 7.4 State Design Principles

- replace engine 不持有 state
- UI state 與 replace logic 分離
- rules 為唯一 source of truth
- normalized text 為 derived data
- modal state 為 local state

## 8. API Design（可選）

Rule CRUD

```
GET    /rules
POST   /rules
PUT    /rules/:id
DELETE /rules/:id
```

Response model

```typescript
{
  rules: SpeechCorrectionRule[]
}
```

## 9. Edge Cases

### 9.1 substring pollution

```
rule: "apple → Apple"
input: "pineapple"
```

👉 must NOT replace inside larger word

### 9.2 overlapping rules

```
chat gpt → ChatGPT
chat → chatX
```

priority must resolve deterministically

## 9.3 case sensitivity

MVP assumes:

- case-insensitive match OR normalized input

### 9.4 repeated execution safety

```
applyRules(applyRules(text)) === applyRules(text)
```

## 10. Performance Considerations

expected rules size: < 1,000
replace complexity: O(n \* rules)
acceptable for frontend runtime

No optimization required for MVP.

## 11. MVP Scope Definition

Must have
rule CRUD
replace engine
selection → rule creation
stable output
Nice to have (v2)
drag reorder priority
fuzzy matching
regex rules
import/export rules
analytics

## 12. Risk Summary

| Risk                  | Impact | Note                         |
| --------------------- | ------ | ---------------------------- |
| substring replace bug | high   | must handle via regex escape |
| rule conflict         | medium | priority + stable sort       |
| selection instability | medium | DOM timing issue             |
| scope creep           | high   | must freeze MVP              |

## 13. System Summary

This system is a deterministic text normalization pipeline applied to speech-to-text output, with a lightweight rule engine and UI-driven rule management system.

Core design principle:

> Keep rule engine simple, deterministic, and isolated from UI complexity.
