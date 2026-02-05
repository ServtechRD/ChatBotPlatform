import React, { useState, useEffect, useCallback } from 'react';
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
import EditAIAssistantDialog from './EditAIAssistantDialog';
import ApiService from '../../api/ApiService';
import useAuth from '../../hook/useAuth';

const AIAssistantManagement = ({ onRefresh }) => {
  const { user } = useAuth();
  const [assistants, setAssistants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState(null);

  const fetchAssistants = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await ApiService.fetchAssistants();
      console.log('fetchAssistants data:', data);
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
        assistant.assistant_id === id
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
    if (onRefresh) {
      onRefresh();
    }
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
            disabled={user?.permission_level < 3}
          >
            + 新增AI助理
          </Button>
        </Box>
      </Box>
      {isLoading ? (
        <Typography>載入中...</Typography>
      ) : (
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
              {assistants.map((assistant, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Typography variant="subtitle1">
                      {assistant.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {assistant.description}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={assistant.status}
                      onChange={e => handleStatusChange(assistant.assistant_id)}
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
      )}

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
