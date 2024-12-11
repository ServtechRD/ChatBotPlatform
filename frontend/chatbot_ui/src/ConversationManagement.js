import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  Avatar,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Language as LanguageIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import ApiService from './ApiService';

const ConversationManagement = () => {
  // 狀態管理
  const [userInfo, setUserInfo] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('全部');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  // 初始載入
  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    if (userInfo?.id) {
      fetchConversations();
    }
  }, [userInfo]);

  // API 操作
  const fetchUserInfo = async () => {
    try {
      setIsLoadingUser(true);
      setError(null);
      const userData = await ApiService.fetchUserData();
      setUserInfo(userData);
    } catch (err) {
      setError('無法載入使用者資訊，請稍後再試');
      console.error('Error fetching user info:', err);
      handleApiError(err);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      setError(null);
      const userId = ApiService.getUserId();
      if (!userId) {
        throw new Error('找不到使用者 ID');
      }
      const data = await ApiService.fetchUserConversations(userId);
      setConversations(data);
    } catch (err) {
      setError('無法載入對話列表，請稍後再試');
      console.error('Error fetching conversations:', err);
      handleApiError(err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const handleCreateConversation = async () => {
    try {
      const userId = ApiService.getUserId();
      if (!userId) {
        throw new Error('找不到使用者 ID');
      }

      const newConversation = await ApiService.createConversation(userId, {
        name: `新對話 ${new Date().toLocaleString()}`,
        status: '進行中',
      });

      setConversations(prev => [newConversation, ...prev]);
      showSnackbar('成功建立新對話', 'success');
    } catch (err) {
      console.error('Error creating conversation:', err);
      showSnackbar('建立對話失敗', 'error');
      handleApiError(err);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;

    try {
      const userId = ApiService.getUserId();
      if (!userId) {
        throw new Error('找不到使用者 ID');
      }

      await ApiService.deleteConversation(userId, selectedConversation.id);
      setConversations(prev =>
        prev.filter(conv => conv.id !== selectedConversation.id)
      );
      showSnackbar('成功刪除對話', 'success');
      setIsDeleteDialogOpen(false);
      setSelectedConversation(null);
    } catch (err) {
      console.error('Error deleting conversation:', err);
      showSnackbar('刪除對話失敗', 'error');
      handleApiError(err);
    }
  };

  // 事件處理
  const handleSearchChange = event => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = event => {
    setFilter(event.target.value);
  };

  const handleConversationClick = conversation => {
    // 處理對話點擊事件，可以導航到對話詳情頁面
    console.log('Navigate to conversation:', conversation.id);
  };

  const handleDeleteClick = (conversation, event) => {
    event.stopPropagation();
    setSelectedConversation(conversation);
    setIsDeleteDialogOpen(true);
  };

  const handleApiError = error => {
    if (error.response && error.response.status === 401) {
      ApiService.logout();
      // navigate('/login');
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  // 過濾邏輯
  const getFilteredConversations = () => {
    let filtered = [...conversations];

    if (searchTerm) {
      filtered = filtered.filter(conversation =>
        conversation.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filter !== '全部') {
      filtered = filtered.filter(
        conversation => conversation.status === filter
      );
    }

    return filtered;
  };

  // 載入中狀態
  if (isLoadingUser) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // 主要渲染
  return (
    <Box sx={{ p: 3, height: '100vh', overflow: 'auto' }}>
      {/* 標題區 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {userInfo?.email ? `${userInfo.email} 的對話` : '對話'}
        </Typography>
        <Box>
          <IconButton
            onClick={handleCreateConversation}
            disabled={isLoadingConversations}
            title="建立新對話"
          >
            <AddIcon />
          </IconButton>
          <IconButton
            onClick={fetchConversations}
            disabled={isLoadingConversations}
            title="重新整理"
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* 搜尋和過濾區 */}
      <Box sx={{ display: 'flex', mb: 2, gap: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="搜尋對話"
          size="small"
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Select
          value={filter}
          onChange={handleFilterChange}
          size="small"
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="全部">全部</MenuItem>
          <MenuItem value="已完成">已完成</MenuItem>
          <MenuItem value="進行中">進行中</MenuItem>
        </Select>
      </Box>

      {/* 錯誤提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 對話列表 */}
      {isLoadingConversations ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : getFilteredConversations().length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: 4,
            color: 'text.secondary',
          }}
        >
          <ChatIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
          <Typography>沒有找到符合的對話</Typography>
        </Box>
      ) : (
        getFilteredConversations().map(conversation => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            onClick={() => handleConversationClick(conversation)}
            onDelete={e => handleDeleteClick(conversation, e)}
          />
        ))
      )}

      {/* 刪除確認對話框 */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>確認刪除</DialogTitle>
        <DialogContent>
          <Typography>
            確定要刪除對話「{selectedConversation?.name}」嗎？此操作無法復原。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>取消</Button>
          <Button onClick={handleDeleteConversation} color="error">
            刪除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 提示訊息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// 對話項目元件
const ConversationItem = ({ conversation, onClick, onDelete }) => {
  const { avatar, name, time, status } = conversation;

  const getStatusColor = status => {
    switch (status) {
      case '進行中':
        return '#1976d2';
      case '已完成':
        return '#2e7d32';
      default:
        return '#757575';
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 2,
        mb: 1,
        borderRadius: 1,
        transition: 'background-color 0.2s',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
      onClick={onClick}
    >
      <Avatar
        sx={{
          mr: 2,
          bgcolor: 'grey.200',
          width: 40,
          height: 40,
          fontSize: 18,
        }}
      >
        {avatar}
      </Avatar>
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <LanguageIcon
            sx={{
              fontSize: 16,
              color: getStatusColor(status),
              mr: 0.5,
            }}
          />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 'bold',
              color: getStatusColor(status),
            }}
          >
            {name}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {time}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onDelete} title="刪除對話">
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default ConversationManagement;
