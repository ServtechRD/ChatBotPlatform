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
  Mic as MicIcon,
} from '@mui/icons-material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { v4 as uuidv4 } from 'uuid';
import { formatImageUrl } from '../../utils/urlUtils';

const CHAT_WIDTH = 398;
const CHAT_HEIGHT = 598;
const MESSAGE_TOP_LIMIT = CHAT_HEIGHT / 2;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE_URL =
  `${protocol}//${process.env.REACT_APP_API_BASE_WS_URL}` ||
  `${protocol}//cloud.servtech.com.tw:36100`;

export default function ChatInterface({
  assistantid,
  assistantname,
  assistant,
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // 語音辨識狀態
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // 語音播放設定
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthesisRef = useRef(window.speechSynthesis);
  const voiceRef = useRef(null);

  const socketRef = useRef(null);
  const customerIdRef = useRef(uuidv4()); // 生成随机的 customer_id
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const videoRef = useRef(null);
  const welcomeMessageShownRef = useRef(false); // 追蹤歡迎訊息是否已顯示

  // 語音輸入初始化
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('此瀏覽器不支援語音辨識功能');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW'; // 語音輸入語言
    recognition.interimResults = false; // 只要最終結果
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      console.log('辨識結果:', transcript);
      // setInputMessage(transcript);
      // 自動送出
      sendMessage(transcript);
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = err => {
      console.error('語音辨識錯誤:', err);
      setIsListening(false);

      // 提供更詳細的錯誤訊息
      let errorMessage = '語音辨識發生錯誤';
      switch (err.error) {
        case 'not-allowed':
          errorMessage =
            '麥克風權限被拒絕。請在瀏覽器設定中允許使用麥克風，或確保網站使用 HTTPS。';
          break;
        case 'no-speech':
          errorMessage = '未偵測到語音，請再試一次。';
          break;
        case 'audio-capture':
          errorMessage = '找不到麥克風設備，請檢查麥克風是否已連接。';
          break;
        case 'network':
          errorMessage = '網路錯誤，請檢查網路連線。';
          break;
        case 'aborted':
          // 使用者主動停止，不顯示錯誤
          return;
        default:
          errorMessage = `語音辨識錯誤: ${err.error}`;
      }

      alert(errorMessage);
    };

    recognitionRef.current = recognition;
  }, []);

  // 語音播放初始化
  useEffect(() => {
    const handleVoicesChanged = () => {
      const voices = speechSynthesisRef.current.getVoices();
      // 優先選擇中文語音
      const zhVoice = voices.find(
        v =>
          v.lang.includes('zh-TW') ||
          v.name.includes('Google 國語') ||
          v.name.includes('Microsoft Hanhan')
      );
      if (zhVoice) {
        voiceRef.current = zhVoice;
      }
    };

    speechSynthesisRef.current.addEventListener(
      'voiceschanged',
      handleVoicesChanged
    );
    handleVoicesChanged(); // 初始載入

    return () => {
      speechSynthesisRef.current.removeEventListener(
        'voiceschanged',
        handleVoicesChanged
      );
    };
  }, []);


  // 聊天室 ws 初始化
  useEffect(() => {
    console.log('name  = ' + assistantname);

    if (!welcomeMessageShownRef.current && assistant?.message_welcome) {
      setMessages([
        { id: Date.now(), text: assistant.message_welcome, isBot: true },
      ]);

      welcomeMessageShownRef.current = true;
    }

    socketRef.current = new WebSocket(
      `${WS_BASE_URL}/ws/assistant/${assistantid}/${customerIdRef.current}`
    );

    const socket = socketRef.current; // 暫存引用避免閉包問題

    socket.addEventListener('open', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
    });

    socket.addEventListener('message', event => {
      const message = event.data;
      console.log('recv', message);
      if (message === '@@@') {
        setIsThinking(true);
        setTimeout(scrollToBottom, 100);
      } else if (message === '###') {
        setIsThinking(false);
      } else {
        setMessages(prev => [
          ...prev,
          { id: Date.now(), text: message, isBot: true },
        ]);
        speakText(message);
      }
    });

    socket.addEventListener('error', err => {
      console.error('❌ WebSocket error:', err);
    });

    socket.addEventListener('close', () => {
      console.log('🔌 WebSocket closed');
      setIsConnected(false);
      setIsThinking(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [assistantid, assistantname]);

  // 當消息更新時滾動
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // 控制消息滾動
  function scrollToBottom() {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const scrollHeight = container.scrollHeight;
      const height = container.clientHeight;
      const maxScroll = scrollHeight - height;
      const minScroll = Math.max(0, scrollHeight - MESSAGE_TOP_LIMIT);

      // 使用 requestAnimationFrame 確保在 DOM 更新後執行滾動
      requestAnimationFrame(() => {
        container.scrollTop = Math.max(maxScroll, minScroll);
      });
    }
  }

  async function handleVoiceInput() {
    if (!recognitionRef.current) {
      alert('此瀏覽器不支援語音辨識功能');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    // 在啟動語音識別前，先請求麥克風權限
    try {
      // 允許的主機名稱白名單（開發環境）
      const allowedHosts = ['localhost', '127.0.0.1'];
      const isAllowedHost = allowedHosts.includes(window.location.hostname);

      // 檢查是否為 HTTPS 或在白名單中
      if (window.location.protocol !== 'https:' && !isAllowedHost) {
        alert(
          '語音功能需要在 HTTPS 環境下使用。請使用 HTTPS 或在本地環境（localhost）測試。'
        );
        return;
      }

      // 檢查瀏覽器是否支援 mediaDevices API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert(
          '您的瀏覽器不支援麥克風功能。請使用最新版本的 Chrome、Firefox 或 Edge，並確保使用 HTTPS。'
        );
        return;
      }

      // 請求麥克風權限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 獲得權限後，停止 stream（我們只是用來檢查權限）
      stream.getTracks().forEach(track => track.stop());

      // 啟動語音識別
      recognitionRef.current.start();
    } catch (error) {
      console.error('無法取得麥克風權限:', error);

      let errorMessage = '無法使用麥克風';
      if (error.name === 'NotAllowedError') {
        errorMessage =
          '麥克風權限被拒絕。請點選網址列旁的鎖頭圖示，允許使用麥克風。';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '找不到麥克風設備。請確認麥克風已正確連接。';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '您的瀏覽器不支援麥克風功能，或網站未使用 HTTPS。';
      }

      alert(errorMessage);
    }
  }

  function getBackgroundContent() {
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
    } else if (assistant?.image_assistant) {
      return (
        <img
          src={formatImageUrl(assistant.image_assistant)}
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
  }

  function sendMessage(text) {
    if (!text || !text.trim()) return;
    safeSend(text);
    setMessages(prev => [
      ...prev,
      { id: Date.now(), text: text, isBot: false },
    ]);
    setInputMessage('');
  }

  function handleSendMessage() {
    sendMessage(inputMessage);
  }

  // 追蹤語音播放序列，用於取消舊的播放
  const currentSpeechIdRef = useRef(0);
  const speechTimeoutRef = useRef(null);

  function cleanText(text) {
    return text
      // 移除 emoji
      .replace(/[\p{Extended_Pictographic}]/gu, '')
      // 移除各種特殊符號 (保留文字、數字、空白)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      // 合併多餘空白
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speakText(text) {
    if (!text) return;

    // 停止目前的播放
    if (speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel();
    }

    // 清除任何等待中的計時器
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    // 更新 Speech ID 以無效化舊的播放序列
    currentSpeechIdRef.current += 1;
    const speechId = currentSpeechIdRef.current;

    setIsSpeaking(true);

    // 切割句子：以標點符號為界
    const sentences = text.split(/[。！？!?，,]/);
    let index = 0;

    function speakNext() {
      // 檢查此播放序列是否仍有效
      if (speechId !== currentSpeechIdRef.current) return;

      if (index >= sentences.length) {
        setIsSpeaking(false);
        return;
      }

      const segment = sentences[index];
      const cleaned = cleanText(segment);

      if (!cleaned) {
        // 如果清理後是空字串，則跳過並繼續
        index++;
        Promise.resolve().then(speakNext);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleaned);

      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      }
      utterance.lang = "zh-TW";
      utterance.rate = 1; // 正常語速
      utterance.pitch = 1;

      utterance.onend = () => {
        if (speechId !== currentSpeechIdRef.current) return;

        // 句子之間的停頓 (500ms)
        speechTimeoutRef.current = setTimeout(() => {
          if (speechId !== currentSpeechIdRef.current) return;
          index++;
          speakNext();
        }, 500);
      };

      utterance.onerror = (err) => {
        console.error('語音播放錯誤:', err);
        if (speechId !== currentSpeechIdRef.current) return;
        setIsSpeaking(false);
      };

      speechSynthesisRef.current.speak(utterance);
    }

    speakNext();
  }

  function safeSend(msg) {
    const socket = socketRef.current;
    if (!socket) return console.warn('WebSocket 尚未初始化');

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(msg);
    } else if (socket.readyState === WebSocket.CONNECTING) {
      console.log('等待 WebSocket 連線...');
      socket.addEventListener('open', () => socket.send(msg), { once: true });
    } else {
      console.warn('WebSocket 已關閉，無法送出');
    }
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
        margin: 'auto', // 置中顯示
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
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
              {assistantname || '智能助理'}
              {isConnected ? 'Connected' : 'Disconnected'}
              {/* | ID: {customerIdRef.current.slice(0, 8)} */}
            </Typography>
          </Paper>
        </Box>

        {/* 消息區域 */}
        <Box
          ref={messagesContainerRef} // 確保 ref 連接到正確的元素
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
              minHeight: '50%', // 確保上半部分保持空白
              pointerEvents: 'none', // 防止干擾滾動
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
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                {/* 訊息文字 */}
                <Typography
                  sx={{
                    color: message.isBot ? 'black' : 'white',
                    wordBreak: 'break-word',
                    lineHeight: 1.4,
                    flex: 1,
                  }}
                >
                  {message.text}
                </Typography>

                {/* 🔊 AI 語音播放按鈕（不會蓋到文字） */}
                {message.isBot && (
                  <IconButton
                    size="small"
                    onClick={() => speakText(message.text)}
                    sx={{
                      p: 0.5,
                      color: message.isBot ? 'primary.main' : 'white',
                      alignSelf: 'flex-end',
                      '&:hover': {
                        color: message.isBot ? 'primary.dark' : 'white',
                      },
                    }}
                  >
                    <VolumeUpIcon fontSize="small" />
                  </IconButton>
                )}
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
          <div ref={messagesEndRef} style={{ float: 'left', clear: 'both' }} />
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
              placeholder="請輸入文字或點選語音輸入..."
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

            {/* 🎤 語音輸入按鈕 */}
            <IconButton
              onClick={handleVoiceInput}
              sx={{
                m: 0.5,
                bgcolor: isListening ? 'error.main' : 'secondary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: isListening ? 'error.dark' : 'secondary.dark',
                },
              }}
            >
              <MicIcon />
            </IconButton>

            {/* 📤 送出按鈕 */}
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
}
