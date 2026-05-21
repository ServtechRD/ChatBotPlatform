import type { SpeechCorrectionRule } from '../types/speechCorrectionRule';

/** 與後端 speech_correction_service._rule_sort_key 一致 */
export function ruleSortKey(a: SpeechCorrectionRule, b: SpeechCorrectionRule): number {
  const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
  if (byPriority !== 0) return byPriority;
  const byLen = (b.wrongText?.length ?? 0) - (a.wrongText?.length ?? 0);
  if (byLen !== 0) return byLen;
  return (b.id ?? 0) - (a.id ?? 0);
}

/** 純函式：語音辨識結果 → 正規化文字（§7.3 derived，不持有 state） */
export function applyRules(text: string, rules: SpeechCorrectionRule[]): string {
  if (!text || typeof text !== 'string') return text;
  const active = rules.filter((r) => r.enabled).sort(ruleSortKey);
  let result = text;
  for (const rule of active) {
    const wrong = rule.wrongText;
    if (!wrong) continue;
    result = result.split(wrong).join(rule.correctText ?? '');
  }
  return result;
}
