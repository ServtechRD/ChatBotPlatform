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

const KnowledgeBaseItem = ({ icon, title, description }) => (
  <Card sx={{ height: '100%' }}>
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
  const [activeTab, setActiveTab] = useState('new');
  const [selectedItem, setSelectedItem] = useState(null);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchKnowledgeItems().then(items => {
      setKnowledgeItems(items);
      setIsLoading(false);
    });
  }, []);

  const handleTabChange = newValue => {
    setActiveTab(newValue);
    setSelectedItem(null);
  };

  const handleItemClick = item => {
    setSelectedItem(item);
  };

  const handleBackClick = () => {
    setSelectedItem(null);
  };

  const sections = [
    {
      title: '從網路匯入',
      items: [
        {
          icon: <LinkIcon />,
          title: '匯入網址',
          description: '從網頁上的文字和連結回答',
        },
        {
          icon: <MapIcon />,
          title: '匯入站點地圖',
          description: '站點地圖 URL 通常是 .xml 文件',
        },
      ],
    },
    {
      title: '上傳檔案',
      items: [
        {
          icon: <FileSpreadsheetIcon />,
          title: '上傳試算表',
          description: '支援 .csv、.xls、.xlsx、.xlsm、.xlsb...',
        },
        {
          icon: <FileTextIcon />,
          title: '上傳文件',
          description: '支援 20 多種文件格式',
        },
        {
          icon: <FileJsonIcon />,
          title: '從模板文件上傳',
          description: '.csv 和 .json 格式',
        },
        {
          icon: <VideoIcon />,
          title: '轉錄音訊/視訊',
          description: '長度最多 15 分鐘',
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
        <Button
          variant={activeTab === 'quota' ? 'contained' : 'outlined'}
          onClick={() => handleTabChange('quota')}
          startIcon={<GridOnIcon />}
        >
          配額
        </Button>
      </Box>
      <Divider sx={{ mb: 4 }} />
      {activeTab === 'new' && renderNewKnowledge()}
      {activeTab === 'existing' && renderExistingKnowledge()}
      {activeTab === 'quota' && <Typography>配額信息將在這裡顯示</Typography>}
    </Box>
  );
};

export default KnowledgeBaseUI;
