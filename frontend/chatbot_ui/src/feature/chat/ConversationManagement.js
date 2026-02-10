import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import ApiService from '../../api/ApiService';

function ConversationDialog({ open, conversation, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        對話紀錄 - 客戶 ID: {conversation?.customer_id}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            maxHeight: 400,
            overflowY: 'auto',
            bgcolor: '#f5f5f5',
            p: 2,
            borderRadius: 1,
          }}
        >
          {conversation?.messages?.map(message => {
            const isAssistant = message.sender === '助理';
            return (
              <Box
                key={message.message_id}
                sx={{
                  display: 'flex',
                  justifyContent: isAssistant ? 'flex-start' : 'flex-end',
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    maxWidth: '80%',
                    bgcolor: isAssistant ? 'white' : 'primary.main',
                    color: isAssistant ? 'text.primary' : 'primary.contrastText',
                    p: 1.5,
                    borderRadius: 2,
                    boxShadow: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    color={isAssistant ? 'text.secondary' : 'inherit'}
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    {message.sender}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={isAssistant ? 'text.secondary' : 'inherit'}
                    sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}
                  >
                    {new Date(message.timestamp + 'Z').toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            );
          })}
          {!conversation?.messages?.length && (
            <Typography color="text.secondary" align="center">
              目前沒有對話訊息
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default function ConversationManagement({ currentAssistant }) {
  const [conversations, setConversations] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  function handleOpenConversation(conversation) {
    setSelectedConversation(conversation);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setSelectedConversation(null);
  }

  useEffect(() => {
    if (currentAssistant?.assistant_id) {
      fetchConversations();
    }
  }, [currentAssistant?.assistant_id]);

  async function fetchConversations() {
    try {
      setIsLoadingConversations(true);
      setError(null);

      const assistantId = currentAssistant?.assistant_id;
      const data = await ApiService.fetchUserConversations(assistantId);
      setConversations(data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('無法讀取對話列表，請稍後再試');
      setConversations([]);
      handleApiError(err);
    } finally {
      setIsLoadingConversations(false);
    }
  }

  function handleDownloadCSV() {
    const csvData = [];
    csvData.push([
      'customer_id',
      'conversation_id',
      'content',
      'sender',
      'time',
    ]);

    conversations.forEach(conversation => {
      conversation.messages.forEach(message => {
        csvData.push([
          conversation.customer_id,
          conversation.conversation_id,
          message.content,
          message.sender,
          message.timestamp,
        ]);
      });
    });

    const csvContent = csvData
      .map(row => row.map(cell => `"${cell}"`).join('|'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `conversations_${currentAssistant?.assistant_id}.txt`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getMessageCount(messages) {
    return messages?.length || 0;
  }

  function handleApiError(error) {
    if (error.response && error.response.status === 401) {
      ApiService.logout();
      // navigate('/login');
    }
  }

  function handleSearchChange(event) {
    setSearchTerm(event.target.value);
  }

  function getFilteredConversations() {
    if (!searchTerm) return conversations;

    return conversations.filter(conversation =>
      conversation.customer_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (!currentAssistant) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">請先選擇一個助理</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100vh', overflow: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {currentAssistant.name || '對話管理'} - 對話列表
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadCSV}
            sx={{ mr: 1 }}
            disabled={conversations.length === 0}
          >
            下載對話紀錄
          </Button>
          <IconButton
            onClick={fetchConversations}
            disabled={isLoadingConversations}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <TextField
        fullWidth
        variant="outlined"
        placeholder="搜尋客戶 ID"
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
        sx={{ mb: 2 }}
      />

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

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
          <Typography>
            {searchTerm ? '沒有找到符合的對話' : '目前沒有對話記錄'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {getFilteredConversations().map(conversation => (
            <Box
              key={conversation.conversation_id}
              onClick={() => handleOpenConversation(conversation)}
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 'bold', mr: 2 }}
                >
                  客戶 ID: {conversation.customer_id}
                </Typography>
                <Chip
                  label={`${getMessageCount(conversation.messages)} 則訊息`}
                  size="small"
                  color="primary"
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                建立時間:{' '}
                {new Date(conversation.created_at + 'Z').toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <ConversationDialog
        open={isModalOpen}
        conversation={selectedConversation}
        onClose={handleCloseModal}
      />
    </Box>
  );
}
