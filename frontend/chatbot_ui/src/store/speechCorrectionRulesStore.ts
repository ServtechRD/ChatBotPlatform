import { speechCorrectionRule } from '../api/speechCorrectionRule';
import {
  flattenGroups,
  type SpeechCorrectionRule,
  type SpeechCorrectionRuleCreatePayload,
  type SpeechCorrectionRuleGroup,
  type SpeechCorrectionRuleUpdatePayload,
} from '../types/speechCorrectionRule';

export interface SpeechCorrectionRulesSnapshot {
  groups: SpeechCorrectionRuleGroup[];
  rules: SpeechCorrectionRule[];
  activeRules: SpeechCorrectionRule[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

type Listener = () => void;

let groups: SpeechCorrectionRuleGroup[] = [];
let rules: SpeechCorrectionRule[] = [];
let loading = false;
let error: string | null = null;
let loaded = false;
let loadPromise: Promise<void> | null = null;

const listeners = new Set<Listener>();

/** useSyncExternalStore 要求 getSnapshot 在資料未變時回傳相同 reference */
let cachedSnapshot: SpeechCorrectionRulesSnapshot | null = null;

function recomputeSnapshot() {
  cachedSnapshot = {
    groups,
    rules,
    activeRules: deriveActiveRules(rules),
    loading,
    error,
    loaded,
  };
}

function emit() {
  recomputeSnapshot();
  listeners.forEach((fn) => fn());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function deriveActiveRules(list: SpeechCorrectionRule[]): SpeechCorrectionRule[] {
  return list.filter((r) => r.enabled);
}

function setFromGroups(nextGroups: SpeechCorrectionRuleGroup[]) {
  groups = nextGroups;
  rules = flattenGroups(nextGroups);
  loaded = true;
  error = null;
  emit();
}

export function getSnapshot(): SpeechCorrectionRulesSnapshot {
  if (!cachedSnapshot) {
    recomputeSnapshot();
  }
  return cachedSnapshot!;
}

/** 供非 React 路徑讀取目前啟用規則（例如舊 wrapper） */
export function getActiveRulesSnapshot(): SpeechCorrectionRule[] {
  if (!cachedSnapshot) {
    recomputeSnapshot();
  }
  return cachedSnapshot!.activeRules;
}

function hasAuthToken(): boolean {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem('token');
}

export async function ensureRulesLoaded(
  options: { enabledOnly?: boolean; force?: boolean } = {}
): Promise<void> {
  /** 管理頁需含停用規則；activeRules 由前端 filter */
  const { enabledOnly = false, force = false } = options;
  if (!hasAuthToken()) return;
  if (loaded && !force && !loading) return;
  if (loadPromise && !force) return loadPromise;

  loadPromise = (async () => {
    loading = true;
    error = null;
    emit();
    try {
      const nextGroups = await speechCorrectionRule.list({ enabledOnly });
      setFromGroups(nextGroups);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load speech correction rules';
      emit();
    } finally {
      loading = false;
      loadPromise = null;
      emit();
    }
  })();

  return loadPromise;
}

export async function refreshRules(
  options: { enabledOnly?: boolean } = {}
): Promise<void> {
  loaded = false;
  await ensureRulesLoaded({ ...options, force: true });
}

export async function createRulesBatch(
  payload: SpeechCorrectionRuleCreatePayload
): Promise<SpeechCorrectionRule[]> {
  const created = await speechCorrectionRule.createBatch(payload);
  await refreshRules();
  return created;
}

export async function updateRule(
  ruleId: number,
  payload: SpeechCorrectionRuleUpdatePayload
): Promise<SpeechCorrectionRule> {
  const updated = await speechCorrectionRule.update(ruleId, payload);
  await refreshRules();
  return updated;
}

export async function removeRule(ruleId: number): Promise<void> {
  await speechCorrectionRule.remove(ruleId);
  await refreshRules();
}

export function resetSpeechCorrectionRulesStore(): void {
  groups = [];
  rules = [];
  loading = false;
  error = null;
  loaded = false;
  loadPromise = null;
  cachedSnapshot = null;
  emit();
}

export const speechCorrectionRulesStore = {
  subscribe,
  getSnapshot,
  getActiveRulesSnapshot,
  ensureRulesLoaded,
  refreshRules,
  createRulesBatch,
  updateRule,
  removeRule,
  resetSpeechCorrectionRulesStore,
};
