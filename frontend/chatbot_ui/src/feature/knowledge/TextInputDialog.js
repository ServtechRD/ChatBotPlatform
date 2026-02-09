import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Box,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
// 導入 ApiService
import ApiService from '../../api/ApiService';

const TextInputDialog = ({
  isOpen,
  onClose,
  onSubmitComplete,
  assistantId,
  initialContent,
  isEditMode,
  knowledgeId
}) => {
  const [textContent, setTextContent] = useState('');

  // Update state when initialContent changes (entry into Edit mode)
  React.useEffect(() => {
    if (isOpen && initialContent !== undefined && initialContent !== null) {
      setTextContent(initialContent);
    } else if (isOpen && !isEditMode) {
      setTextContent('');
    }
  }, [isOpen, initialContent, isEditMode]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null

  const handleTextChange = event => {
    setTextContent(event.target.value);
  };

  const resetDialog = () => {
    setTextContent('');
    setSubmitStatus(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  const handleClear = () => {
    setTextContent('');
    // If edit mode, maybe we want to revert to original? Or just clear?
    // User might want to clear and paste new text.
  };

  const handleSubmit = async () => {
    if (!textContent.trim()) {
      alert('請輸入文字內容');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      let response;
      if (isEditMode && knowledgeId) {
        // Edit Mode
        response = await ApiService.updateKnowledge(assistantId, knowledgeId, textContent);
      } else {
        // Create Mode
        response = await ApiService.submitText(assistantId, textContent);
      }

      setSubmitStatus('success');
      onSubmitComplete(response.data);

      // 延遲關閉對話框，讓使用者看到成功訊息
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Submit failed:', error);
      setSubmitStatus('error');
      // 錯誤訊息會顯示 3 秒後自動消失
      setTimeout(() => {
        setSubmitStatus(null);
        setIsSubmitting(false);
      }, 3000);
    }
  };

  const charCount = textContent.length;

  return (
    <Dialog
      open={isOpen}
      onClose={isSubmitting ? undefined : handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '700px',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        讓我們為AI助理建立一個知識
        <IconButton
          edge="end"
          onClick={handleClose}
          disabled={isSubmitting}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', pt: 1 }}>
        <DialogContentText sx={{ mb: 2 }}>
          你可以在此輸入大量文字內容
        </DialogContentText>

        {isSubmitting ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            }}
          >
            <CircularProgress size={48} />
            <Typography sx={{ mt: 2 }}>提交中...</Typography>
          </Box>
        ) : (
          <>
            <TextField
              fullWidth
              multiline
              rows={15}
              placeholder="請輸入文字內容..."
              value={textContent}
              onChange={handleTextChange}
              variant="outlined"
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  height: '100%',
                  alignItems: 'flex-start',
                },
                '& .MuiInputBase-input': {
                  height: '100% !important',
                  overflow: 'auto !important',
                },
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, textAlign: 'right' }}
            >
              已輸入 {charCount} 個字符
            </Typography>
          </>
        )}

        {submitStatus === 'error' && (
          <Typography color="error" sx={{ mt: 2 }}>
            提交失敗，請稍後再試
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClear}
          disabled={isSubmitting || !textContent}
          color="inherit"
        >
          清除
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose} disabled={isSubmitting} color="inherit">
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !textContent.trim()}
          color="primary"
          variant="contained"
        >
          確定
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TextInputDialog;
