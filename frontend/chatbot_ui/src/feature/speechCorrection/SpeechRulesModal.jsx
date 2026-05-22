import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Checkbox,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';

export default function SpeechRulesModal({
  open,
  onClose,
  title,
  formState,
  onPatchForm,
  onSubmit,
  submitting = false,
  submitError = null,
}) {
  const [tagInput, setTagInput] = useState('');

  function handleClose() {
    setTagInput('');
    onClose();
  }

  function addWrongTextTag(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    const exists = formState.wrongTexts.some((w) => w.trim() === trimmed);
    if (exists) return;
    onPatchForm({ wrongTexts: [...formState.wrongTexts, trimmed] });
    setTagInput('');
  }

  function handleTagInputKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addWrongTextTag(tagInput);
    }
  }

  function removeTag(index) {
    onPatchForm({
      wrongTexts: formState.wrongTexts.filter((_, i) => i !== index),
    });
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="正確關鍵字"
          value={formState.correctText}
          onChange={(e) => onPatchForm({ correctText: e.target.value })}
          margin="normal"
          required
          disabled={submitting}
        />

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          可能錯誤文字
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {formState.wrongTexts.map((tag, index) => (
            <Chip
              key={`${tag}-${index}`}
              label={tag}
              onDelete={submitting ? undefined : () => removeTag(index)}
              size="small"
            />
          ))}
        </Box>
        <TextField
          fullWidth
          size="small"
          placeholder="輸入後按 Enter 新增"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagInputKeyDown}
          onBlur={() => addWrongTextTag(tagInput)}
          disabled={submitting}
          helperText="可輸入多個辨識錯字，以 Enter 或逗號新增"
        />

        <FormControlLabel
          sx={{ mt: 2 }}
          control={
            <Checkbox
              checked={formState.enabled}
              onChange={(e) => onPatchForm({ enabled: e.target.checked })}
              disabled={submitting}
            />
          }
          label="是否啟用"
        />

        {submitError && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {submitError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={18} /> : null}
        >
          送出
        </Button>
      </DialogActions>
    </Dialog>
  );
}
