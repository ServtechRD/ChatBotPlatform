import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSpeechCorrectionRules } from '../../hook/useSpeechCorrectionRules';
import { useSpeechCorrectionRuleModal } from '../../hook/useSpeechCorrectionRuleModal';
import { getSpeechCorrectionErrorMessage } from './speechCorrectionErrors';
import SpeechRulesModal from './SpeechRulesModal';

export default function SpeechCorrectionRulesPanel({
  assistantId,
  canEdit = true,
}) {
  const {
    groups,
    loading,
    error,
    refresh,
    saveGroup,
  } = useSpeechCorrectionRules(assistantId);

  const modal = useSpeechCorrectionRuleModal();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!assistantId) return;
    refresh({ enabledOnly: false });
  }, [assistantId, refresh]);

  async function handleSubmit() {
    if (!assistantId) {
      setSubmitError('請先選擇助理');
      return;
    }
    const { correctText, wrongTexts, enabled } = modal.formState;
    const trimmedCorrect = correctText.trim();
    const normalizedWrong = wrongTexts.map((w) => w.trim()).filter(Boolean);

    if (!trimmedCorrect || normalizedWrong.length === 0) {
      setSubmitError('請填寫正確關鍵字與至少一個可能錯誤文字');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const oldCorrectText =
        modal.editingGroupRules?.[0]?.correctText ??
        modal.editingRule?.correctText ??
        trimmedCorrect;
      const replacedRuleIds =
        modal.editingGroupRules?.map((r) => r.id) ??
        (modal.editingRule ? [modal.editingRule.id] : []);

      await saveGroup(
        {
          assistantId,
          oldCorrectText,
          correctText: trimmedCorrect,
          enabled,
          wrongTexts: normalizedWrong,
        },
        replacedRuleIds
      );
      modal.close();
    } catch (err) {
      setSubmitError(getSpeechCorrectionErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function modalTitle() {
    if (modal.isGroupEdit) return '編輯關鍵字對照';
    if (modal.isEditing) return '編輯關鍵字對照';
    return '新增關鍵字對照';
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight="bold">
          語音誤字對照表
        </Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => modal.openCreate()}
          >
            新增關鍵字
          </Button>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        語音辨識結果會依此對照表替換為正確用詞，並套用於聊天語音輸入。
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {!loading && groups.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
          尚無對照規則，請新增關鍵字。
        </Typography>
      )}

      {!loading && groups.length > 0 && (
        <List>
          {groups.map((group) => (
            <Paper key={group.correctText} elevation={1} sx={{ mb: 2 }}>
              <ListItem
                secondaryAction={
                  canEdit ? (
                    <Box>
                      <IconButton
                        edge="end"
                        aria-label="編輯"
                        onClick={() =>
                          modal.openEditGroup(
                            group.correctText,
                            group.rules,
                            group.enabled
                          )
                        }
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                  ) : null
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {group.correctText}
                      </Typography>
                      {!group.enabled && (
                        <Chip label="已停用" size="small" color="warning" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box
                      component="span"
                      sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}
                    >
                      {group.rules.map((rule) => (
                        <Chip
                          key={rule.id}
                          label={rule.wrongText}
                          size="small"
                          variant="outlined"
                          sx={{ opacity: group.enabled ? 1 : 0.5 }}
                        />
                      ))}
                    </Box>
                  }
                />
              </ListItem>
            </Paper>
          ))}
        </List>
      )}

      <SpeechRulesModal
        open={modal.modalOpen}
        onClose={() => {
          setSubmitError(null);
          modal.close();
        }}
        title={modalTitle()}
        formState={modal.formState}
        onPatchForm={modal.patchForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
      />
    </>
  );
}
