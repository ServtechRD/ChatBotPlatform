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
  IconButton
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Chat as ChatIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  Person as UserIcon,
  Close as CloseIcon,
  Group as GroupIcon,
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
  const [agentName, setAgentName] = useState('TestAgent'); // 假设这是一个可变的名称

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
      case 'aiAssistantMgr':
        return <AIAssistantManagement />
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
            kao's Workspace
          </Typography>
          <Button color="inherit">
            {agentName}
          </Button>
          <Button color="inherit" onClick={() => setIsChatDialogOpen(true)} >測試AI助理</Button>
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
            <MenuItem icon={<GroupIcon />} label="AI助理管理" value="aiAssistantMgr" />
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
