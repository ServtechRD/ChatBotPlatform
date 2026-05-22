import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from '@mui/material';

export default function SpeechCorrectionSelectionModal({
  open,
  selectedText,
  onClose,
  groups = [],
  onOpenCreateModal,
  onConfirmExisting,
  submitting = false,
  error = null,
}) {
  const [mode, setMode] = useState('new');
  const [search, setSearch] = useState('');
  const [pickedCorrectText, setPickedCorrectText] = useState('');

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => g.correctText)
      .filter((ct) => !q || ct.toLowerCase().includes(q));
  }, [groups, search]);

  function handleClose() {
    setMode('new');
    setSearch('');
    setPickedCorrectText('');
    onClose();
  }

  async function handleConfirmExisting() {
    if (!pickedCorrectText) return;
    await onConfirmExisting(pickedCorrectText);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>建立語音誤字對照</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          選取文字
        </Typography>
        <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
          {selectedText}
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          要對應到哪個正確關鍵字？
        </Typography>
        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <RadioGroup
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setPickedCorrectText('');
            }}
          >
            <FormControlLabel
              value="new"
              control={<Radio />}
              label="新增關鍵字"
            />
            <FormControlLabel
              value="existing"
              control={<Radio />}
              label="既有關鍵字"
            />
          </RadioGroup>
        </FormControl>

        {mode === 'new' && (
          <Button variant="outlined" onClick={onOpenCreateModal} disabled={submitting}>
            開啟新增關鍵字表單
          </Button>
        )}

        {mode === 'existing' && (
          <Box>
            <TextField
              fullWidth
              size="small"
              placeholder="搜尋正確關鍵字"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 1 }}
              disabled={submitting}
            />
            <List
              dense
              sx={{
                maxHeight: 200,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {options.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  找不到符合的關鍵字
                </Typography>
              )}
              {options.map((ct) => (
                <ListItemButton
                  key={ct}
                  selected={pickedCorrectText === ct}
                  onClick={() => setPickedCorrectText(ct)}
                >
                  <ListItemText primary={ct} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          取消
        </Button>
        {mode === 'existing' && (
          <Button
            variant="contained"
            onClick={handleConfirmExisting}
            disabled={submitting || !pickedCorrectText}
            startIcon={submitting ? <CircularProgress size={18} /> : null}
          >
            確認
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
