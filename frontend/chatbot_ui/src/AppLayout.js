import React, { useState } from 'react';
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
  Select
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Chat as ChatIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  Person as UserIcon,
  Close as CloseIcon,
  Dataset as DatasetIcon,
} from '@mui/icons-material';

// 导入其他组件
import ChatInterface from './ChatInterface';
import KnowledgeBaseUI from './KnowledgeBaseUI';
import AIAssistantSettings from './AIAssistantSettings';
import AIAssistantManagement from './AIAssistantManagement';
import AccountProfile from './AccountProfile';

const AppLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [selectedMenuItem, setSelectedMenuItem] = useState('chat');
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [agentName, setAgentName] = useState('TestAgent');
  const [workspace, setWorkspace] = useState('Kao'); // 新增: 可變的工作區名稱
  const [agents, setAgents] = useState(['TestAgent', 'Agent2', 'Agent3']); // 新增: 假設的 AI 助理列表

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
      case 'templateChat':
        return <Typography>模板對話內容</Typography>;
      case 'aiAssistant':
        return <AIAssistantSettings />;
      case 'knowledgeBase':
        return <KnowledgeBaseUI />;
      case 'account':
        return <AccountProfile />;
      default:
        return <Typography>請選擇一個選項</Typography>;
    }
  };

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
          <Select
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            sx={{ color: 'white', mr: 2 }}
          >
            {agents.map((agent) => (
              <MuiMenuItem key={agent} value={agent}>{agent}</MuiMenuItem>
            ))}
          </Select>
          <Button 
            color="inherit" 
            onClick={() => setIsChatDialogOpen(true)}
            sx={{ 
              bgcolor: 'secondary.main', 
              '&:hover': { bgcolor: 'secondary.dark' } 
            }}
          >
            測試AI助理
          </Button>
          <Button 
            color="inherit" 
            onClick={() => setSelectedMenuItem('aiAssistantMgr')}
            sx={{ 
              ml: 2, 
              bgcolor: 'warning.main', 
              color: 'warning.contrastText',
              '&:hover': { bgcolor: 'warning.dark' } 
            }}
          >
            AI助理管理
          </Button>
          <IconButton color="inherit">
            <HelpIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setSelectedMenuItem('account')}>
            <UserIcon />
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
            <MenuItem icon={<ChatIcon />} label="對話" value="chat" />
            <MenuItem icon={<DescriptionIcon />} label="模板對話" value="templateChat" />
            <MenuItem icon={<SettingsIcon />} label="AI引擎設置" value="aiAssistant" />
            <MenuItem icon={<DatasetIcon />} label="知識庫" value="knowledgeBase" />
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
    </Box>
  );
};

export default AppLayout;