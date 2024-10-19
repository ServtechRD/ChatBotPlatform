import React, { useState } from 'react';
import { 
  Button, 
  Input, 
  AppBar, 
  Toolbar, 
  Typography, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  ChevronDown, 
  Help as HelpIcon,
  Person as UserIcon,
  Link as LinkIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';

// AppLayout Component
const AppLayout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  const MenuItem = ({ icon, label, active }) => (
    <ListItem button selected={active}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItem>
  );

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Drawer variant="persistent" open={isMenuOpen} sx={{ width: 240, flexShrink: 0 }}>
        <List>
          <MenuItem icon={<MenuIcon />} label="對話" />
          <MenuItem icon={<MenuIcon />} label="模板對話" />
          <MenuItem icon={<MenuIcon />} label="AI助理設置" active />
          {/* Add other menu items here */}
        </List>
      </Drawer>
      <div style={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Button color="inherit" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <MenuIcon />
            </Button>
            <Typography variant="h6" style={{ flexGrow: 1 }}>
              kao's Workspace
            </Typography>
            <Button color="inherit">TestAgent</Button>
            <Button color="inherit">測試AI助理</Button>
            <HelpIcon />
            <UserIcon />
          </Toolbar>
        </AppBar>
        <main style={{ padding: '20px' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

// AI Assistant Management Component
const AIAssistantManagement = () => {
  const [assistants] = useState([
    {
      id: 1,
      name: 'TestAgent',
      description: 'DO:Be friendly and proactive in helping users resolve their issues. Use casual language and avoid repeating the same sentences. DON\'T: Provide generic, unhelpf...',
      status: true,
      unread: 0
    }
  ]);

  return (
    <div>
      <Typography variant="h4" gutterBottom>AI助理</Typography>
      <Button variant="contained" color="primary">+ 新增AI助理</Button>
      <TableContainer component={Paper} style={{ marginTop: '20px' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>AI助理名稱</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>未讀</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assistants.map((assistant) => (
              <TableRow key={assistant.id}>
                <TableCell>
                  <Typography variant="subtitle1">{assistant.name}</Typography>
                  <Typography variant="body2">{assistant.description}</Typography>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="contained" 
                    size="small" 
                    color={assistant.status ? "success" : "error"}
                  >
                    {assistant.status ? '啟用' : '停用'}
                  </Button>
                </TableCell>
                <TableCell>{assistant.unread}</TableCell>
                <TableCell>
                  <Button size="small"><LinkIcon /></Button>
                  <Button size="small"><EditIcon /></Button>
                  <Button size="small"><MoreVertIcon /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

// Other components (AccountProfile, ImageUploadComponent, FileUploadDialog, ChatInterface) 
// can be similarly updated to use MUI components

// Main Integrated App View Component
const IntegratedAppView = () => {
  const [currentView, setCurrentView] = useState('aiAssistant');
  const [isFileUploadDialogOpen, setIsFileUploadDialogOpen] = useState(false);

  const renderCurrentView = () => {
    switch(currentView) {
      case 'aiAssistant':
        return <AIAssistantManagement />;
      // Implement other views
      default:
        return <div>选择一个视图</div>;
    }
  };

  return (
    <AppLayout>
      <div>
        <Button onClick={() => setCurrentView('aiAssistant')}>AI助理管理</Button>
        <Button onClick={() => setCurrentView('account')}>账户资料</Button>
        <Button onClick={() => setCurrentView('imageUpload')}>图片上传</Button>
        <Button onClick={() => setCurrentView('chat')}>聊天界面</Button>
        <Button onClick={() => setIsFileUploadDialogOpen(true)}>打开文件上传对话框</Button>
      </div>
      
      {renderCurrentView()}
      
      <Dialog open={isFileUploadDialogOpen} onClose={() => setIsFileUploadDialogOpen(false)}>
        <DialogTitle>讓我們為AI助理建立一個知識</DialogTitle>
        <DialogContent>
          <DialogContentText>
            你可以在此拖放一個小文件
          </DialogContentText>
          {/* Implement file drop zone */}
          <Input type="url" placeholder="網站網址" fullWidth style={{ marginTop: '20px' }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsFileUploadDialogOpen(false)}>取消</Button>
          <Button onClick={() => setIsFileUploadDialogOpen(false)} color="primary">確認</Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
};

export default IntegratedAppView;
