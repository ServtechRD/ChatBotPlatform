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
    createBatch,
    update,
    remove,
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
      if (modal.isGroupEdit && modal.editingGroupRules?.length) {
        const existing = modal.editingGroupRules;
        const newWrongSet = new Set(normalizedWrong);

        for (const rule of existing) {
          await update(rule.id, {
            correctText: trimmedCorrect,
            enabled,
          });
          if (!newWrongSet.has(rule.wrongText)) {
            await remove(rule.id);
          }
        }

        const existingWrong = new Set(existing.map((r) => r.wrongText));
        const toAdd = normalizedWrong.filter((w) => !existingWrong.has(w));
        if (toAdd.length > 0) {
          await createBatch({
            correctText: trimmedCorrect,
            wrongTexts: toAdd,
          });
        }
      } else if (modal.isEditing && modal.editingRule) {
        await update(modal.editingRule.id, {
          wrongText: normalizedWrong[0],
          correctText: trimmedCorrect,
          enabled,
        });
      } else {
        await createBatch({
          correctText: trimmedCorrect,
          wrongTexts: normalizedWrong,
        });
      }
      modal.close();
    } catch (err) {
      setSubmitError(getSpeechCorrectionErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteGroup(correctText, groupRules) {
    const ok = window.confirm(
      `確定要刪除正確關鍵字「${correctText}」及其 ${groupRules.length} 筆錯字對照嗎？`
    );
    if (!ok) return;
    try {
      for (const rule of groupRules) {
        await remove(rule.id);
      }
    } catch (err) {
      alert(getSpeechCorrectionErrorMessage(err, '刪除失敗'));
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
                          modal.openEditGroup(group.correctText, group.rules)
                        }
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="刪除"
                        onClick={() =>
                          handleDeleteGroup(group.correctText, group.rules)
                        }
                      >
                        <DeleteIcon />
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
                      {!group.rules.every((r) => r.enabled) && (
                        <Chip label="部分停用" size="small" color="warning" />
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
                          color={rule.enabled ? 'default' : 'default'}
                          sx={{ opacity: rule.enabled ? 1 : 0.5 }}
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
