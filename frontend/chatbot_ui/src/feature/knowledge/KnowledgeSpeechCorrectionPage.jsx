import React from 'react';
import SpeechCorrectionRulesPanel from '../speechCorrection/SpeechCorrectionRulesPanel';
import useAuth from '../../hook/useAuth';
import { useAssistant } from '../../context/AssistantContext.jsx';

export default function KnowledgeSpeechCorrectionPage() {
  const { user } = useAuth();
  const { currentAgent } = useAssistant();

  return (
    <SpeechCorrectionRulesPanel
      assistantId={currentAgent?.assistant_id}
      canEdit={user?.permission_level >= 2}
    />
  );
}
