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
import { applyVoiceTranscriptCorrections } from '../utils/voiceTranscriptCorrections';

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
const digitsToZhSpaced = digits =>
  digits
    .split('')
    .map(d => DIGIT_TO_ZH[Number(d)] ?? d)
    .join(' ');
const spellAsciiForSpeech = raw =>
  raw
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

const EmbeddableChatInterface = ({
  assistantUrl, // 助手ID作為參數傳入
  //assistantName = null, // 可選參數
  //apiBaseUrl = '', // API基礎URL，方便跨域使用
  containerStyle = {}, // 容器樣式自定義
  idleVideoIframeUrl = '/idle-video',
  idleVideoSrc = '/videos/idle.mp4',
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

  // 語音辨識狀態
  const [isListening, setIsListening] = useState(false);
  const [isSttLoading, setIsSttLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micStreamRef = useRef(null);
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

      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('loadeddata', onReady);
        audio.removeEventListener('error', onReady);
        resolve();
      };

      const onReady = () => finish();

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

  function postMicState(listening) {
    if (typeof window !== 'undefined' && window.parent !== window) {
      try {
        window.parent.postMessage(
          { source: 'chatbot-embed', type: 'MIC_STATE', listening },
          '*'
        );
      } catch (e) { /* ignore */ }
    }
  }

  async function handleVoiceInput() {
    // 停止錄音 → 送出辨識
    if (isListening) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('您的瀏覽器不支援麥克風功能，請使用 Chrome / Edge 並確保 HTTPS。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // VAD：靜音超過 1.5 秒自動停止，模擬 Web Speech API 的自動結束行為
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const vadData = new Uint8Array(analyser.fftSize);
      const SILENCE_THRESHOLD = 5;
      const SILENCE_MS = 2000;
      let silenceStart = null;
      const vadLoop = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          audioCtx.close();
          return;
        }
        analyser.getByteTimeDomainData(vadData);
        let sum = 0;
        for (let i = 0; i < vadData.length; i++) {
          const v = (vadData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / vadData.length) * 100;
        if (rms < SILENCE_THRESHOLD) {
          if (silenceStart === null) silenceStart = Date.now();
          else if (Date.now() - silenceStart >= SILENCE_MS) {
            console.log('[STT] VAD 偵測到靜音，自動停止錄音');
            mediaRecorderRef.current?.stop();
            audioCtx.close();
            return;
          }
        } else {
          silenceStart = null;
        }
        requestAnimationFrame(vadLoop);
      };
      requestAnimationFrame(vadLoop);

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
        setIsListening(false);
        postMicState(false);

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        console.log('[STT] 錄音結束，blob size:', blob.size, 'bytes');

        if (blob.size < 1000) {
          console.warn('[STT] blob 過小，可能未錄到聲音，略過辨識');
          setIsSttLoading(false);
          return;
        }

        setIsSttLoading(true);
        const t0 = performance.now();
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          formData.append('language', 'zh');

          console.log('[STT] 送出辨識請求...');
          const res = await fetch(buildApiUrl('/api/stt/transcribe'), {
            method: 'POST',
            body: formData,
          });
          console.log('[STT] HTTP 回應:', res.status, `(${(performance.now() - t0).toFixed(0)}ms)`);
          if (!res.ok) throw new Error(`STT HTTP ${res.status}`);

          const { text: raw } = await res.json();
          console.log('[STT] 原始辨識結果:', JSON.stringify(raw));
          const transcript = applyVoiceTranscriptCorrections(raw);
          if (transcript !== raw) {
            console.log('[STT] 專有名詞修正:', { raw, transcript });
          }
          if (!transcript?.trim()) {
            console.warn('[STT] 辨識結果為空，略過送出');
            return;
          }
          console.log('[STT] 最終送出文字:', JSON.stringify(transcript));

          // 關鍵字偵測：切換影片
          const VIDEO_SWITCH_KEYWORDS = ['切換影片', '播放影片', '看影片', '影片切換'];
          if (VIDEO_SWITCH_KEYWORDS.some(kw => transcript.includes(kw))) {
            if (typeof window !== 'undefined' && window.parent !== window) {
              try {
                window.parent.postMessage(
                  { source: 'chatbot-embed', type: 'VIDEO_SWITCH' },
                  '*'
                );
              } catch (e) { /* ignore */ }
            }
            return;
          }

          sendMessage(transcript.trim());
        } catch (err) {
          console.error('STT 辨識失敗:', err);
          alert('語音辨識失敗，請再試一次。');
        } finally {
          setIsSttLoading(false);
        }
      };

      // USB 斷線保護：track 結束時停止 recorder，等設備重新出現後自動重啟
      const track = stream.getAudioTracks()[0];
      if (track) {
        track.onended = () => {
          console.warn('麥克風 track 結束（USB 可能斷線），停止錄音。');
          try { recorder.stop(); } catch (e) { /* ignore */ }
          // 等待設備重新接上後自動重啟錄音
          const waitAndRestart = () => {
            navigator.mediaDevices.enumerateDevices().then(devices => {
              const hasAudio = devices.some(d => d.kind === 'audioinput');
              if (hasAudio && !isListeningRef.current) {
                console.log('麥克風設備已恢復，自動重新啟動錄音。');
                handleVoiceInput();
              } else if (!hasAudio) {
                setTimeout(waitAndRestart, 1000);
              }
            });
          };
          setTimeout(waitAndRestart, 500);
        };
      }

      recorder.start();
      setIsListening(true);
      setActiveView('chat');
      lastMicActivatedAtRef.current = Date.now();
      postMicState(true);
    } catch (error) {
      console.error('無法取得麥克風權限:', error);
      const msg =
        error.name === 'NotAllowedError' ? '麥克風權限被拒絕，請在瀏覽器設定中允許。' :
        error.name === 'NotFoundError'   ? '找不到麥克風設備，請確認已連接。' :
                                           '無法使用麥克風。';
      alert(msg);
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
    const handleKeyDown = event => {
      if (event.key !== 'F9') return;
      event.preventDefault();
      setActiveView('chat');
      lastMicActivatedAtRef.current = Date.now();
      if (!isListening) {
        handleVoiceInput();
      }
    };

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

    const fetchAssistant = async () => {
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
    };

    fetchAssistant();
    // 清理函數
    return () => {
      isMounted = false;
    };
  }, [assistantUrl]);

  // 捲動控制
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

    const wsUrl = `${WS_BASE_URL}/ws/assistant/${assistantId}/${customerIdRef.current}`;
    let destroyed = false;
    let reconnectTimer = null;

    const connect = () => {
      if (destroyed) return;
      console.log('[WS] 建立連線', wsUrl);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] 連線成功');
        setIsConnected(true);
      };

      ws.onmessage = event => {
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

      ws.onclose = (evt) => {
        console.log(`[WS] 連線關閉 code=${evt.code}，${destroyed ? '不重連（已卸載）' : '3s 後重連'}`);
        setIsConnected(false);
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = (err) => {
        console.warn('[WS] 連線錯誤', err);
      };
    };

    connect();

    // 組件卸載時關閉 WebSocket 並釋放麥克風
    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      if (socketRef.current) {
        socketRef.current.close();
      }
      try { mediaRecorderRef.current?.stop(); } catch (e) { /* ignore */ }
      micStreamRef.current?.getTracks().forEach(t => t.stop());
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
  const sendMessage = text => {
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
  };

  const handleSendMessage = () => {
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
  };

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
                  disabled={isSttLoading}
                  sx={{
                    m: 0.5,
                    bgcolor: isListening ? 'error.main' : 'secondary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: isListening ? 'error.dark' : 'secondary.dark',
                    },
                    '&:disabled': {
                      bgcolor: 'action.disabledBackground',
                    },
                  }}
                >
                  {isSttLoading
                    ? <CircularProgress size={20} sx={{ color: 'text.disabled' }} />
                    : <MicIcon />
                  }
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
};

export default EmbeddableChatInterface;
