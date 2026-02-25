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
  VolumeUp as VolumeUpIcon,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { formatImageUrl } from '../utils/urlUtils';

const CHAT_WIDTH = 398;
const CHAT_HEIGHT = 598;
const MESSAGE_TOP_LIMIT = CHAT_HEIGHT / 2;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

const DIGIT_TO_ZH = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function formatPhoneForSpeech(str) {
  if (!str || typeof str !== 'string') return str;
  const phoneRegex = /\(?0\d\)?[\s\-]*\d{4}[\s\-]*\d{4}|09[\s\-]*\d{2}[\s\-]*\d{6}/g;
  return str.replace(phoneRegex, match => {
    const digits = match.replace(/\D/g, '');
    return digits.split('').map(d => DIGIT_TO_ZH[Number(d)]).join(' ');
  });
}

const EmbeddableChatInterface = ({
  assistantUrl, // 助手ID作為參數傳入
  //assistantName = null, // 可選參數
  //apiBaseUrl = '', // API基礎URL，方便跨域使用
  containerStyle = {}, // 容器樣式自定義
  onLoad = () => { }, // 加載完成回調
  onError = () => { }, // 錯誤回調
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

  // 語音辨識狀態
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const noSpeechReconnectRef = useRef(false);

  // 語音播放設定
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthesisRef = useRef(window.speechSynthesis);
  const voiceRef = useRef(null);

  const socketRef = useRef(null);
  const customerIdRef = useRef(uuidv4());
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const videoRef = useRef(null);
  const welcomeMessageShownRef = useRef(false);

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
      // 自動送出
      sendMessage(transcript);
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      // 沒偵測到語音時在 onend 後重連（此時辨識已完全結束）
      if (noSpeechReconnectRef.current) {
        noSpeechReconnectRef.current = false;
        const rec = recognitionRef.current;
        setTimeout(() => {
          if (rec) {
            try {
              rec.start();
            } catch (e) {
              console.warn('麥克風重連失敗', e);
            }
          }
        }, 150);
      }
    };
    recognition.onerror = err => {
      console.error('語音辨識錯誤:', err);
      setIsListening(false);

      // 沒偵測到語音時標記重連，實際在 onend 裡執行；若 onend 已先觸發則由此處延遲重連
      if (err.error === 'no-speech') {
        noSpeechReconnectRef.current = true;
        const rec = recognitionRef.current;
        setTimeout(() => {
          if (noSpeechReconnectRef.current && rec) {
            noSpeechReconnectRef.current = false;
            try {
              rec.start();
            } catch (e) {
              console.warn('麥克風重連失敗', e);
            }
          }
        }, 400);
        return;
      }

      // 提供更詳細的錯誤訊息
      let errorMessage = '語音辨識發生錯誤';
      switch (err.error) {
        case 'not-allowed':
          errorMessage =
            '麥克風權限被拒絕。請在瀏覽器設定中允許使用麥克風，或確保網站使用 HTTPS。';
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

  // 追蹤語音播放序列，用於取消舊的播放
  const currentSpeechIdRef = useRef(0);
  const speechTimeoutRef = useRef(null);

  function cleanText(text) {
    return text
      // 替換 % 為 percent
      .replace(/%/g, 'percent')
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
        // Modify: Auto-restart microphone after bot finishes speaking
        console.log('Bot finished speaking, restarting microphone...');
        // Small delay to avoid capturing the end of the bot's speech if using speakers
        setTimeout(() => {
          if (speechId === currentSpeechIdRef.current) { // Ensure we haven't started speaking something else
            handleVoiceInput();
          }
        }, 500);
        return;
      }

      const segment = sentences[index];
      const withPhoneFormatted = formatPhoneForSpeech(segment);
      const cleaned = cleanText(withPhoneFormatted);

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

        // 句子之間的停頓 (80ms)
        speechTimeoutRef.current = setTimeout(() => {
          if (speechId !== currentSpeechIdRef.current) return;
          index++;
          speakNext();
        }, 80);
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

  // 自動啟動語音輸入
  useEffect(() => {
    // 延遲一點時間確保組件完全加載
    const timer = setTimeout(() => {
      // 只有在還沒開始監聽且 recognitionRef 已初始化時才啟動
      if (recognitionRef.current && !isListening) {
        console.log('嘗試自動啟動語音輸入...');
        handleVoiceInput();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // 取得助手訊息
  useEffect(() => {
    // 新增一個標誌來防止重複請求
    let isMounted = true;

    const fetchAssistant = async () => {
      try {
        console.log('fetch Assistant');
        const baseURL = `${window.location.protocol}//${window.location.hostname}:36100`;
        // 從API取得助手訊息
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
      requestAnimationFrame(() => {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      });
    }
    /*
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
    }*/
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
        speakText(message);
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

  // 抽出 sendMessage 邏輯以便語音輸入也能使用
  const sendMessage = (text) => {
    // 使用 socketRef 來檢查連線狀態，避免閉包問題導致讀取到舊的 isConnected 狀態
    const socket = socketRef.current;
    const isSocketConnected = socket && socket.readyState === WebSocket.OPEN;

    if (!text || !text.trim() || !isSocketConnected) {
      console.warn('無法發送訊息: 文字為空或 WebSocket 未連線', {
        text,
        isSocketConnected,
        readyState: socket?.readyState
      });
      return;
    }

    // 发送消息到WebSocket
    socket.send(text);

    // 新增用户消息到聊天界面
    setMessages(prevMessages => [
      ...prevMessages,
      { id: Date.now(), text: text, isBot: false },
    ]);
  };

  const handleSendMessage = () => {
    sendMessage(inputMessage);
    setInputMessage('');
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
              {isConnected ? ' Connected' : ''}
            </Typography>
          </Paper>
        </Box>
        <Box
          sx={{
            position: 'relative', // 設為相對定位，作為絕對定位的參考點
            flexGrow: 1,
            overflow: 'hidden', // 改為 hidden 防止內容超出
          }}
        >
          {/* 上半部分 - 只顯示背景 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              zIndex: 2, // 確保在消息上方
              pointerEvents: 'none', // 防止干擾滾動和點選
            }}
          />
          {/* 消息區域 */}
          <Box
            ref={messagesContainerRef}
            sx={
              /*{
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
          }*/ {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '100%', // 固定高度為容器的一半
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
              }
            }
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

                  {/* 🔊 AI 語音播放按鈕 */}
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
