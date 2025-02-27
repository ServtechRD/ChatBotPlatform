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
import { v4 as uuidv4 } from 'uuid';
import { formatImageUrl } from '../utils/urlUtils';

const CHAT_WIDTH = 398;
const CHAT_HEIGHT = 598;
const MESSAGE_TOP_LIMIT = CHAT_HEIGHT / 2;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

const EmbeddableChatInterface = ({
  assistantUrl, // 助手ID作為參數傳入
  //assistantName = null, // 可選參數
  //apiBaseUrl = '', // API基礎URL，方便跨域使用
  containerStyle = {}, // 容器樣式自定義
  onLoad = () => {}, // 加載完成回調
  onError = () => {}, // 錯誤回調
}) => {
  const [assistantId, setAssistantId] = useState([]);
  const [assistantName, setAssistantName] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [assistant, setAssistant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const customerIdRef = useRef(uuidv4());
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const videoRef = useRef(null);
  const welcomeMessageShownRef = useRef(false);

  // 獲取助手信息
  useEffect(() => {
    // 添加一個標誌來防止重複請求
    let isMounted = true;

    const fetchAssistant = async () => {
      try {
        console.log('fetch Assistant');
        const baseURL = `${window.location.protocol}//${window.location.hostname}:36100`;
        // 從API獲取助手信息
        console.log(`fetch api ${baseURL}/api/embed/assistant/${assistantUrl}`);
        const response = await fetch(
          `${baseURL}/api/embed/assistant/${assistantUrl}`
        );

        // 檢查組件是否仍然掛載
        if (!isMounted) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch assistant: ${response.status}`);
        }

        const data = await response.json();
        console.log(data);
        setAssistantId(data.id);
        setAssistantName(data.name);
        setAssistant(data);
        setIsLoading(false);

        //onLoad(data);

        // 使用函數方式調用避免依賴關係
        if (typeof onLoad === 'function') onLoad(data);
      } catch (err) {
        // 檢查組件是否仍然掛載
        if (!isMounted) return;

        console.error('Error fetching assistant:', err);
        setError(err.message);
        setIsLoading(false);
        //onError(err);
        // 使用函數方式調用避免依賴關係
        if (typeof onError === 'function') onError(err);
      }
    };

    fetchAssistant();
    // 清理函數
    return () => {
      isMounted = false;
    };
  }, [assistantUrl]);

  // 滚动控制
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const scrollHeight = container.scrollHeight;
      const height = container.clientHeight;
      const maxScroll = scrollHeight - height;

      // 確保滾動位置使得消息只顯示在下半部分
      const minScroll = Math.max(0, scrollHeight - height / 2);

      requestAnimationFrame(() => {
        // 設置滾動位置，確保最少滾動到minScroll
        container.scrollTop = Math.max(maxScroll, minScroll);
      });
    }
  };

  // 消息更新时滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // WebSocket连接
  useEffect(() => {
    if (!assistant || !assistantId) return;

    // 只在首次加載時顯示歡迎訊息
    if (!welcomeMessageShownRef.current && assistant?.message_welcome) {
      setMessages([
        { id: Date.now(), text: assistant.message_welcome, isBot: true },
      ]);
      welcomeMessageShownRef.current = true;
    }

    // 建立WebSocket连接
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:36100/ws/assistant/${assistantId}/${customerIdRef.current}`;

    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('WebSocket connection established.');
      setIsConnected(true);
    };

    socketRef.current.onmessage = event => {
      const message = event.data;
      console.log('recv ' + message);
      if (message === '@@@') {
        console.log('is think');
        setIsThinking(true);
        setTimeout(scrollToBottom, 100);
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

    // 組件卸載時關閉WebSocket
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [assistantId, assistant]);

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
    return (
      <img
        src={formatImageUrl('images/default.jpg')}
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
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && isConnected) {
      // 发送消息到WebSocket
      socketRef.current.send(inputMessage);

      // 添加用户消息到聊天界面
      setMessages(prevMessages => [
        ...prevMessages,
        { id: Date.now(), text: inputMessage, isBot: false },
      ]);
      setInputMessage('');
    }
  };

  // 加載中顯示
  if (isLoading) {
    return (
      <Box
        sx={{
          width: CHAT_WIDTH,
          height: CHAT_HEIGHT,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          ...containerStyle,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // 錯誤顯示
  if (error) {
    return (
      <Box
        sx={{
          width: CHAT_WIDTH,
          height: CHAT_HEIGHT,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          p: 2,
          ...containerStyle,
        }}
      >
        <Typography color="error" gutterBottom>
          加載錯誤
        </Typography>
        <Typography variant="body2">{error}</Typography>
      </Box>
    );
  }

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
        margin: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        ...containerStyle,
      }}
    >
      {/* 背景媒體內容 */}
      {getBackgroundContent()}

      {/* 主要內容區域 */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* 標題區域 */}
        <Box
          sx={{
            p: 1.5,
            textAlign: 'left',
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
              {assistant?.name || assistantName || '智能助理'}
              {/*isConnected ? ' Connected' : ' Disconnected'*/} ID:{' '}
              {customerIdRef.current.slice(0, 8)}
            </Typography>
          </Paper>
        </Box>

        {/* 消息區域 */}
        <Box
          ref={messagesContainerRef}
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            position: 'relative',
            '&::before': {
              content: '""',
              display: 'block',
              minHeight: '50%',
              pointerEvents: 'none',
            },
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
          <Box
            sx={{
              mt: 'auto', // 自動將消息推至底部
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              width: '100%',
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
            <div
              ref={messagesEndRef}
              style={{ float: 'left', clear: 'both' }}
            />
          </Box>
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
                m: 0.5,
                bgcolor: 'primary.main',
                color: 'white',
                transform: 'rotate(-45deg)',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '&:disabled': {
                  bgcolor: 'action.disabledBackground',
                },
              }}
              disabled={!isConnected || !inputMessage.trim()}
            >
              <SendIcon
                fontSize="small"
                sx={{
                  fontSize: '1.2rem',
                }}
              />
            </IconButton>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default EmbeddableChatInterface;
