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

interface AssistantEntry {
  groups: SpeechCorrectionRuleGroup[];
  rules: SpeechCorrectionRule[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  loadPromise: Promise<void> | null;
  cachedSnapshot: SpeechCorrectionRulesSnapshot | null;
}

const EMPTY_SNAPSHOT: SpeechCorrectionRulesSnapshot = {
  groups: [],
  rules: [],
  activeRules: [],
  loading: false,
  error: null,
  loaded: false,
};

const entries = new Map<number, AssistantEntry>();
const listeners = new Set<Listener>();

function createEntry(): AssistantEntry {
  return {
    groups: [],
    rules: [],
    loading: false,
    error: null,
    loaded: false,
    loadPromise: null,
    cachedSnapshot: null,
  };
}

function getEntry(assistantId: number): AssistantEntry {
  let entry = entries.get(assistantId);
  if (!entry) {
    entry = createEntry();
    entries.set(assistantId, entry);
  }
  return entry;
}

function deriveActiveRules(list: SpeechCorrectionRule[]): SpeechCorrectionRule[] {
  return list.filter((r) => r.enabled);
}

function recomputeSnapshot(entry: AssistantEntry): void {
  entry.cachedSnapshot = {
    groups: entry.groups,
    rules: entry.rules,
    activeRules: deriveActiveRules(entry.rules),
    loading: entry.loading,
    error: entry.error,
    loaded: entry.loaded,
  };
}

function emit(): void {
  for (const entry of entries.values()) {
    recomputeSnapshot(entry);
  }
  listeners.forEach((fn) => fn());
}

function setFromGroups(entry: AssistantEntry, nextGroups: SpeechCorrectionRuleGroup[]): void {
  entry.groups = nextGroups;
  entry.rules = flattenGroups(nextGroups);
  entry.loaded = true;
  entry.error = null;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(assistantId?: number | null): SpeechCorrectionRulesSnapshot {
  if (assistantId == null || Number.isNaN(Number(assistantId))) {
    return EMPTY_SNAPSHOT;
  }
  const entry = getEntry(Number(assistantId));
  if (!entry.cachedSnapshot) {
    recomputeSnapshot(entry);
  }
  return entry.cachedSnapshot!;
}

/** 供非 React 路徑讀取目前啟用規則 */
export function getActiveRulesSnapshot(
  assistantId?: number | null
): SpeechCorrectionRule[] {
  return getSnapshot(assistantId).activeRules;
}

function hasAuthToken(): boolean {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem('token');
}

function normalizeAssistantId(assistantId?: number | null): number | null {
  if (assistantId == null) return null;
  const id = Number(assistantId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function ensureRulesLoaded(
  assistantId?: number | null,
  options: { enabledOnly?: boolean; force?: boolean } = {}
): Promise<void> {
  const id = normalizeAssistantId(assistantId);
  if (id == null || !hasAuthToken()) return;

  const { enabledOnly = false, force = false } = options;
  const entry = getEntry(id);

  if (entry.loaded && !force && !entry.loading) return;
  if (entry.loadPromise && !force) return entry.loadPromise;

  entry.loadPromise = (async () => {
    entry.loading = true;
    entry.error = null;
    emit();
    try {
      const nextGroups = await speechCorrectionRule.list({
        assistantId: id,
        enabledOnly,
      });
      setFromGroups(entry, nextGroups);
    } catch (e) {
      entry.error =
        e instanceof Error ? e.message : 'Failed to load speech correction rules';
    } finally {
      entry.loading = false;
      entry.loadPromise = null;
      emit();
    }
  })();

  return entry.loadPromise;
}

export async function refreshRules(
  assistantId?: number | null,
  options: { enabledOnly?: boolean } = {}
): Promise<void> {
  const id = normalizeAssistantId(assistantId);
  if (id == null) return;
  const entry = getEntry(id);
  entry.loaded = false;
  await ensureRulesLoaded(id, { ...options, force: true });
}

export async function createRulesBatch(
  payload: SpeechCorrectionRuleCreatePayload
): Promise<SpeechCorrectionRule[]> {
  const created = await speechCorrectionRule.createBatch(payload);
  await refreshRules(payload.assistantId);
  return created;
}

export async function updateRule(
  assistantId: number,
  ruleId: number,
  payload: SpeechCorrectionRuleUpdatePayload
): Promise<SpeechCorrectionRule> {
  const updated = await speechCorrectionRule.update(ruleId, assistantId, payload);
  await refreshRules(assistantId);
  return updated;
}

export async function removeRule(
  assistantId: number,
  ruleId: number
): Promise<void> {
  await speechCorrectionRule.remove(ruleId, assistantId);
  await refreshRules(assistantId);
}

export function resetSpeechCorrectionRulesStore(): void {
  entries.clear();
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
