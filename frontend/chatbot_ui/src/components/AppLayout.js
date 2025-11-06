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
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon,
  Chat as ChatIcon,
  Dataset as DatasetIcon,
  ExitToApp as ExitToAppIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// 導入其他組件
import ChatInterface from '../feature/chat/ChatInterface';
import KnowledgeBaseUI from '../feature/knowledge/KnowledgeBaseUI';
import AIAssistantSettings from '../feature/setting/AIAssistantSettings';
import AIAssistantManagement from '../feature/setting/AIAssistantManagement';
import AccountProfile from '../feature/setting/AccountProfile';
import ConversationManagement from '../feature/chat/ConversationManagement';

// 導入 ApiService 和 useAuth
import ApiService from '../api/ApiService';
import useAuth from '../hook/useAuth';

export default function AppLayout() {
  const navigate = useNavigate();
  const { logout, isLoading: authLoading } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [selectedMenuItem, setSelectedMenuItem] = useState('conversations');
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [isAIManagementDialogOpen, setIsAIManagementDialogOpen] =
    useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [workspace, setWorkspace] = useState('Kao');
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  function MenuItem({ icon, label, value }) {
    return (
      <ListItem
        button
        selected={selectedMenuItem === value}
        onClick={() => setSelectedMenuItem(value)}
      >
        <ListItemIcon>{icon}</ListItemIcon>
        <ListItemText primary={label} />
      </ListItem>
    );
  }

  function renderContent() {
    switch (selectedMenuItem) {
      case 'chat':
        return <ChatInterface />;
      case 'conversations':
        return <ConversationManagement currentAssistant={currentAgent} />;
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
  }

  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log('ApiService.getUserEmail():', ApiService.getUserEmail());
        setWorkspace(ApiService.getUserEmail() || 'default');
        let alreadyAgents = (await ApiService.getAssistatns()) || [];
        setAgents(alreadyAgents);
        if (alreadyAgents.length > 0) {
          setCurrentAgent(alreadyAgents[0]);
        }
      } catch (error) {
        console.error('Failed to initialize data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  async function refreshAgents() {
    let alreadyAgents = (await ApiService.getAssistatns()) || [];
    setAgents(alreadyAgents);
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleSelectAgent(index) {
    console.log('index:', index)
    console.log('agents: ')
    setCurrentAgentIndex(index);
    const agent = agents[index];
    setCurrentAgent(agent);
  }

  if (authLoading || isLoading) {
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
          <Link href="/" sx={{ flexGrow: 1 }}>
            <Typography variant="h6" color="#fff">
              {workspace}'s Workspace
            </Typography>
          </Link>
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
              disabled={agents.length === 0}
              onClick={() => setIsChatDialogOpen(false)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              AI 助理對話測試
            </Typography>
          </Toolbar>
        </AppBar>
        {currentAgent && (
          <ChatInterface
            assistantid={currentAgent.assistant_id}
            assistantname={currentAgent.name}
            assistant={currentAgent}
          />
        )}
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
        <AIAssistantManagement onRefresh={refreshAgents} />
      </Dialog>
    </Box>
  );
}
