import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Divider,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Checkbox,
  IconButton,
} from '@mui/material';
import {
  Link as LinkIcon,
  Map as MapIcon,
  TableChart as FileSpreadsheetIcon,
  Description as FileTextIcon,
  Code as FileJsonIcon,
  Videocam as VideoIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Folder as FolderIcon,
  UploadFile as UploadFileIcon,
  Add as AddIcon,
  GridOn as GridOnIcon,
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

import FileUploadDialog from './FileUploadDialog';
import ApiService from './ApiService';

// 保留原有的 IconWrapper 和 KnowledgeBaseItem 組件
const IconWrapper = ({ children }) => (
  <Box
    sx={{
      width: 40,
      height: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      bgcolor: 'grey.100',
    }}
  >
    {children}
  </Box>
);

const KnowledgeBaseUI = ({ currentAssistant }) => {
  const [activeTab, setActiveTab] = useState('new');
  const [selectedItem, setSelectedItem] = useState(null);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState(null);

  useEffect(() => {
    fetchKnowledgeItems().then(items => {
      setKnowledgeItems(items);
      setIsLoading(false);
    });
  }, []);

  const handleKnowledgeItemClick = type => {
    setUploadType(type);
    setIsUploadDialogOpen(true);
  };

  const handleUploadComplete = file => {
    // 這裡可以處理上傳完成後的邏輯
    console.log('File uploaded:', file);
    setIsUploadDialogOpen(false);
  };

  const KnowledgeBaseItem = ({ icon, title, description, type }) => (
    <Card
      sx={{ height: '100%', cursor: 'pointer' }}
      onClick={() => handleKnowledgeItemClick(type)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconWrapper>{icon}</IconWrapper>
          <Typography variant="h6" sx={{ ml: 2 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );

  // Mock API function
  const fetchKnowledgeItems = () => {
    try {
      const data = ApiService.getKnowledgeBases(assistantId);

      setKnowledgeItems(data);

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetch knowledge items:', error);
      setIsLoading(false);
    }

    /*
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
    });*/
  };

  const handleItemClick = itemId => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  const filteredItems = knowledgeItems.filter(
    item =>
      item.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.summary &&
        item.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.keywords &&
        item.keywords.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleTabChange = newValue => {
    setActiveTab(newValue);
    setSelectedItem(null);
  };

  const handleBackClick = () => {
    setSelectedItem(null);
  };

  const sections = [
    {
      title: '上傳',
      items: [
        {
          icon: <FileTextIcon />,
          title: '上傳文件或網址',
          description: '支援pdf / docx / txt',
        },
      ],
    },
    {
      title: '手動輸入',
      items: [
        {
          icon: <EditIcon />,
          title: '編寫新的知識庫文檔',
          description: '手動輸入文檔',
        },
      ],
    },
  ];

  const renderNewKnowledge = () => (
    <>
      <Typography variant="h4" fontWeight="bold" mb={4}>
        新增知識
      </Typography>
      {sections.map((section, index) => (
        <Box key={index} sx={{ mb: 8 }}>
          <Typography variant="h5" fontWeight="bold" mb={3}>
            {section.title}
          </Typography>
          <Grid container spacing={4}>
            {section.items.map((item, itemIndex) => (
              <Grid item xs={12} md={6} lg={3} key={itemIndex}>
                <KnowledgeBaseItem
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </>
  );

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
              filteredItems.map((item, index) => (
                <Paper key={index} elevation={1} sx={{ mb: 2 }}>
                  <ListItem
                    button
                    onClick={() => handleItemClick(index)}
                    sx={{ flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        width: '100%',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: expandedItem === index ? 2 : 0,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ListItemIcon>
                          <FileTextIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.file_name}
                          secondary={`${item.token_count} Tokens`}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton
                          onClick={e => {
                            e.stopPropagation();
                            handleItemClick(index);
                          }}
                          sx={{ mr: 1 }}
                        >
                          {expandedItem === index ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={e => {
                            e.stopPropagation();
                            // 處理更多選項
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    <Collapse
                      in={expandedItem === index}
                      timeout="auto"
                      unmountOnExit
                    >
                      <Box sx={{ px: 2, pb: 2 }}>
                        <Typography
                          variant="subtitle2"
                          color="primary"
                          gutterBottom
                        >
                          摘要
                        </Typography>
                        <Typography variant="body2" paragraph>
                          {item.summary}
                        </Typography>
                        {item.keywords && (
                          <>
                            <Typography
                              variant="subtitle2"
                              color="primary"
                              gutterBottom
                            >
                              關鍵字
                            </Typography>
                            <Typography variant="body2">
                              {item.keywords}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Collapse>
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
      <Box sx={{ mb: 4 }}>
        <Button
          variant={activeTab === 'new' ? 'contained' : 'outlined'}
          onClick={() => handleTabChange('new')}
          startIcon={<AddIcon />}
          sx={{ mr: 2 }}
        >
          新增知識
        </Button>
        <Button
          variant={activeTab === 'existing' ? 'contained' : 'outlined'}
          onClick={() => handleTabChange('existing')}
          startIcon={<FolderIcon />}
          sx={{ mr: 2 }}
        >
          現有知識
        </Button>
      </Box>
      <Divider sx={{ mb: 4 }} />
      {activeTab === 'new' && renderNewKnowledge()}
      {activeTab === 'existing' && renderExistingKnowledge()}
      <FileUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadComplete={handleUploadComplete}
        uploadType={uploadType}
        assistantId={currentAssistant?.assistant_id}
      />
    </Box>
  );
};

export default KnowledgeBaseUI;
