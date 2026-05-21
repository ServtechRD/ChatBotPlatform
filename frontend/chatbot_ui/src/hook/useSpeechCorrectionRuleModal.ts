import { useCallback, useState } from 'react';
import type { SpeechCorrectionRule } from '../types/speechCorrectionRule';

export interface SpeechCorrectionRuleForm {
  correctText: string;
  wrongTexts: string[];
  enabled: boolean;
}

const emptyForm: SpeechCorrectionRuleForm = {
  correctText: '',
  wrongTexts: [],
  enabled: true,
};

export function useSpeechCorrectionRuleModal() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SpeechCorrectionRule | null>(
    null
  );
  const [editingGroupRules, setEditingGroupRules] = useState<
    SpeechCorrectionRule[] | null
  >(null);
  const [formState, setFormState] =
    useState<SpeechCorrectionRuleForm>(emptyForm);

  const openCreate = useCallback((initial?: Partial<SpeechCorrectionRuleForm>) => {
    setEditingRule(null);
    setEditingGroupRules(null);
    setFormState({
      ...emptyForm,
      ...initial,
    });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((rule: SpeechCorrectionRule) => {
    setEditingRule(rule);
    setEditingGroupRules(null);
    setFormState({
      correctText: rule.correctText,
      wrongTexts: [rule.wrongText],
      enabled: rule.enabled,
    });
    setModalOpen(true);
  }, []);

  const openEditGroup = useCallback(
    (correctText: string, groupRules: SpeechCorrectionRule[]) => {
      setEditingRule(groupRules[0] ?? null);
      setEditingGroupRules(groupRules);
      setFormState({
        correctText,
        wrongTexts: groupRules.map((r) => r.wrongText),
        enabled: groupRules.every((r) => r.enabled),
      });
      setModalOpen(true);
    },
    []
  );

  const close = useCallback(() => {
    setModalOpen(false);
    setEditingRule(null);
    setEditingGroupRules(null);
    setFormState(emptyForm);
  }, []);

  const patchForm = useCallback((patch: Partial<SpeechCorrectionRuleForm>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    modalOpen,
    editingRule,
    editingGroupRules,
    formState,
    setFormState,
    patchForm,
    openCreate,
    openEdit,
    openEditGroup,
    close,
    isEditing: editingRule != null,
    isGroupEdit: (editingGroupRules?.length ?? 0) > 0,
  };
}
