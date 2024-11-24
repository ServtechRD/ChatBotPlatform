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
import { formatImageUrl } from './utils/urlUtils';

const CHAT_WIDTH = 398;
const CHAT_HEIGHT = 598;
const MESSAGE_TOP_LIMIT = CHAT_HEIGHT / 3;

const ChatInterface = ({ assistantid, assistantname, assistant }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: 'Welcome!', isBot: true },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState('');

  const socketRef = useRef(null);
  const customerIdRef = useRef(uuidv4()); // 生成随机的 customer_id
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const videoRef = useRef(null);

  // 控制消息滾動
  const scrollToBottom = () => {
    if (messagesContainerRef.current && messagesEndRef.current) {
      const container = messagesContainerRef.current;
      const scrollHeight = container.scrollHeight;
      const height = container.clientHeight;
      const maxScroll = scrollHeight - height;

      // 計算最小滾動位置（確保消息不會超過頂部 1/3）
      const minScroll = Math.max(0, scrollHeight - MESSAGE_TOP_LIMIT);

      // 設置滾動位置
      container.scrollTop = Math.max(maxScroll, minScroll);
    }
  };

  // 當消息更新時滾動
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    console.log('name  = ' + assistantname);
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
      console.log('recv ' + message);
      if (message === '@@@') {
        console.log('is think');
        setIsThinking(true);
      } else if (message === '###') {
        console.log('stop thinking');
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
  }, [assistantid, assistantname]);

  const getBackgroundContent = () => {
    if (assistant?.video_1) {
      return (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        >
          <source src={formatImageUrl(assistant.video_1)} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      );
    } else if (assistant?.assistant_image) {
      return (
        <img
          src={formatImageUrl(assistant.assistant_image)}
          alt="background"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        />
      );
    }
    return null;
  };

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
        width: CHAT_WIDTH,
        height: CHAT_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        bgcolor: '#000',
        overflow: 'hidden',
        margin: 'auto', // 置中顯示
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* 背景媒體內容 */}
      {getBackgroundContent()}

      {/* 遮罩層 
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.4)', // 調整透明度
          backdropFilter: 'blur(2px)', // 輕微模糊效果
        }}
      />
      */}

      {/* 主要內容區域 */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      ></Box>

      {/* 標題區域 */}
      <Box
        sx={{
          p: 2,
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: 'white',
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            fontSize: '1.1rem',
          }}
        >
          {assistantname || '智能助理'}
        </Typography>
      </Box>

      {/* 問題提示 */}
      <Box
        sx={{
          p: 1.5,
          textAlign: 'center',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            display: 'inline-block',
            p: 1.5,
            bgcolor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 2,
            maxWidth: '90%',
          }}
        >
          <Typography
            variant="body1"
            sx={{
              color: 'white',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            我是科智企業的客服，需要什麼協助？
          </Typography>
        </Paper>
      </Box>

      {/* 消息區域 */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: '2px',
          },
        }}
      >
        {messages.map(message => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              justifyContent: message.isBot ? 'flex-start' : 'flex-end',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                maxWidth: '85%',
                bgcolor: message.isBot
                  ? 'rgba(255, 255, 255, 0.95)'
                  : 'rgba(25, 118, 210, 0.95)',
                borderRadius: 2,
                backdropFilter: 'blur(5px)',
              }}
            >
              <Typography
                sx={{
                  color: message.isBot ? 'black' : 'white',
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                }}
              >
                {message.text}
              </Typography>
            </Paper>
          </Box>
        ))}

        {isThinking && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                bgcolor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CircularProgress size={20} />
              <Typography>思考中...</Typography>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* 輸入區域 */}
      <Box sx={{ p: 2 }}>
        <Paper
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 1,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 3,
            backdropFilter: 'blur(5px)',
          }}
        >
          <TextField
            fullWidth
            variant="standard"
            placeholder="Type here..."
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            InputProps={{
              disableUnderline: true,
              sx: {
                px: 2,
                '& input': {
                  color: 'rgba(0, 0, 0, 0.87)',
                },
              },
            }}
          />
          <IconButton
            onClick={handleSendMessage}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground',
              },
            }}
            disabled={!isConnected || !inputMessage.trim()}
          ></IconButton>
        </Paper>
      </Box>

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
