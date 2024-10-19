import React, { useState, useEffect } from 'react';
import {
  Button,
  Typography,
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Checkbox,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Folder as FolderIcon,
  Edit as EditIcon,
  UploadFile as UploadFileIcon,
  GridOn as GridOnIcon,
  ArrowBack as ArrowBackIcon,
  Link as LinkIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

// Mock API function
const fetchKnowledgeItems = () => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        {
          id: 1,
          title: 'https://www.musesai.com',
          type: 'link',
          tokens: '1.08K Tokens',
          content: ['產品應用', '購物中心', '其他內容...'],
        },
        {
          id: 2,
          title: '人工智能簡介',
          type: 'document',
          tokens: '2.5K Tokens',
          content: ['AI 定義', '機器學習', '深度學習'],
        },
        // Add more mock items as needed
      ]);
    }, 1000);
  });
};

const KnowledgeBaseUI = () => {
  const [activeTab, setActiveTab] = useState('existing');
  const [selectedItem, setSelectedItem] = useState(null);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchKnowledgeItems().then(items => {
      setKnowledgeItems(items);
      setIsLoading(false);
    });
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSelectedItem(null);
  };

  const handleItemClick = item => {
    setSelectedItem(item);
  };

  const handleBackClick = () => {
    setSelectedItem(null);
  };

  const renderExistingKnowledge = () => (
    <>
      {selectedItem ? (
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBackClick}
            sx={{ mb: 2 }}
          >
            查看全部 ({knowledgeItems.length})
          </Button>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="使用關鍵字搜尋"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 4 }}
          />
          <Paper elevation={1} sx={{ mb: 2, p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox />
                {selectedItem.type === 'link' ? (
                  <LinkIcon sx={{ mr: 1 }} />
                ) : (
                  <EditIcon sx={{ mr: 1 }} />
                )}
                <Typography variant="subtitle1">
                  {selectedItem.title}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mr: 2 }}
                >
                  {selectedItem.tokens}
                </Typography>
                <IconButton size="small">
                  <MoreVertIcon />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ pl: 4 }}>
              {selectedItem.content.map((item, index) => (
                <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                  {item}
                </Typography>
              ))}
            </Box>
          </Paper>
        </Box>
      ) : (
        <>
          <Typography variant="h4" fontWeight="bold" mb={4}>
            現有知識
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="使用關鍵字搜尋"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 4 }}
          />
          <List>
            {isLoading ? (
              <Typography>載入中...</Typography>
            ) : (
              knowledgeItems.map(item => (
                <Paper key={item.id} elevation={1} sx={{ mb: 2 }}>
                  <ListItem button onClick={() => handleItemClick(item)}>
                    <ListItemIcon>
                      {item.type === 'link' ? <LinkIcon /> : <EditIcon />}
                    </ListItemIcon>
                    <ListItemText primary={item.title} />
                    <Typography variant="body2" color="text.secondary">
                      {item.tokens}
                    </Typography>
                  </ListItem>
                </Paper>
              ))
            )}
          </List>
        </>
      )}
    </>
  );

  return (
    <Box sx={{ p: 6 }}>
      <Typography variant="h3" fontWeight="bold" mb={4}>
        知識庫
      </Typography>
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 4 }}>
        <Tab
          label="新增知識"
          value="new"
          icon={<UploadFileIcon />}
          iconPosition="start"
        />
        <Tab
          label="現有知識"
          value="existing"
          icon={<FolderIcon />}
          iconPosition="start"
        />
        <Tab
          label="配額"
          value="quota"
          icon={<GridOnIcon />}
          iconPosition="start"
        />
      </Tabs>
      {activeTab === 'existing' && renderExistingKnowledge()}
      {activeTab === 'new' && <Typography>新增知識內容將在這裡顯示</Typography>}
      {activeTab === 'quota' && <Typography>配額信息將在這裡顯示</Typography>}
    </Box>
  );
};

export default KnowledgeBaseUI;
