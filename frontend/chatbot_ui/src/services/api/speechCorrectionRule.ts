import { api } from './api.js';
import { buildApiUrl } from '../../utils/urlUtils.js';
import {
  groupFromApi,
  groupsFromApi,
  groupToUpsertApi,
  ruleFromApi,
  ruleToCreateApi,
  ruleToUpdateApi,
  type SpeechCorrectionRule,
  type SpeechCorrectionRuleApi,
  type SpeechCorrectionRuleCreatePayload,
  type SpeechCorrectionRuleGroup,
  type SpeechCorrectionRuleGroupApi,
  type SpeechCorrectionRuleGroupUpsertPayload,
  type SpeechCorrectionRuleUpdatePayload,
} from '../../types/speechCorrectionRule.js';

const PATH = '/speech_correction_rule';

export interface SpeechCorrectionRuleListOptions {
  assistantId: number;
  enabledOnly?: boolean;
}

async function list(
  options: SpeechCorrectionRuleListOptions
): Promise<SpeechCorrectionRuleGroup[]> {
  const { assistantId, enabledOnly = true } = options;
  const data = (await api.get(PATH, {
    params: { assistant_id: assistantId, enabled_only: enabledOnly },
  })) as SpeechCorrectionRuleGroupApi[];
  return groupsFromApi(Array.isArray(data) ? data : []);
}

async function listPublic(
  assistantId: number
): Promise<SpeechCorrectionRuleGroup[]> {
  const url = buildApiUrl(`/api${PATH}/public?assistant_id=${assistantId}`);
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return [];
  const data = (await res.json()) as SpeechCorrectionRuleGroupApi[];
  return groupsFromApi(Array.isArray(data) ? data : []);
}

async function createBatch(
  payload: SpeechCorrectionRuleCreatePayload
): Promise<SpeechCorrectionRule[]> {
  const data = (await api.post(
    PATH,
    ruleToCreateApi(payload)
  )) as SpeechCorrectionRuleApi[];
  const rows = Array.isArray(data) ? data : [];
  return rows.map(ruleFromApi);
}

async function update(
  ruleId: number,
  assistantId: number,
  payload: SpeechCorrectionRuleUpdatePayload
): Promise<SpeechCorrectionRule> {
  const data = (await api.put(`${PATH}/${ruleId}`, ruleToUpdateApi(payload), {
    params: { assistant_id: assistantId },
  })) as SpeechCorrectionRuleApi;
  return ruleFromApi(data);
}

/** 硬刪單筆錯字規則（同一正確關鍵字至少須保留一筆） */
async function remove(ruleId: number, assistantId: number): Promise<void> {
  await api.del(`${PATH}/${ruleId}`, {
    params: { assistant_id: assistantId },
  });
}

/** 一次同步正確關鍵字群組（新增 / 編輯 / 啟用 / 增刪錯字） */
async function saveGroup(
  payload: SpeechCorrectionRuleGroupUpsertPayload
): Promise<SpeechCorrectionRuleGroup> {
  const data = (await api.put(
    `${PATH}/group`,
    groupToUpsertApi(payload)
  )) as SpeechCorrectionRuleGroupApi;
  return groupFromApi(data);
}

export const speechCorrectionRule = {
  list,
  listPublic,
  createBatch,
  update,
  remove,
  saveGroup,
};
