import { api } from './api.js';
import {
  groupsFromApi,
  ruleFromApi,
  ruleToCreateApi,
  ruleToUpdateApi,
  type SpeechCorrectionRule,
  type SpeechCorrectionRuleApi,
  type SpeechCorrectionRuleCreatePayload,
  type SpeechCorrectionRuleGroup,
  type SpeechCorrectionRuleGroupApi,
  type SpeechCorrectionRuleUpdatePayload,
} from '../types/speechCorrectionRule';

const PATH = '/speech_correction_rule';

export interface SpeechCorrectionRuleListOptions {
  assistantId: number;
  enabledOnly?: boolean;
}

async function list(
  options: SpeechCorrectionRuleListOptions
): Promise<SpeechCorrectionRuleGroup[]> {
  const { assistantId, enabledOnly = true } = options;
  const data = await api.get<SpeechCorrectionRuleGroupApi[]>(PATH, {
    params: { assistant_id: assistantId, enabled_only: enabledOnly },
  });
  return groupsFromApi(Array.isArray(data) ? data : []);
}

async function createBatch(
  payload: SpeechCorrectionRuleCreatePayload
): Promise<SpeechCorrectionRule[]> {
  const data = await api.post<SpeechCorrectionRuleApi[]>(
    PATH,
    ruleToCreateApi(payload)
  );
  const rows = Array.isArray(data) ? data : [];
  return rows.map(ruleFromApi);
}

async function update(
  ruleId: number,
  assistantId: number,
  payload: SpeechCorrectionRuleUpdatePayload
): Promise<SpeechCorrectionRule> {
  const data = await api.put<SpeechCorrectionRuleApi>(
    `${PATH}/${ruleId}`,
    ruleToUpdateApi(payload),
    { params: { assistant_id: assistantId } }
  );
  return ruleFromApi(data);
}

/** 軟刪除：enabled = false */
async function remove(
  ruleId: number,
  assistantId: number
): Promise<SpeechCorrectionRule> {
  return update(ruleId, assistantId, { enabled: false });
}

export const speechCorrectionRule = {
  list,
  createBatch,
  update,
  remove,
};
