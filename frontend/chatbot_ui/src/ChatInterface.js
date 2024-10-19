import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Box, 
  TextField, 
  Button, 
  Paper,
  Container
} from '@mui/material';
import { 
  MoreVert as MoreVertIcon,
  Send as SendIcon
} from '@mui/icons-material';

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { id: 1, text: 'Welcome!', isBot: true }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      setMessages([...messages, { id: messages.length + 1, text: inputMessage, isBot: false }]);
      setInputMessage('');
      // Here you would typically call an API to get the bot's response
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'grey.100' }}>
      {/* Top Navigation Bar */}
      <AppBar position="static" sx={{ background: 'linear-gradient(to right, #4db6ac, #26a69a)' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box sx={{ width: 32, height: 32, bgcolor: 'white', borderRadius: '50%', mr: 1 }} />
            <Typography variant="h6" component="div">
              TestAgent
            </Typography>
          </Box>
          <IconButton color="inherit">
            <MoreVertIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Chat Messages Area */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((message) => (
          <Box 
            key={message.id} 
            sx={{ 
              mb: 2, 
              display: 'flex', 
              justifyContent: message.isBot ? 'flex-start' : 'flex-end'
            }}
          >
            <Paper 
              elevation={1} 
              sx={{ 
                p: 1, 
                bgcolor: message.isBot ? 'white' : 'primary.main', 
                color: message.isBot ? 'text.primary' : 'white'
              }}
            >
              <Typography variant="body1">{message.text}</Typography>
            </Paper>
          </Box>
        ))}
      </Box>

      {/* Input Area */}
      <Paper sx={{ p: 2 }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="對話..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button 
              variant="contained" 
              onClick={handleSendMessage}
              sx={{ minWidth: 'unset' }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Container>
      </Paper>

      {/* Footer */}
      <Box component="footer" sx={{ textAlign: 'center', py: 1, bgcolor: 'background.paper' }}>
        <Typography variant="body2" color="text.secondary">
          
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatInterface;
