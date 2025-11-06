import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Checkbox,
  FormControlLabel,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
// 导入 ApiService
import ApiService from '../../api/ApiService';

const FileUploadDialog = ({
  isOpen,
  onClose,
  onUploadComplete,
  uploadType,
  assistantId,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [importText, setImportText] = useState(true);
  const [hideWebpage, setHideWebpage] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error' | null

  const handleDragEnter = e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    // Handle file drop logic here
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setSelectedFile(droppedFile);
    }
  };

  const handleFileSelect = event => {
    setSelectedFile(event.target.files[0]);
  };

  const resetDialog = () => {
    setUrl('');
    setSelectedFile(null);
    setImportText(true);
    setHideWebpage(false);
    setUploadStatus(null);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  const handleUpload = async () => {
    if (!selectedFile && !url) {
      alert('請選擇文件或輸入URL');
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      let response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        response = await ApiService.uploadFile(assistantId, formData);
      } else if (url) {
        response = await ApiService.uploadUrl(assistantId, url);
      }

      setUploadStatus('success');
      onUploadComplete(response.data);

      // 延遲關閉對話框，讓使用者看到成功訊息
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Upload failed:', error);
      //alert('上傳失敗，請稍後再試');
      setUploadStatus('error');
      // 錯誤訊息會顯示 3 秒後自動消失
      setTimeout(() => {
        setUploadStatus(null);
        setIsUploading(false);
      }, 3000);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={isUploading ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>讓我們為AI助理建立一個知識</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          你可以在此拖放一個小文件
        </DialogContentText>
        <Box
          sx={{
            border: 2,
            borderStyle: 'dashed',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            mb: 4,
            bgcolor: isDragging ? 'primary.50' : 'background.paper',
            borderColor: isDragging ? 'primary.main' : 'grey.300',
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <CircularProgress size={48} />
              <Typography sx={{ mt: 2 }}>上傳中...</Typography>
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                點擊或拖曳上傳
                <br />
                (文件大小限制：&lt; 200KB)
              </Typography>
              <input
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button component="span" variant="contained" color="primary">
                  選擇文件
                </Button>
              </label>
              {selectedFile && <Typography>{selectedFile.name}</Typography>}
            </>
          )}
        </Box>

        <DialogContentText sx={{ mb: 2 }}>
          或者直接貼貼一個網站URL到這裡：
        </DialogContentText>
        <TextField
          fullWidth
          type="url"
          placeholder="網站網址"
          value={url}
          onChange={e => setUrl(e.target.value)}
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={importText}
              onChange={e => setImportText(e.target.checked)}
            />
          }
          label="我想從此頁面導入文本"
          sx={{ mb: 1 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={hideWebpage}
              onChange={e => setHideWebpage(e.target.checked)}
            />
          }
          label="不再顯示此頁面"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isUploading} color="primary">
          取消
        </Button>
        <Button
          onClick={handleUpload}
          disabled={isUploading || (!selectedFile && !url)}
          color="primary"
          variant="contained"
        >
          確認上傳
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUploadDialog;
