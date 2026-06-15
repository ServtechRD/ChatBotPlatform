import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAssistantsQuery } from '../queries/user';
import {
  buildSearchWithAssistant,
  findAgentByAssistantId,
  getAssistantIdFromSearch,
} from '../utils/assistantQuery.js';

const AssistantContext = createContext(null);

export function AssistantProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    data: agents = [],
    isLoading: assistantsQueryLoading,
    isFetching,
  } = useAssistantsQuery();

  const [currentAgent, setCurrentAgent] = useState(null);

  const isLoading =
    assistantsQueryLoading || (isFetching && agents.length === 0);

  const syncUrlToAgent = useCallback(
    (agent, { replace = true } = {}) => {
      const search = buildSearchWithAssistant(
        searchParams,
        agent?.assistant_id
      );
      navigate({ pathname: location.pathname, search }, { replace });
    },
    [navigate, location.pathname, searchParams]
  );

  const selectAgent = useCallback(
    agent => {
      if (!agent) return;
      setCurrentAgent(agent);
      syncUrlToAgent(agent);
    },
    [syncUrlToAgent]
  );

  const selectAgentByIndex = useCallback(
    index => {
      const agent = agents[index];
      if (agent) selectAgent(agent);
    },
    [agents, selectAgent]
  );

  useEffect(() => {
    if (isLoading || agents.length === 0) return;

    const idFromUrl = getAssistantIdFromSearch(searchParams);
    const fromUrl = findAgentByAssistantId(agents, idFromUrl);

    if (fromUrl) {
      if (currentAgent?.assistant_id !== fromUrl.assistant_id) {
        setCurrentAgent(fromUrl);
      }
      return;
    }

    const fallback =
      findAgentByAssistantId(agents, currentAgent?.assistant_id) ??
      agents[0];

    if (fallback) {
      setCurrentAgent(fallback);
      if (String(idFromUrl) !== String(fallback.assistant_id)) {
        syncUrlToAgent(fallback, { replace: true });
      }
    }
  }, [
    agents,
    isLoading,
    searchParams,
    currentAgent?.assistant_id,
    syncUrlToAgent,
  ]);

  const currentAgentIndex = useMemo(() => {
    if (!currentAgent) return 0;
    const idx = agents.findIndex(
      a => a.assistant_id === currentAgent.assistant_id
    );
    return idx >= 0 ? idx : 0;
  }, [agents, currentAgent]);

  const value = useMemo(
    () => ({
      agents,
      currentAgent,
      currentAgentIndex,
      isLoading,
      selectAgent,
      selectAgentByIndex,
    }),
    [
      agents,
      currentAgent,
      currentAgentIndex,
      isLoading,
      selectAgent,
      selectAgentByIndex,
    ]
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error('useAssistant must be used within AssistantProvider');
  }
  return ctx;
}
