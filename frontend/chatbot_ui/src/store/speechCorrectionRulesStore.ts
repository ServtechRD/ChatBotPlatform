import { speechCorrectionRule } from '../api/speechCorrectionRule';
import {
  flattenGroups,
  type SpeechCorrectionRule,
  type SpeechCorrectionRuleCreatePayload,
  type SpeechCorrectionRuleGroup,
  type SpeechCorrectionRuleGroupUpsertPayload,
  type SpeechCorrectionRuleUpdatePayload,
} from '../types/speechCorrectionRule';
import { ruleSortKey } from '../utils/speechCorrectionEngine';

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

function sortRulesInGroup(rules: SpeechCorrectionRule[]): SpeechCorrectionRule[] {
  return [...rules].sort(ruleSortKey);
}

function buildGroupsFromRules(rules: SpeechCorrectionRule[]): SpeechCorrectionRuleGroup[] {
  const byCorrect = new Map<string, SpeechCorrectionRule[]>();
  for (const r of rules) {
    const list = byCorrect.get(r.correctText) ?? [];
    list.push(r);
    byCorrect.set(r.correctText, list);
  }
  const groups = Array.from(byCorrect.entries()).map(([correctText, groupRules]) => {
    const enabled = groupRules[0]?.enabled ?? true;
    return {
      correctText,
      enabled,
      rules: sortRulesInGroup(
        groupRules.map((r) => ({ ...r, enabled: r.enabled ?? enabled }))
      ),
    };
  });
  groups.sort(
    (a, b) =>
      Math.min(...a.rules.map((r) => r.id)) - Math.min(...b.rules.map((r) => r.id))
  );
  return groups;
}

function patchEntryRules(entry: AssistantEntry, nextRules: SpeechCorrectionRule[]): void {
  entry.groups = buildGroupsFromRules(nextRules);
  entry.rules = nextRules;
}

function patchLoadedEntry(
  assistantId: number,
  mutate: (rules: SpeechCorrectionRule[]) => SpeechCorrectionRule[]
): void {
  const entry = getEntry(assistantId);
  if (!entry.loaded) return;
  patchEntryRules(entry, mutate(entry.rules));
  emit();
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
  if (id == null) return;

  const { enabledOnly = false, force = false } = options;
  const entry = getEntry(id);

  if (entry.loaded && !force && !entry.loading) return;
  if (entry.loadPromise && !force) return entry.loadPromise;

  entry.loadPromise = (async () => {
    entry.loading = true;
    entry.error = null;
    emit();
    try {
      const nextGroups = hasAuthToken()
        ? await speechCorrectionRule.list({ assistantId: id, enabledOnly })
        : await speechCorrectionRule.listPublic(id);
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
  const id = normalizeAssistantId(payload.assistantId);
  if (id != null) {
    patchLoadedEntry(id, (rules) => [...rules, ...created]);
  }
  return created;
}

export async function updateRule(
  assistantId: number,
  ruleId: number,
  payload: SpeechCorrectionRuleUpdatePayload
): Promise<SpeechCorrectionRule> {
  const updated = await speechCorrectionRule.update(ruleId, assistantId, payload);
  patchLoadedEntry(assistantId, (rules) =>
    rules.map((r) => (r.id === updated.id ? updated : r))
  );
  return updated;
}

export async function removeRule(
  assistantId: number,
  ruleId: number
): Promise<void> {
  await speechCorrectionRule.remove(ruleId, assistantId);
  patchLoadedEntry(assistantId, (rules) => rules.filter((r) => r.id !== ruleId));
}

function replaceGroupInRules(
  rules: SpeechCorrectionRule[],
  replacedRuleIds: number[],
  group: SpeechCorrectionRuleGroup
): SpeechCorrectionRule[] {
  const drop = new Set(replacedRuleIds);
  const synced = group.rules.map((r) => ({
    ...r,
    correctText: group.correctText,
    enabled: group.enabled,
  }));
  return [...rules.filter((r) => !drop.has(r.id)), ...synced];
}

export async function saveRulesGroup(
  payload: SpeechCorrectionRuleGroupUpsertPayload,
  replacedRuleIds: number[] = []
): Promise<SpeechCorrectionRuleGroup> {
  const group = await speechCorrectionRule.saveGroup(payload);
  const id = normalizeAssistantId(payload.assistantId);
  if (id != null) {
    patchLoadedEntry(id, (rules) => replaceGroupInRules(rules, replacedRuleIds, group));
  }
  return group;
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
  saveRulesGroup,
  resetSpeechCorrectionRulesStore,
};
