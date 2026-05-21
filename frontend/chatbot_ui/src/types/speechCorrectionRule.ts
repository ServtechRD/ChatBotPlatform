/** 後端 JSON（snake_case）— 與 schemas.SpeechCorrectionRuleOut 對齊 */
export interface SpeechCorrectionRuleApi {
  id: number;
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
  rules: SpeechCorrectionRuleApi[];
}

export interface SpeechCorrectionRuleCreateApi {
  correct_text: string;
  wrong_texts: string[];
  priority?: number;
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
  rules: SpeechCorrectionRule[];
}

export interface SpeechCorrectionRuleCreatePayload {
  correctText: string;
  wrongTexts: string[];
  priority?: number;
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
    correct_text: payload.correctText.trim(),
    wrong_texts: payload.wrongTexts.map((t) => t.trim()).filter(Boolean),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
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

export function groupsFromApi(
  groups: SpeechCorrectionRuleGroupApi[]
): SpeechCorrectionRuleGroup[] {
  return groups.map((g) => ({
    correctText: g.correct_text,
    rules: g.rules.map(ruleFromApi),
  }));
}

/** 分組列表攤平成規則陣列（replace engine / 全域 state） */
export function flattenGroups(
  groups: SpeechCorrectionRuleGroup[]
): SpeechCorrectionRule[] {
  return groups.flatMap((g) => g.rules);
}
