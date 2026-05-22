import { ASSISTANT_ID_QUERY } from '../constants/routes.js';

export function getAssistantIdFromSearch(searchParams) {
  return searchParams.get(ASSISTANT_ID_QUERY);
}

export function buildSearchWithAssistant(searchParams, assistantId) {
  const next = new URLSearchParams(searchParams);
  if (assistantId != null && assistantId !== '') {
    next.set(ASSISTANT_ID_QUERY, String(assistantId));
  } else {
    next.delete(ASSISTANT_ID_QUERY);
  }
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

export function toWithAssistant(pathname, searchParams, assistantId) {
  return {
    pathname,
    search: buildSearchWithAssistant(searchParams, assistantId),
  };
}

export function findAgentByAssistantId(agents, assistantId) {
  if (assistantId == null || assistantId === '') return null;
  return (
    agents.find(a => String(a.assistant_id) === String(assistantId)) ?? null
  );
}
