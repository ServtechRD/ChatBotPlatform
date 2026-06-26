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
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useSubmitKnowledgeTextMutation } from '../../queries/assistant';
import { useUpdateKnowledgeMutation } from '../../queries/knowledge';
import {
  getUploadErrorMessage,
  UPLOAD_SUCCESS_MESSAGE,
  KNOWLEDGE_UPDATE_SUCCESS_MESSAGE,
} from '../../utils/uploadErrorMessage';

export default function TextInputDialog({
  isOpen,
  onClose,
  onSubmitComplete,
  assistantId,
  initialContent,
  isEditMode,
  knowledgeId,
  initialFileName,
  isLoadingEditContent = false,
}) {
  const [textContent, setTextContent] = useState('');
  const [fileName, setFileName] = useState('');

  // Update state when initialContent changes (entry into Edit mode)
  React.useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        setTextContent(initialContent || '');
        setFileName(initialFileName || '');
      } else {
        setTextContent('');
        setFileName('');
      }
    }
  }, [isOpen, initialContent, isEditMode, initialFileName]);

  const updateKnowledgeMutation = useUpdateKnowledgeMutation();
  const submitTextMutation = useSubmitKnowledgeTextMutation();
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');

  const isSubmitting =
    updateKnowledgeMutation.isPending || submitTextMutation.isPending;

  function handleTextChange(event) {
    setTextContent(event.target.value);
  }

  function handleFileNameChange(event) {
    setFileName(event.target.value);
  }

  function resetDialog() {
    setTextContent('');
    setFileName('');
    setSubmitStatus(null);
    setSubmitErrorMessage('');
  }

  function handleClose() {
    resetDialog();
    onClose();
  }

  const isBlockingClose = isSubmitting || isLoadingEditContent;

  function handleClear() {
    setTextContent('');
  }

  async function handleSubmit() {
    if (!textContent.trim()) {
      alert('請輸入文字內容');
      return;
    }

    setSubmitStatus(null);
    setSubmitErrorMessage('');

    try {
      let response;
      if (isEditMode && knowledgeId) {
        response = await updateKnowledgeMutation.mutateAsync({
          assistantId,
          knowledgeId,
          text: textContent,
        });
      } else {
        response = await submitTextMutation.mutateAsync({
          assistantId,
          text: textContent,
          fileName,
        });
      }

      setSubmitStatus('success');
      onSubmitComplete(response?.data ?? response);

      // 延遲關閉對話框，讓使用者看到成功訊息
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Submit failed:', error);
      setSubmitStatus('error');
      setSubmitErrorMessage(getUploadErrorMessage(error));
      setTimeout(() => {
        setSubmitStatus(null);
        setSubmitErrorMessage('');
      }, 3000);
    }
  }

  const charCount = textContent.length;

  return (
    <Dialog
      open={isOpen}
      onClose={isBlockingClose ? undefined : handleClose}
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
          disabled={isBlockingClose}
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
            <Typography sx={{ mt: 2 }}>送出中...</Typography>
          </Box>
        ) : isEditMode && isLoadingEditContent ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minHeight: 200,
            }}
          >
            <CircularProgress size={48} />
            <Typography sx={{ mt: 2 }}>載入文件內容中...</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="檔案名稱"
                placeholder="預設為 manual_input.txt"
                value={fileName}
                onChange={handleFileNameChange}
                disabled={isEditMode} // Don't change filename when editing existing record
                variant="outlined"
                size="small"
                helperText={
                  isEditMode
                    ? '編輯模式下無法修改檔名'
                    : '請輸入存檔名稱 (如: notes.txt)'
                }
              />
            </Box>
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
              已輸入 {charCount} 個字元
            </Typography>
          </>
        )}

        {submitStatus === 'success' && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {isEditMode
              ? KNOWLEDGE_UPDATE_SUCCESS_MESSAGE
              : UPLOAD_SUCCESS_MESSAGE}
          </Alert>
        )}

        {submitStatus === 'error' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitErrorMessage}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClear}
          disabled={isBlockingClose || !textContent}
          color="inherit"
        >
          清除
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={handleClose}
          disabled={isBlockingClose}
          color="inherit"
        >
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            isBlockingClose ||
            isLoadingEditContent ||
            !textContent.trim()
          }
          color="primary"
          variant="contained"
        >
          確定
        </Button>
      </DialogActions>
    </Dialog>
  );
}
