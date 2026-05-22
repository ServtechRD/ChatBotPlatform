import React, { useState, useEffect } from 'react';
import {
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Box,
} from '@mui/material';
import {
  Description as FileTextIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FileUploadDialog from './FileUploadDialog';
import TextInputDialog from './TextInputDialog';
import { knowledge } from '../../api/knowledge.js';
import useAuth from '../../hook/useAuth';
import { useAssistant } from '../../context/AssistantContext.jsx';

export default function KnowledgeExistingPage() {
  const { user } = useAuth();
  const { currentAgent } = useAssistant();
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState(null);
  const [isFetchingEditContent, setIsFetchingEditContent] = useState(false);
  const [knowledgeMenuAnchor, setKnowledgeMenuAnchor] = useState(null);
  const [knowledgeMenuItem, setKnowledgeMenuItem] = useState(null);
  const knowledgeMenuOpen = Boolean(knowledgeMenuAnchor);

  const assistantId = currentAgent?.assistant_id;

  function closeKnowledgeMenu() {
    setKnowledgeMenuAnchor(null);
    setKnowledgeMenuItem(null);
  }

  useEffect(() => {
    if (!assistantId) return;
    fetchKnowledgeItems();
  }, [assistantId]);

  async function fetchKnowledgeItems() {
    try {
      setIsLoading(true);
      const response = await knowledge.get(assistantId);
      setKnowledgeItems(response.data);
    } catch (error) {
      console.error('Error fetch knowledge items:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTextSubmitComplete(data) {
    try {
      if (uploadType === 'edit_text' && data?.id) {
        setKnowledgeItems(prev =>
          prev.map(item => (item.id === data.id ? { ...item, ...data } : item))
        );
      } else if (data?.id) {
        setKnowledgeItems(prev => [data, ...prev]);
      } else {
        await fetchKnowledgeItems();
      }
    } catch (err) {
      console.error('更新知識清單失敗:', err);
    } finally {
      setIsTextDialogOpen(false);
      setSelectedItem(null);
      setUploadType(null);
    }
  }

  function handleItemClick(idx) {
    setExpandedItem(expandedItem === idx ? null : idx);
  }

  async function handleDeleteKnowledge(item) {
    if (!item?.id || !assistantId) return;
    const ok = window.confirm(
      `確定要刪除「${item.file_name || item.id}」嗎？此操作無法復原。`
    );
    if (!ok) return;
    try {
      await knowledge.del(assistantId, item.id);
      await fetchKnowledgeItems();
    } catch (err) {
      console.error('刪除知識失敗:', err);
      alert('刪除失敗，請稍後再試');
    }
  }

  async function handleEditKnowledge(item) {
    if (!item.id) return;
    setSelectedItem(item);
    setUploadType('edit_text');
    setEditingContent('');
    setIsFetchingEditContent(true);
    setIsTextDialogOpen(true);
    try {
      const response = await knowledge.getContent(assistantId, item.id);
      setEditingContent(response.content);
    } catch (err) {
      console.error('Failed to load content:', err);
      alert('無法載入文件內容');
      setIsTextDialogOpen(false);
      setSelectedItem(null);
      setUploadType(null);
      setEditingContent('');
    } finally {
      setIsFetchingEditContent(false);
    }
  }

  const filteredItems = knowledgeItems.filter(
    item =>
      (item.file_name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (item.summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.keywords || '').toLowerCase().includes(searchTerm.toLowerCase())
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
        {isLoading && <Typography>讀取中...</Typography>}
        {!isLoading &&
          filteredItems.map((item, index) => (
            <Paper key={item.id ?? index} elevation={1} sx={{ mb: 2 }}>
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
                    <ListItemText primary={item.file_name} />
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
                        setKnowledgeMenuAnchor(e.currentTarget);
                        setKnowledgeMenuItem(item);
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
                    <Box>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {item.summary ?? ''}
                      </ReactMarkdown>
                    </Box>
                    {item.keywords && (
                      <>
                        <Typography
                          variant="subtitle2"
                          color="primary"
                          gutterBottom
                        >
                          關鍵字
                        </Typography>
                        <Box>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {item.keywords ?? ''}
                          </ReactMarkdown>
                        </Box>
                      </>
                    )}
                  </Box>
                </Collapse>
              </ListItem>
            </Paper>
          ))}
      </List>

      <Menu
        anchorEl={knowledgeMenuAnchor}
        open={knowledgeMenuOpen}
        onClose={closeKnowledgeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        onClick={e => e.stopPropagation()}
      >
        <MenuItem
          sx={{
            display: !(knowledgeMenuItem?.file_name || '')
              .toLowerCase()
              .endsWith('.txt')
              ? 'none'
              : 'block',
          }}
          disabled={
            !(knowledgeMenuItem?.file_name || '')
              .toLowerCase()
              .endsWith('.txt')
          }
          onClick={e => {
            e.stopPropagation();
            const row = knowledgeMenuItem;
            closeKnowledgeMenu();
            if (row) handleEditKnowledge(row);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>編輯</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={user?.permission_level < 2}
          onClick={e => {
            e.stopPropagation();
            const row = knowledgeMenuItem;
            closeKnowledgeMenu();
            if (row) handleDeleteKnowledge(row);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>刪除</ListItemText>
        </MenuItem>
      </Menu>

      <FileUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadComplete={() => fetchKnowledgeItems()}
        uploadType={uploadType}
        assistantId={assistantId}
      />
      <TextInputDialog
        isOpen={isTextDialogOpen}
        onClose={() => {
          setIsTextDialogOpen(false);
          setSelectedItem(null);
          setUploadType(null);
          setIsFetchingEditContent(false);
        }}
        onSubmitComplete={handleTextSubmitComplete}
        assistantId={assistantId}
        initialContent={uploadType === 'edit_text' ? editingContent : ''}
        initialFileName={selectedItem?.file_name || ''}
        isEditMode={uploadType === 'edit_text'}
        knowledgeId={selectedItem?.id}
        isLoadingEditContent={isFetchingEditContent}
      />
    </>
  );
}
