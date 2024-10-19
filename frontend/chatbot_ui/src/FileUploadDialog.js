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
  Typography
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const FileUploadDialog = ({ isOpen, onClose }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [importText, setImportText] = useState(true);
  const [hideWebpage, setHideWebpage] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    // Handle file drop logic here
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
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
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            點擊或拖曳上傳<br/>(文件大小限制：&lt; 200KB)
          </Typography>
        </Box>
        
        <DialogContentText sx={{ mb: 2 }}>
          或者直接貼貼一個網站URL到這裡：
        </DialogContentText>
        <TextField
          fullWidth
          type="url"
          placeholder="網站網址"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        <FormControlLabel
          control={
            <Checkbox
              checked={importText}
              onChange={(e) => setImportText(e.target.checked)}
            />
          }
          label="我想從此頁面導入文本"
          sx={{ mb: 1 }}
        />
        
        <FormControlLabel
          control={
            <Checkbox
              checked={hideWebpage}
              onChange={(e) => setHideWebpage(e.target.checked)}
            />
          }
          label="不再顯示此頁面"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          取消
        </Button>
        <Button onClick={onClose} color="primary" variant="contained">
          確認
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUploadDialog;
