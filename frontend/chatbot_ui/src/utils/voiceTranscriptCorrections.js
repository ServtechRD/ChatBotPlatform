/**
 * @deprecated 請改用 applyRules + useSpeechCorrectionRules。
 * 保留此檔僅供尚未遷移的 import；語音替換改由 API 規則驅動。
 */
import { applyRules } from './speechCorrectionEngine';
import { getActiveRulesSnapshot } from '../queries/speechCorrectionRule';

export function applyVoiceTranscriptCorrections(text, assistantId) {
  return applyRules(text, getActiveRulesSnapshot(assistantId));
}
