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
import { buildApiUrl, formatImageUrl, getWsBaseUrl } from '../utils/urlUtils';
import { applyRules } from '../utils/speechCorrectionEngine';
import { useSpeechCorrectionRules } from '../hook/useSpeechCorrectionRules';

const CHAT_WIDTH = 398;
const CHAT_HEIGHT = 598;
const WS_BASE_URL = getWsBaseUrl();
const EDGE_VOICE = import.meta.env.VITE_EDGE_VOICE || 'zh-TW-HsiaoChenNeural';
const EDGE_RATE = import.meta.env.VITE_EDGE_RATE || '-3%';
const ENGLISH_ACRONYM_MAP = {
  'JarvisAI': 'Jarvis AI',
  "JARVISAI": "Jarvis AI",
  "Jarvisai": "Jarvis AI",
  "MusesAI": "Muses AI",
  "Musesai": "Muses AI",
  "MUSESAI": "Muses AI",
  "MUSES": "Muses",
  "JARVI": "Jarvi",
  "JARVIS": "Jarvis",
  "AutoML": 'Auto ML',
  "AUTOML": 'Auto ML',
};
const MIC_IDLE_TIMEOUT_MS = 3 * 60 * 1000;

const DIGIT_TO_ZH = [
  '零',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
];
function digitsToZhSpaced(digits) {
  return digits
    .split('')
    .map(d => DIGIT_TO_ZH[Number(d)] ?? d)
    .join(' ');
}

function spellAsciiForSpeech(raw) {
  return raw
    .split('')
    .map(ch => {
      if (/[A-Za-z]/.test(ch)) return ch.toLowerCase();
      if (/\d/.test(ch)) return DIGIT_TO_ZH[Number(ch)] ?? ch;
      if (ch === '.') return '點';
      if (ch === '-') return '減號';
      if (ch === '_') return '底線';
      if (ch === '+') return '加號';
      return ch;
    })
    .join(' ');
}

function formatEmailForSpeech(input) {
  if (!input || typeof input !== 'string') return input;
  // Email 容易造成英文拼讀不自然，改為直接略過不朗讀
  return input.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    ' '
  );
}

