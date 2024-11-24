import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Typography,
  Switch,
  Box,
} from '@mui/material';
import {
  Edit as EditIcon,
  Link as LinkIcon,
  MoreVert as MoreVertIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
} from '@mui/icons-material';
import EditAIAssistantDialog from './EditAIAssistantDialog'; // 确保导入这个组件
import ApiService from './ApiService';

const AIAssistantManagement = () => {
  const [assistants, setAssistants] = useState([
    {
      id: 1,
      name: 'TestAgent',
      description:
        "DO:Be friendly and proactive in helping users resolve their issues. Use casual language and avoid repeating the same sentences. DON'T: Provide generic, unhelpf...",
      status: true,
      unread: 0,
    },
  ]);
  const [viewMode, setViewMode] = useState('list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);

  const fetchAssistants = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await ApiService.fetchAssistants();
      setAssistants(data);
    } catch (error) {
      console.error('Failed to fetch assistants data:', error);
      alert('獲取助理列表失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssistants();
  }, [fetchAssistants]);

  const handleStatusChange = id => {
    setAssistants(
      assistants.map(assistant =>
        assistant.id === id
          ? { ...assistant, status: !assistant.status }
          : assistant
      )
    );
  };

  const handleOpenDialog = (assistant = null) => {
    console.log('open dialog');
    console.log(assistant);

    setEditingAssistant(assistant);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAssistant(null);
  };

  const handleSaveAssistant = async updatedAssistant => {
    /*
    if (editingAssistant) {
      setAssistants(
        assistants.map(assistant =>
          assistant.id === editingAssistant.id ? updatedAssistant : assistant
        )
      );
    } else {
      setAssistants([...assistants, { ...updatedAssistant, id: Date.now() }]);
    }
    handleCloseDialog();*/
    // 重新獲取列表數據
    await fetchAssistants();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h4">AI助理</Typography>
        <Box>
          <IconButton
            onClick={() => setViewMode('list')}
            color={viewMode === 'list' ? 'primary' : 'default'}
          >
            <ListViewIcon />
          </IconButton>
          <IconButton
            onClick={() => setViewMode('grid')}
            color={viewMode === 'grid' ? 'primary' : 'default'}
          >
            <GridViewIcon />
          </IconButton>
          <Button
            variant="contained"
            color="primary"
            sx={{ ml: 2 }}
            onClick={() => handleOpenDialog()}
          >
            + 新增AI助理
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>AI助理名稱</TableCell>
              <TableCell align="center">狀態</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assistants.map(assistant => (
              <TableRow key={assistant.id}>
                <TableCell>
                  <Typography variant="subtitle1">{assistant.name}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {assistant.description}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={assistant.status}
                    onChange={() => handleStatusChange(assistant.id)}
                    color="primary"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small">
                    <LinkIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(assistant)}
                  >
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button disabled>上一頁</Button>
        <Typography sx={{ mx: 2 }}>1</Typography>
        <Button disabled>下一頁</Button>
      </Box>

      <EditAIAssistantDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        aiAssistant={editingAssistant}
        onSaved={handleSaveAssistant}
      />
    </Box>
  );
};

export default AIAssistantManagement;
