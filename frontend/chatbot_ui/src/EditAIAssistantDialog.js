import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  IconButton,
  Box,
} from '@mui/material';
import {
  Link as LinkIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';

import ApiService from './ApiService';

const EditAIAssistantDialog = ({ open, onClose, aiAssistant }) => {
  const [description, setDescription] = useState(
    aiAssistant?.description || ''
  );
  const [language, setLanguage] = useState('繁體中文');
  const [allowLiveChat, setAllowLiveChat] = useState(false);
  const [aiAssistantUrl, setAiAssistantUrl] = useState(aiAssistant?.url || '');
  const [name, setName] = useState(aiAssistant?.name || '');

  const handleSave = async () => {
    // 处理保存逻辑
    try {
      await ApiService.createAssistant(name, description);
      alert('建立成功！');
      onClose();
    } catch (error) {
      alert(`建立失敗:${error}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>新AI助理</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          AI助理助理主要使用情境以及使用者知悉與其互動。對於表現演算結果的使用情境，請使用範本填入背景知識。請根據您的需求修改範本中的問題。
        </Typography>
        <Box display="flex" alignItems="center" marginTop={2}>
          <Typography variant="body2">AI 助理名稱:</Typography>
          <TextField
            value={name}
            onChange={e => setName(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            sx={{ ml: 1, mr: 1 }}
          />
        </Box>

        <TextField
          label="描述"
          multiline
          rows={4}
          fullWidth
          variant="outlined"
          value={description}
          onChange={e => setDescription(e.target.value)}
          margin="normal"
        />

        <FormControl fullWidth variant="outlined" margin="normal">
          <InputLabel>預設回覆語系</InputLabel>
          <Select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            label="預設回覆語系"
          >
            <MenuItem value="繁體中文">繁體中文</MenuItem>
            <MenuItem value="英文">英文</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="caption" color="textSecondary">
          AI助理將優先使用所設語系進行回覆。若無法使用預設語系，中文用戶可使用中文來詢問繁體中文。
        </Typography>

        <Box display="flex" alignItems="center" marginTop={2}>
          <Typography variant="body2">AI助理網址: {aiAssistantUrl}</Typography>

          <IconButton size="small">
            <LinkIcon />
          </IconButton>
          <IconButton size="small">
            <ContentCopyIcon />
          </IconButton>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          儲存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditAIAssistantDialog;
