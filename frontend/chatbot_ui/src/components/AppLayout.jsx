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
  MenuItem as MuiMenuItem,
  Select,
  CircularProgress,
} from '@mui/material';
import {
  NavLink,
  Outlet,
  useNavigate,
  useSearchParams,
  Link as RouterLink,
} from 'react-router-dom';
import {
  Menu as MenuIcon,
  Chat as ChatIcon,
  Dataset as DatasetIcon,
  ExitToApp as ExitToAppIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import ChatInterface from '../feature/chat/ChatInterface';
import AIAssistantManagement from '../feature/setting/AIAssistantManagement';
import { storage } from '../api/storage.js';
import useAuth from '../hook/useAuth';
import { AssistantProvider, useAssistant } from '../context/AssistantContext.jsx';
import { ROUTES } from '../constants/routes.js';
import { toWithAssistant } from '../utils/assistantQuery.js';

function SidebarNavItem({ icon, label, to, end }) {
  const [searchParams] = useSearchParams();
  const { currentAgent } = useAssistant();

  return (
    <ListItem
      button
      component={NavLink}
      to={toWithAssistant(to, searchParams, currentAgent?.assistant_id)}
      end={end}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItem>
  );
}

function AppLayoutShell() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout, user, isLoading: authLoading } = useAuth();
  const {
    agents,
    currentAgent,
    currentAgentIndex,
    isLoading: assistantsLoading,
    selectAgentByIndex,
  } = useAssistant();

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [isAIManagementDialogOpen, setIsAIManagementDialogOpen] =
    useState(false);
  const [workspace, setWorkspace] = useState('Kao');

  useEffect(() => {
    setWorkspace(storage.getUserEmail() || 'default');

    function handleStorageChange(e) {
      if (e.key === 'userData' || e.type === 'userDataUpdated') {
        const newEmail = storage.getUserEmail();
        if (newEmail) setWorkspace(newEmail);
      }
    }

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userDataUpdated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataUpdated', handleStorageChange);
    };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (authLoading || assistantsLoading) {
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

  const homeTo = toWithAssistant(
    ROUTES.home,
    searchParams,
    currentAgent?.assistant_id
  );

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
          <RouterLink
            to={homeTo}
            style={{
              flexGrow: 1,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <Typography variant="h6" color="inherit">
              {workspace}'s Workspace
            </Typography>
          </RouterLink>
          {user?.permission_level >= 3 && (
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
          )}
          <Select
            value={currentAgentIndex}
            onChange={e => selectAgentByIndex(e.target.value)}
            sx={{ color: 'white', mr: 2 }}
          >
            {agents?.map((agent, index) => (
              <MuiMenuItem key={agent.assistant_id ?? agent.name} value={index}>
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
            <SidebarNavItem
              icon={<ChatIcon />}
              label="對話"
              to={ROUTES.home}
              end
            />
            {user?.permission_level >= 2 && (
              <SidebarNavItem
                icon={<DatasetIcon />}
                label="知識庫"
                to={ROUTES.knowledgeBase}
              />
            )}
          </List>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
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
        <AIAssistantManagement open={isAIManagementDialogOpen} />
      </Dialog>
    </Box>
  );
}

export default function AppLayout() {
  return (
    <AssistantProvider>
      <AppLayoutShell />
    </AssistantProvider>
  );
}
