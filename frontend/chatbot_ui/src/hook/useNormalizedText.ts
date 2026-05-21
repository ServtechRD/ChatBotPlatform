import { useMemo } from 'react';
import { applyRules } from '../utils/speechCorrectionEngine';
import { useSpeechCorrectionRules } from './useSpeechCorrectionRules';

/** §7.3：normalizedText 為 derived state，不寫入 store */
export function useNormalizedText(rawText: string): string {
  const { activeRules } = useSpeechCorrectionRules();
  return useMemo(
    () => applyRules(rawText, activeRules),
    [rawText, activeRules]
  );
}
