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
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';

// API 客戶端類別
class ConversationAPI {
  async getConversations() {
    // 模擬 API 調用
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: 1, avatar: 'A', name: 'Absolute Zinc 68c0e6adbc', time: '2024/10/17 下午4:54:20' },
          { id: 2, avatar: 'O', name: 'Oily Soda 6f09b4063d', time: '2024/9/9 下午12:15:18' },
        ]);
      }, 1000);
    });
  }
}

const api = new ConversationAPI();

const ConversationManagement = () => {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('全部');

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const data = await api.getConversations();
      setConversations(data);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch conversations');
      setIsLoading(false);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const filteredConversations = conversations.filter(conversation => 
    conversation.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: 3, height: '100vh', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
        對話
      </Typography>
      <Box sx={{ display: 'flex', mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="搜尋"
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
          sx={{ mr: 2 }}
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
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        filteredConversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            avatar={conversation.avatar}
            name={conversation.name}
            time={conversation.time}
          />
        ))
      )}
    </Box>
  );
};

const ConversationItem = ({ avatar, name, time }) => (
  <Box sx={{ 
    display: 'flex', 
    alignItems: 'center', 
    p: 2, 
    mb: 1, 
    borderRadius: 1,
    '&:hover': { bgcolor: '#f5f5f5' }
  }}>
    <Avatar sx={{ mr: 2, bgcolor: '#e0e0e0', width: 40, height: 40, fontSize: 18 }}>
      {avatar}
    </Avatar>
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <LanguageIcon sx={{ fontSize: 16, color: '#1976d2', mr: 0.5 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          {name}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: '#757575' }}>
        {time}
      </Typography>
    </Box>
    <IconButton size="small">
      <AddIcon fontSize="small" />
    </IconButton>
  </Box>
);

export default ConversationManagement;