function formatPhoneForSpeech(input) {
  if (!input || typeof input !== 'string') return input;
  let text = input;
  const placeholderMap = [];
  let placeholderIdx = 0;
  const toPlaceholder = value => {
    const token = `__TEL_PLACEHOLDER_${placeholderIdx}__`;
    placeholderMap.push({ token, value });
    placeholderIdx += 1;
    return token;
  };

  // 台灣市話 + 分機格式，如 02-26558899 轉 10090
  text = text.replace(
    /(0\d{1,2}[\-\s]?\d{6,8})\s*(?:轉|ext\.?|#)\s*(\d{1,10})/gi,
    (_, mainNumber, extNumber) => {
      const mainDigits = mainNumber.replace(/\D/g, '');
      return toPlaceholder(
        `${digitsToZhSpaced(mainDigits)} 轉 ${digitsToZhSpaced(extNumber)}`
      );
    }
  );

  // 台灣常見手機格式，如 0912-345-678 / 0912345678
  text = text.replace(/09\d[\d\- ]{7,10}\d/g, match => {
    const digits = match.replace(/\D/g, '');
    return toPlaceholder(digitsToZhSpaced(digits));
  });

  // 國碼手機格式，如 +886-912-345-678 / 886912345678
  text = text.replace(/(?:\+?886[\-\s]?)9\d(?:[\-\s]?\d){7,8}/g, match => {
    const digits = match.replace(/\D/g, '').replace(/^886/, '0');
    return toPlaceholder(digitsToZhSpaced(digits));
  });

  // 含括號區碼市話，如 (02)26558899 / (02) 2655-8899
  text = text.replace(/\(0\d{1,2}\)\s*\d{3,4}[\-\s]?\d{3,4}/g, match =>
    toPlaceholder(digitsToZhSpaced(match.replace(/\D/g, '')))
  );

  // 純市話（不含分機），如 02-26558899 / 04 1234 5678
  text = text.replace(/0\d{1,2}[\-\s]?\d{3,4}[\-\s]?\d{3,4}/g, match =>
    toPlaceholder(digitsToZhSpaced(match.replace(/\D/g, '')))
  );

  // 電話/分機語境逐位念：如「電話10090」、「分機: 10090」、「轉 10090」、「ext 10090」
  text = text.replace(
    /((?:電話|專線|分機|轉|ext\.?|#)\s*[:：]?\s*)(\d{1,10})/gi,
    (_, prefix, extDigits) =>
      `${prefix}${toPlaceholder(digitsToZhSpaced(extDigits))}`
  );

  // 分機語境跨行：前一行含電話/分機語境，下一行純數字也當分機逐位念
  const lines = text.split('\n');
  const contextPattern = /(分機|專線|電話|轉|ext\.?|#)/i;
  for (let i = 1; i < lines.length; i += 1) {
    const prev = lines[i - 1] || '';
    const current = (lines[i] || '').trim();
    if (contextPattern.test(prev) && /^\d{3,10}$/.test(current)) {
      lines[i] = toPlaceholder(digitsToZhSpaced(current));
    }
  }
  text = lines.join('\n');

  // 還原 placeholders
  for (const item of placeholderMap) {
    text = text.replace(item.token, item.value);
  }
  return text;
}

function formatDecimalAndPercentForSpeech(input) {
  if (!input || typeof input !== 'string') return input;

  let text = input;
  // 百分比：12.5% -> 百分之12點五（小數逐位念）
  text = text.replace(/(\d+)\.(\d+)%/g, (_, intPart, fracPart) => {
    return `百分之${intPart}點${digitsToZhSpaced(fracPart)}`;
  });
  text = text.replace(/(\d+)%/g, (_, num) => `百分之${num}`);
  // 小數：12.345 -> 12點一 二 三 四 五（小數逐位念）
  text = text.replace(/(\d+)\.(\d+)/g, (_, intPart, fracPart) => {
    return `${intPart}點${digitsToZhSpaced(fracPart)}`;
  });
  return text;
}

function normalizeEnglishAcronymsForSpeech(input) {
  if (!input || typeof input !== 'string') return input;
  let text = input;
  for (const [src, dst] of Object.entries(ENGLISH_ACRONYM_MAP)) {
    const pattern = new RegExp(`\\b${src}\\b`, 'g');
    text = text.replace(pattern, dst);
  }
  // 2~6 個全大寫英文字母（例如 AI/API/SOP/HTTP/ABCDE）改為 A B C 形式
  text = text.replace(/\b[A-Z]{2,6}\b/g, token => token.split('').join(' '));
  return text;
}

export default function EmbeddableChatInterface({
  assistantUrl, // 助手ID作為參數傳入
  //assistantName = null, // 可選參數
  //apiBaseUrl = '', // API基礎URL，方便跨域使用
  containerStyle = {}, // 容器樣式自定義
  idleVideoIframeUrl = '/idle-video',
  idleVideoSrc = '/videos/idle.mp4',
  onLoad = () => {}, // 加載完成回調
  onError = () => {}, // 錯誤回調
}) {
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
  const [activeView, setActiveView] = useState('chat');
  const lastMicActivatedAtRef = useRef(Date.now());
  const isListeningRef = useRef(false);
  const isEmbeddedInParent =
    typeof window !== 'undefined' && window.parent !== window;
  const rootWidth = isEmbeddedInParent ? '100%' : CHAT_WIDTH;
  const rootHeight = isEmbeddedInParent ? '100%' : CHAT_HEIGHT;
  const messageFontSize = isEmbeddedInParent ? '2.2rem' : '1.2rem';

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

  const { activeRules, ensureLoaded } = useSpeechCorrectionRules();
  const activeRulesRef = useRef(activeRules);
  activeRulesRef.current = activeRules;

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

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
      const raw = event.results[0][0].transcript;
      const transcript = applyRules(raw, activeRulesRef.current);
      if (transcript !== raw) {
        console.log('語音辨識專有名詞修正:', { raw, transcript });
      }
      console.log('辨識結果:', transcript);

      // 關鍵字偵測：切換影片
      const VIDEO_SWITCH_KEYWORDS = [
        '切換影片',
        '播放影片',
        '看影片',
        '影片切換',
      ];
      const isVideoSwitch = VIDEO_SWITCH_KEYWORDS.some(kw =>
        transcript.includes(kw)
      );
      if (isVideoSwitch) {
        if (typeof window !== 'undefined' && window.parent !== window) {
          try {
            window.parent.postMessage(
              { source: 'chatbot-embed', type: 'VIDEO_SWITCH' },
              '*'
            );
          } catch (e) {
            /* ignore */
          }
        }
        return;
      }

      // 自動送出
      sendMessage(transcript);
    };
    recognition.onstart = () => {
      setIsListening(true);
      setActiveView('chat');
      lastMicActivatedAtRef.current = Date.now();
      if (typeof window !== 'undefined' && window.parent !== window) {
        try {
          window.parent.postMessage(
            { source: 'chatbot-embed', type: 'MIC_STATE', listening: true },
            '*'
          );
        } catch (e) {
          /* ignore */
        }
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      // 沒偵測到語音時在 onend 後重連（此時辨識已完全結束）
      if (typeof window !== 'undefined' && window.parent !== window) {
        try {
          window.parent.postMessage(
            { source: 'chatbot-embed', type: 'MIC_STATE', listening: false },
            '*'
          );
        } catch (e) {
          /* ignore */
        }
      }
    };
    recognition.onerror = err => {
      console.error('語音辨識錯誤:', err);
      setIsListening(false);
      if (
        typeof window !== 'undefined' &&
        window.parent !== window &&
        err.error !== 'aborted'
      ) {
        try {
          window.parent.postMessage(
            { source: 'chatbot-embed', type: 'MIC_STATE', listening: false },
            '*'
          );
        } catch (e) {
          /* ignore */
        }
      }

      if (err.error === 'no-speech') {
        // 無語音時直接結束本次監聽，不自動重啟
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
    function handleVoicesChanged() {
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
    }

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
  const audioRef = useRef(null);
  const audioObjectUrlRef = useRef(null);
  const ttsBlobCacheRef = useRef(new Map());
  const TTS_BLOB_CACHE_MAX_ITEMS = 48;

  function cleanText(text) {
    const normalized = normalizeEnglishAcronymsForSpeech(
      formatDecimalAndPercentForSpeech(
        formatPhoneForSpeech(formatEmailForSpeech(text))
      )
    );

    return (
      normalized
        // 替換 % 為 percent
        // 移除 emoji
        .replace(/[\p{Extended_Pictographic}]/gu, '')
        // 保留中英文常見斷句標點與換行，讓後端能正確做斷句停頓
        .replace(/[^\p{L}\p{N}\s.%。，、！？!?：:；;、•\-]/gu, ' ')
        // 保留換行（供條列偵測），僅壓縮同一行內多餘空白
        .replace(/[^\S\r\n]+/g, ' ')
        // 壓縮連續空行，避免過多靜音
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    );
  }

  function ttsCacheKey(segmentText) {
    return `edge:${EDGE_VOICE}:${EDGE_RATE}:${segmentText}`;
  }

  async function fetchTtsAudio(segmentText) {
    const key = ttsCacheKey(segmentText);
    const hit = ttsBlobCacheRef.current.get(key);
    if (hit) {
      ttsBlobCacheRef.current.delete(key);
      ttsBlobCacheRef.current.set(key, hit);
      return hit;
    }

    const response = await fetch(buildApiUrl('/api/tts/edge'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: segmentText,
        voice: EDGE_VOICE,
        rate: EDGE_RATE,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed (edge): ${response.status}`);
    }
    const blob = await response.blob();
    ttsBlobCacheRef.current.set(key, blob);
    while (ttsBlobCacheRef.current.size > TTS_BLOB_CACHE_MAX_ITEMS) {
      const oldestKey = ttsBlobCacheRef.current.keys().next().value;
      if (!oldestKey) break;
      ttsBlobCacheRef.current.delete(oldestKey);
    }
    return blob;
  }

  function stopCurrentAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
  }

  function waitAudioReady(audio, timeoutMs = 250) {
    return new Promise(resolve => {
      let done = false;
      let timer = null;

      function finish() {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('loadeddata', onReady);
        audio.removeEventListener('error', onReady);
        resolve();
      }

      function onReady() {
        finish();
      }

      // 已可播時直接返回，避免等待事件
      if (audio.readyState >= 2) {
        finish();
        return;
      }

      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('loadeddata', onReady, { once: true });
      audio.addEventListener('error', onReady, { once: true });
      // 保底：避免少數環境事件不回來
      timer = setTimeout(finish, timeoutMs);
    });
  }

  function speakText(text) {
    if (!text) return;

    // 停止目前的播放
    stopCurrentAudio();

    // 清除任何等待中的計時器
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    // 更新 Speech ID 以無效化舊的播放序列
    currentSpeechIdRef.current += 1;
    const speechId = currentSpeechIdRef.current;

    setIsSpeaking(true);

    // 切割句子：以標點符號為界（不含逗號）
    const segments = text
      .split(/[。！？!?]/)
      .map(segment => cleanText(segment))
      .filter(Boolean);
    const segmentFetchPromises = new Map();
    const getOrCreateSegmentFetch = segmentIndex => {
      if (segmentIndex < 0 || segmentIndex >= segments.length) return null;
      if (segmentFetchPromises.has(segmentIndex)) {
        return segmentFetchPromises.get(segmentIndex);
      }
      const promise = fetchTtsAudio(segments[segmentIndex]);
      segmentFetchPromises.set(segmentIndex, promise);
      return promise;
    };
    const prefetchSegment = segmentIndex => {
      getOrCreateSegmentFetch(segmentIndex);
    };
    let index = 0;
    prefetchSegment(0);

    function speakNext() {
      // 檢查此播放序列是否仍有效
      if (speechId !== currentSpeechIdRef.current) return;

      if (index >= segments.length) {
        setIsSpeaking(false);
        // Modify: Auto-restart microphone after bot finishes speaking
        console.log('Bot finished speaking, restarting microphone...');
        return;
      }

      const currentIndex = index;
      const segmentText = segments[currentIndex];
      const segmentPromise = getOrCreateSegmentFetch(currentIndex);
      if (!segmentPromise) {
        index = currentIndex + 1;
        Promise.resolve().then(speakNext);
        return;
      }

      segmentPromise
        .then(blob => {
          if (speechId !== currentSpeechIdRef.current) return;
          console.info('[TTS] provider=edge status=ok');
          prefetchSegment(currentIndex + 1);

          stopCurrentAudio();
          const objectUrl = URL.createObjectURL(blob);
          const audio = new Audio(objectUrl);
          audioRef.current = audio;
          audioObjectUrlRef.current = objectUrl;

          audio.onended = () => {
            stopCurrentAudio();
            if (speechId !== currentSpeechIdRef.current) return;
            speechTimeoutRef.current = setTimeout(() => {
              if (speechId !== currentSpeechIdRef.current) return;
              index = currentIndex + 1;
              speakNext();
            }, 80);
          };

          audio.onerror = err => {
            stopCurrentAudio();
            console.error('TTS 語音播放錯誤:', err);
            if (speechId !== currentSpeechIdRef.current) return;
            setIsSpeaking(false);
          };

          return waitAudioReady(audio).then(() => audio.play());
        })
        .catch(err => {
          console.error('TTS 語音合成錯誤:', err);
          console.warn('[TTS] provider=web-speech-fallback reason=edge-failed');
          // Kokoro 失敗時維持可用性，退回瀏覽器語音
          try {
            const utterance = new SpeechSynthesisUtterance(segmentText);
            if (voiceRef.current) {
              utterance.voice = voiceRef.current;
            }
            utterance.lang = 'zh-TW';
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.onend = () => {
              if (speechId !== currentSpeechIdRef.current) return;
              speechTimeoutRef.current = setTimeout(() => {
                if (speechId !== currentSpeechIdRef.current) return;
                index = currentIndex + 1;
                speakNext();
              }, 80);
            };
            utterance.onerror = fallbackErr => {
              console.error('Fallback 語音播放錯誤:', fallbackErr);
              if (speechId !== currentSpeechIdRef.current) return;
              setIsSpeaking(false);
            };
            speechSynthesisRef.current.speak(utterance);
          } catch (fallbackError) {
            console.error('Fallback 語音失敗:', fallbackError);
            if (speechId !== currentSpeechIdRef.current) return;
            setIsSpeaking(false);
          }
        });
    }

    speakNext();
  }

  useEffect(() => {
    return () => {
      stopCurrentAudio();
      ttsBlobCacheRef.current.clear();
      if (speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

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
  const handleVoiceInputRef = useRef(handleVoiceInput);
  handleVoiceInputRef.current = handleVoiceInput;

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // 父層靜態頁以 postMessage 觸發與 F9 相同：切回聊天並開啟麥克風
  useEffect(() => {
    if (!isEmbeddedInParent) return undefined;
    const onMessage = event => {
      const d = event.data;
      if (d?.source !== 'chatbot-parent' || d.type !== 'START_MIC') return;
      setActiveView('chat');
      lastMicActivatedAtRef.current = Date.now();
      if (!isListeningRef.current) {
        handleVoiceInputRef.current();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isEmbeddedInParent]);

  // 透過 F9 快捷鍵啟用語音輸入（僅啟用，不切換關閉）
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'F9') return;
      event.preventDefault();
      setActiveView('chat');
      lastMicActivatedAtRef.current = Date.now();
      if (!isListening) {
        handleVoiceInput();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isListening]);

  // MIC 超過 3 分鐘未開啟時，切換到影片（嵌入父頁時改由父頁全畫面影片處理）
  useEffect(() => {
    if (!idleVideoIframeUrl || isEmbeddedInParent) return undefined;

    const timer = setInterval(() => {
      if (isListening) {
        setActiveView('chat');
        return;
      }

      if (Date.now() - lastMicActivatedAtRef.current >= MIC_IDLE_TIMEOUT_MS) {
        setActiveView('idleVideo');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [idleVideoIframeUrl, isListening, isEmbeddedInParent]);

  // 取得助手訊息
  useEffect(() => {
    // 新增一個標誌來防止重複請求
    let isMounted = true;

    async function fetchAssistant() {
      try {
        console.log('fetch Assistant');
        const requestUrl = buildApiUrl(`/embed/assistant/${assistantUrl}`);
        // 從API取得助手訊息
        console.log(`fetch api ${requestUrl}`);
        const response = await fetch(requestUrl);

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
    }

    fetchAssistant();
    // 清理函數
    return () => {
      isMounted = false;
    };
  }, [assistantUrl]);

  // 捲動控制
  function scrollToBottom() {
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
  }

  // 訊息更新時捲動
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // WebSocket 連線
  useEffect(() => {
    if (!assistant || !assistantId) return;

    // 只在首次加載時顯示歡迎訊息
    if (!welcomeMessageShownRef.current && assistant?.message_welcome) {
      setMessages([
        { id: Date.now(), text: assistant.message_welcome, isBot: true },
      ]);
      welcomeMessageShownRef.current = true;
    }

    // 建立 WebSocket 連線
    const wsUrl = `${WS_BASE_URL}/ws/assistant/${assistantId}/${customerIdRef.current}`;

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
  }

  // 抽出 sendMessage 邏輯以便語音輸入也能使用
  function sendMessage(text) {
    // 使用 socketRef 來檢查連線狀態，避免閉包問題導致讀取到舊的 isConnected 狀態
    const socket = socketRef.current;
    const isSocketConnected = socket && socket.readyState === WebSocket.OPEN;

    if (!text || !text.trim() || !isSocketConnected) {
      console.warn('無法發送訊息: 文字為空或 WebSocket 未連線', {
        text,
        isSocketConnected,
        readyState: socket?.readyState,
      });
      return;
    }

    // 傳送訊息到 WebSocket
    socket.send(text);

    // 新增使用者訊息到聊天介面
    setMessages(prevMessages => [
      ...prevMessages,
      { id: Date.now(), text: text, isBot: false },
    ]);
  }

  function handleSendMessage() {
    const VIDEO_SWITCH_KEYWORDS = [
      '切換影片',
      '播放影片',
      '看影片',
      '影片切換',
    ];
    const isVideoSwitch = VIDEO_SWITCH_KEYWORDS.some(kw =>
      inputMessage.includes(kw)
    );
    if (isVideoSwitch) {
      if (typeof window !== 'undefined' && window.parent !== window) {
        try {
          window.parent.postMessage(
            { source: 'chatbot-embed', type: 'VIDEO_SWITCH' },
            '*'
          );
        } catch (e) {
          /* ignore */
        }
      }
      setInputMessage('');
      return;
    }
    sendMessage(inputMessage);
    setInputMessage('');
  }

  // 加載中顯示
  if (isLoading) {
    return (
      <Box
        sx={{
          width: rootWidth,
          height: rootHeight,
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
          width: rootWidth,
          height: rootHeight,
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
        width: rootWidth,
        height: rootHeight,
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
      {activeView === 'idleVideo' && idleVideoIframeUrl ? (
        /^https?:\/\//i.test(idleVideoIframeUrl) ||
        idleVideoIframeUrl !== '/idle-video' ? (
          <iframe
            title="idle-video-iframe"
            src={idleVideoIframeUrl}
            allow="autoplay; fullscreen"
            style={{
              width: '100%',
              height: '100%',
              border: 0,
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: '#000',
              overflow: 'hidden',
              zIndex: 5,
            }}
          >
            <video
              src={idleVideoSrc}
              autoPlay
              muted
              loop
              playsInline
              controls={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </Box>
        )
      ) : (
        <>
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
            <Box
              sx={{
                position: 'relative', // 設為相對定位，作為絕對定位的參考點
                flexGrow: 1,
                overflow: 'hidden', // 改為 hidden 防止內容超出
              }}
            >
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
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '50%', // 固定高度為容器的一半
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
                          fontSize: messageFontSize,
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
        </>
      )}
    </Box>
  );
}
