import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  Checkbox,
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
  Collapse,
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

import FileUploadDialog from './FileUploadDialog';
import TextInputDialog from './TextInputDialog';
import ApiService from '../../api/ApiService';
import useAuth from '../../hook/useAuth';

function IconWrapper({ children }) {
  return (
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
}

function KnowledgeBaseItem({ icon, title, description, onClick }) {
  return (
    <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={onClick}>
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
}

export default function KnowledgeBaseUI({ currentAssistant }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new');
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItem, setExpandedItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState(null);

  useEffect(() => {
    if (!currentAssistant?.assistant_id) return;
    fetchKnowledgeItems();
  }, [currentAssistant]);

  async function fetchKnowledgeItems() {
    try {
      setIsLoading(true);
      const assistantId = currentAssistant?.assistant_id;
      const response = await ApiService.getKnowledgeBases(assistantId);
      setKnowledgeItems(response.data);
    } catch (error) {
      console.error('Error fetch knowledge items:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKnowledgeItemClick(type) {
    setUploadType(type);
    if (type === '上傳文件或網址') setIsUploadDialogOpen(true);
    else setIsTextDialogOpen(true);
  }

  async function handleUploadComplete(data) {
    if (data && data.id) setKnowledgeItems(prev => [data, ...prev]);
    else await fetchKnowledgeItems();
  }

  async function handleTextSubmitComplete(data) {
    try {
      if (data && data.id) setKnowledgeItems(prev => [data, ...prev]);
      else await fetchKnowledgeItems();
    } catch (err) {
      console.error('更新知識清單失敗:', err);
    } finally {
      setIsTextDialogOpen(false);
    }
  }

  function handleItemClick(idx) {
    setExpandedItem(expandedItem === idx ? null : idx);
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setSelectedItem(null);
  }

  function renderNewKnowledge() {
    const sections = [
      {
        title: '上傳',
        items: [
          {
            icon: <FileTextIcon />,
            title: '上傳文件或網址',
            description: '支援 pdf / docx / txt',
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

    return (
      <>
        <Typography variant="h4" fontWeight="bold" mb={4}>
          新增知識
        </Typography>
        {sections.map((section, i) => (
          <Box key={i} sx={{ mb: 8 }}>
            <Typography variant="h5" fontWeight="bold" mb={3}>
              {section.title}
            </Typography>
            <Grid container spacing={4}>
              {section.items.map((item, j) => (
                <Grid item xs={12} md={6} lg={3} key={j}>
                  <KnowledgeBaseItem
                    icon={item.icon}
                    title={item.title}
                    description={item.description}
                    onClick={() => handleKnowledgeItemClick(item.title)}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </>
    );
  }

  function renderExistingKnowledge() {
    const filteredItems = knowledgeItems.filter(
      item =>
        item.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.keywords?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <>
        <Typography variant="h4" fontWeight="bold" mb={4}>
          現有知識
        </Typography>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="使用關鍵字搜尋"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
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
                        onClick={e => e.stopPropagation()}
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
    );
  }

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
          disabled={user?.permission_level < 2}
        >
          新增知識
        </Button>
        <Button
          variant={activeTab === 'existing' ? 'contained' : 'outlined'}
          onClick={() => handleTabChange('existing')}
          startIcon={<FolderIcon />}
        >
          現有知識
        </Button>
      </Box>

      <Divider sx={{ mb: 4 }} />
      {activeTab === 'new' ? renderNewKnowledge() : renderExistingKnowledge()}

      {/* Dialogs */}
      <FileUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadComplete={handleUploadComplete}
        uploadType={uploadType}
        assistantId={currentAssistant?.assistant_id}
      />
      <TextInputDialog
        isOpen={isTextDialogOpen}
        onClose={() => setIsTextDialogOpen(false)}
        onSubmitComplete={handleTextSubmitComplete}
        assistantId={currentAssistant?.assistant_id}
      />
    </Box>
  );
}
