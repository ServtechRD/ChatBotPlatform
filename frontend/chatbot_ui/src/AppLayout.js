import React, { useState, useEffect } from 'react';
import {
  Button,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Dialog,
  IconButton,
  Menu,
  MenuItem as MuiMenuItem,
  Select,
  CircularProgress,
  getListItemAvatarUtilityClass,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon,
  Chat as ChatIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  Person as UserIcon,
  Close as CloseIcon,
  Dataset as DatasetIcon,
  ExitToApp as ExitToAppIcon, //
} from '@mui/icons-material';

// 导入其他组件
import ChatInterface from './ChatInterface';
import KnowledgeBaseUI from './KnowledgeBaseUI';
import AIAssistantSettings from './AIAssistantSettings';
import AIAssistantManagement from './AIAssistantManagement';
import AccountProfile from './AccountProfile';
import ConversationManagement from './ConversationManagement';

// 导入 ApiService
import ApiService from './ApiService';

const AppLayout = () => {
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [selectedMenuItem, setSelectedMenuItem] = useState('chat');
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [isAIManagementDialogOpen, setIsAIManagementDialogOpen] =
    useState(false);
  const [agentName, setAgentName] = useState('TestAgent');
  const [currentAgent, setCurrentAgent] = useState(null);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);

  const [workspace, setWorkspace] = useState('Kao');
  const [agents, setAgents] = useState([
    { name: 'TestAgent' },
    { name: 'Agent2' },
    { name: 'Agent3' },
  ]);

  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const MenuItem = ({ icon, label, value }) => (
    <ListItem
      button
      selected={selectedMenuItem === value}
      onClick={() => setSelectedMenuItem(value)}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItem>
  );

  const renderContent = () => {
    switch (selectedMenuItem) {
      case 'chat':
        return <ChatInterface />;
      case 'conversations':
        return <ConversationManagement />;
      case 'templateChat':
        return <Typography>模板對話內容</Typography>;
      case 'aiAssistant':
        return <AIAssistantSettings />;
      case 'knowledgeBase':
        return <KnowledgeBaseUI currentAssistant={currentAgent} />;
      case 'account':
        return <AccountProfile />;
      default:
        return <Typography>請選擇一個選項</Typography>;
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await ApiService.fetchUserData();
        setUserData(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setIsLoading(false);
        // 如果获取用户数据失败，可能需要重定向到登录页面
        navigate('/login');
      }
    };

    fetchUserData();
    setWorkspace(ApiService.getUserEmail() || 'default');
    setAgents(ApiService.getAssistatns() || []);
    if (agents.length > 0) {
      setCurrentAgent(agent[0]);
    }
  }, [navigate]);

  const handleLogout = () => {
    ApiService.logout();
    navigate('/login');
  };

  const handleSelectAgent = index => {
    setCurrentAgentIndex(index);
    const agent = agents[index];
    setCurrentAgent(agent);
  };

  if (isLoading) {
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {workspace}'s Workspace
          </Typography>
          <Button
            color="inherit"
            onClick={() => setIsAIManagementDialogOpen(true)}
            sx={{
              mr: 2,
              bgcolor: 'warning.main',
              color: 'warning.contrastText',
              '&:hover': { bgcolor: 'warning.dark' },
            }}
          >
            AI助理管理
          </Button>
          <Select
            value={currentAgentIndex}
            onChange={e => handleSelectAgent(e.target.value)}
            sx={{ color: 'white', mr: 2 }}
          >
            {agents?.map((agent, index) => (
              <MuiMenuItem key={agent.name} value={index}>
                {agent.name}
              </MuiMenuItem>
            ))}
          </Select>
          <Button
            color="inherit"
            onClick={() => setIsChatDialogOpen(true)}
            sx={{
              bgcolor: 'secondary.main',
              '&:hover': { bgcolor: 'secondary.dark' },
            }}
          >
            測試AI助理
          </Button>
          <IconButton color="inherit">
            <HelpIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => setSelectedMenuItem('account')}
          >
            <UserIcon />
          </IconButton>
          <IconButton color="inherit" onClick={handleLogout}>
            <ExitToAppIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Drawer
          variant="persistent"
          open={isMenuOpen}
          sx={{
            width: 240,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 240,
              boxSizing: 'border-box',
              position: 'relative',
            },
          }}
        >
          <List>
            <MenuItem icon={<ChatIcon />} label="對話" value="conversations" />
            <MenuItem
              icon={<SettingsIcon />}
              label="AI助理設定"
              value="aiAssistant"
            />
            <MenuItem
              icon={<DatasetIcon />}
              label="知識庫"
              value="knowledgeBase"
            />
          </List>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          {renderContent()}
        </Box>
      </Box>
      <Dialog
        open={isChatDialogOpen}
        onClose={() => setIsChatDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setIsChatDialogOpen(false)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {agentName}
            </Typography>
          </Toolbar>
        </AppBar>
        <ChatInterface />
      </Dialog>
      <Dialog
        open={isAIManagementDialogOpen}
        onClose={() => setIsAIManagementDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setIsAIManagementDialogOpen(false)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              AI助理管理
            </Typography>
          </Toolbar>
        </AppBar>
        <AIAssistantManagement />
      </Dialog>
    </Box>
  );
};

export default AppLayout;
