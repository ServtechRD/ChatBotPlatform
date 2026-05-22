/** 後端 JSON（snake_case）— 與 schemas.SpeechCorrectionRuleOut 對齊 */
export interface SpeechCorrectionRuleApi {
  id: number;
  assistant_id: number;
  wrong_text: string;
  correct_text: string;
  enabled: boolean;
  priority: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface SpeechCorrectionRuleGroupApi {
  correct_text: string;
  enabled: boolean;
  rules: SpeechCorrectionRuleApi[];
}

export interface SpeechCorrectionRuleGroupUpsertApi {
  assistant_id: number;
  correct_text: string;
  enabled: boolean;
  wrong_texts: string[];
  old_correct_text?: string | null;
}

export interface SpeechCorrectionRuleCreateApi {
  assistant_id: number;
  correct_text: string;
  wrong_texts: string[];
  priority?: number;
  enabled?: boolean;
}

export interface SpeechCorrectionRuleUpdateApi {
  wrong_text?: string;
  correct_text?: string;
  enabled?: boolean;
  priority?: number;
}

/** 前端領域模型（camelCase）— 對應 SDD，供 UI / replace engine */
export interface SpeechCorrectionRule {
  id: number;
  assistantId: number;
  wrongText: string;
  correctText: string;
  enabled: boolean;
  priority: number;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpeechCorrectionRuleGroup {
  correctText: string;
  enabled: boolean;
  rules: SpeechCorrectionRule[];
}

export interface SpeechCorrectionRuleGroupUpsertPayload {
  assistantId: number;
  correctText: string;
  enabled: boolean;
  wrongTexts: string[];
  oldCorrectText?: string;
}

export interface SpeechCorrectionRuleCreatePayload {
  assistantId: number;
  correctText: string;
  wrongTexts: string[];
  priority?: number;
  enabled?: boolean;
}

export interface SpeechCorrectionRuleUpdatePayload {
  wrongText?: string;
  correctText?: string;
  enabled?: boolean;
  priority?: number;
}

export function ruleFromApi(row: SpeechCorrectionRuleApi): SpeechCorrectionRule {
  return {
    id: row.id,
    assistantId: row.assistant_id,
    wrongText: row.wrong_text,
    correctText: row.correct_text,
    enabled: row.enabled,
    priority: row.priority,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function ruleToCreateApi(
  payload: SpeechCorrectionRuleCreatePayload
): SpeechCorrectionRuleCreateApi {
  return {
    assistant_id: payload.assistantId,
    correct_text: payload.correctText.trim(),
    wrong_texts: payload.wrongTexts.map((t) => t.trim()).filter(Boolean),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
  };
}

export function ruleToUpdateApi(
  payload: SpeechCorrectionRuleUpdatePayload
): SpeechCorrectionRuleUpdateApi {
  const body: SpeechCorrectionRuleUpdateApi = {};
  if (payload.wrongText !== undefined) body.wrong_text = payload.wrongText.trim();
  if (payload.correctText !== undefined) body.correct_text = payload.correctText.trim();
  if (payload.enabled !== undefined) body.enabled = payload.enabled;
  if (payload.priority !== undefined) body.priority = payload.priority;
  return body;
}

export function groupFromApi(g: SpeechCorrectionRuleGroupApi): SpeechCorrectionRuleGroup {
  const enabled = g.enabled ?? g.rules[0]?.enabled ?? true;
  return {
    correctText: g.correct_text,
    enabled,
    rules: g.rules.map((row) =>
      ruleFromApi({
        ...row,
        enabled: row.enabled ?? enabled,
        correct_text: row.correct_text ?? g.correct_text,
      })
    ),
  };
}

export function groupsFromApi(
  groups: SpeechCorrectionRuleGroupApi[]
): SpeechCorrectionRuleGroup[] {
  return groups.map(groupFromApi);
}

export function groupToUpsertApi(
  payload: SpeechCorrectionRuleGroupUpsertPayload
): SpeechCorrectionRuleGroupUpsertApi {
  const body: SpeechCorrectionRuleGroupUpsertApi = {
    assistant_id: payload.assistantId,
    correct_text: payload.correctText.trim(),
    enabled: payload.enabled,
    wrong_texts: payload.wrongTexts.map((t) => t.trim()).filter(Boolean),
  };
  if (payload.oldCorrectText !== undefined) {
    const old = payload.oldCorrectText.trim();
    if (old) body.old_correct_text = old;
  }
  return body;
}

/** 分組列表攤平成規則陣列（replace engine / 全域 state） */
export function flattenGroups(
  groups: SpeechCorrectionRuleGroup[]
): SpeechCorrectionRule[] {
  return groups.flatMap((g) => g.rules);
}
