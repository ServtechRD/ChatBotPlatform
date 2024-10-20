import React, { useState, useEffect, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  TextField,
  Button,
  Paper,
  Container,
  CircularProgress,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid'; // 请确保安装了 uuid 库

const ChatInterface = ({ assistantid, assistantname }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: 'Welcome!', isBot: true },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const customerIdRef = useRef(uuidv4()); // 生成随机的 customer_id

  useEffect(() => {
    // 建立 WebSocket 连接
    socketRef.current = new WebSocket(
      `ws://192.168.1.234:36100/ws/assistant/${assistantid}/${customerIdRef.current}`
    );

    socketRef.current.onopen = () => {
      console.log('WebSocket connection established.');
      setIsConnected(true);
    };

    socketRef.current.onmessage = event => {
      /*const assistantReply = event.data;
      setMessages(prevMessages => [
        ...prevMessages,
        { id: Date.now(), text: assistantReply, isBot: true },
      ]);*/
      const message = event.data;
      if (message === '@@@') {
        setIsThinking(true);
      } else if (message === '###') {
        setIsThinking(false);
      } else {
        setMessages(prevMessages => [
          ...prevMessages,
          { id: Date.now(), text: message, isBot: true },
        ]);
      }
    };

    socketRef.current.onclose = () => {
      console.log('WebSocket connection closed.');
      setIsConnected(false);
    };

    // 组件卸载时关闭 WebSocket 连接
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [assistantid]);

  const handleSendMessage = () => {
    if (inputMessage.trim() && isConnected) {
      // 发送消息到 WebSocket
      socketRef.current.send(inputMessage);

      // 添加用户消息到聊天界面
      setMessages(prevMessages => [
        ...prevMessages,
        { id: Date.now(), text: inputMessage, isBot: false },
      ]);
      setInputMessage('');
    }
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'grey.100',
      }}
    >
      {/* Top Navigation Bar */}
      <AppBar
        position="static"
        sx={{ background: 'linear-gradient(to right, #4db6ac, #26a69a)' }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'white',
                borderRadius: '50%',
                mr: 1,
              }}
            />
            <Typography variant="h6" component="div">
              {assistantname}
            </Typography>
          </Box>
          <IconButton color="inherit">
            <MoreVertIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Chat Messages Area */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {messages.map(message => (
          <Box
            key={message.id}
            sx={{
              mb: 2,
              display: 'flex',
              justifyContent: message.isBot ? 'flex-start' : 'flex-end',
            }}
          >
            <Paper
              elevation={1}
              sx={{
                p: 1,
                bgcolor: message.isBot ? 'white' : 'primary.main',
                color: message.isBot ? 'text.primary' : 'white',
              }}
            >
              <Typography variant="body1">{message.text}</Typography>
            </Paper>
          </Box>
        ))}

        {isThinking && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper elevation={1} sx={{ p: 1, bgcolor: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body1">思考中...</Typography>
              </Box>
            </Paper>
          </Box>
        )}
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
              onChange={e => setInputMessage(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
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
      <Box
        component="footer"
        sx={{ textAlign: 'center', py: 1, bgcolor: 'background.paper' }}
      >
        <Typography variant="body2" color="text.secondary">
          {isConnected ? 'Connected' : 'Disconnected'} | Session ID:{' '}
          {customerIdRef.current.slice(0, 8)}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatInterface;
