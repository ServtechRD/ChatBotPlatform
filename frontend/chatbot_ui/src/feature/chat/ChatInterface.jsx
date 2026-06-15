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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildApiUrl, formatImageUrl, getWsBaseUrl } from '../../utils/urlUtils';
import { applyRules } from '../../utils/speechCorrectionEngine';
import { useSpeechCorrectionRules } from '../../hook/useSpeechCorrectionRules';
import { useWSClient } from '../../services/ws/createWsClient';

const CHAT_WIDTH = 398;
const CHAT_HEIGHT = 598;
const MESSAGE_TOP_LIMIT = CHAT_HEIGHT / 2;
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

export default function ChatInterface({
  assistantid,
  assistantname,
  assistant,
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const ws = useWSClient();
  const isConnected = ws.status === 'connected';

  // 語音辨識狀態
  const [isListening, setIsListening] = useState(false);
  const [isSttLoading, setIsSttLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micStreamRef = useRef(null);

  // 語音播放設定
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthesisRef = useRef(window.speechSynthesis);
  const voiceRef = useRef(null);

  const customerIdRef = useRef(uuidv4()); // 產生隨機的 customer_id
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const videoRef = useRef(null);
  const welcomeMessageShownRef = useRef(false); // 追蹤歡迎訊息是否已顯示
  const autoRestartMicRef = useRef(false);
  const pendingSpeakTextRef = useRef('');
  const speakDebounceTimerRef = useRef(null);

  const { activeRules, ensureLoaded } = useSpeechCorrectionRules(assistantid);
  const activeRulesRef = useRef(activeRules);
  activeRulesRef.current = activeRules;

  useEffect(() => {
    if (!assistantid) return;
    ensureLoaded({ enabledOnly: true });
  }, [assistantid, ensureLoaded]);

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

  // 聊天室 ws 初始化
  useEffect(() => {
    console.log('name  = ' + assistantname);

    if (!assistantid) return;

    if (!welcomeMessageShownRef.current && assistant?.message_welcome) {
      setMessages([
        { id: Date.now(), text: assistant.message_welcome, isBot: true },
      ]);

      welcomeMessageShownRef.current = true;
    }

    const wsUrl = `${WS_BASE_URL}/ws/assistant/${assistantid}/${customerIdRef.current}`;
    ws.connect(wsUrl);

    const unsub = ws.subscribe('chat', data => {
      const message =
        typeof data.message === 'string' ? data.message : String(data.message ?? '');
      console.log('recv', message);
      if (message === '@@@') {
        setIsThinking(true);
        setTimeout(scrollToBottom, 100);
      } else if (message === '###') {
        setIsThinking(false);
        flushQueuedSpeakText();
      } else {
        setMessages(prev => [
          ...prev,
          { id: Date.now(), text: message, isBot: true },
        ]);
        queueSpeakText(message);
      }
    });

    return () => {
      unsub();
      ws.disconnect();
      setIsThinking(false);
    };
  }, [assistantid, assistantname, assistant?.message_welcome]);

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

  function queueSpeakText(text) {
    if (!text) return;
    console.info(`[TTS][frontend] queue_append chunk_len=${text.length}`);
    pendingSpeakTextRef.current = pendingSpeakTextRef.current
      ? `${pendingSpeakTextRef.current}\n${text}`
      : text;

    if (speakDebounceTimerRef.current) {
      clearTimeout(speakDebounceTimerRef.current);
    }
    // 合併短時間內的分段回覆，避免多次 TTS 造成句首被截斷
    speakDebounceTimerRef.current = setTimeout(() => {
      flushQueuedSpeakText();
    }, 280);
  }

  function flushQueuedSpeakText() {
    if (speakDebounceTimerRef.current) {
      clearTimeout(speakDebounceTimerRef.current);
      speakDebounceTimerRef.current = null;
    }
    const merged = pendingSpeakTextRef.current;
    pendingSpeakTextRef.current = '';
    if (merged) {
      console.info(`[TTS][frontend] queue_flush merged_len=${merged.length}`);
      speakText(merged);
    }
  }

  async function handleVoiceInput() {
    // 停止錄音 → 送出辨識
    if (isListening) {
      autoRestartMicRef.current = false;
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

      // VAD：靜音超過 2 秒自動停止
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

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        console.log('[STT] 錄音結束，blob size:', blob.size, 'bytes');

        if (blob.size < 1000) {
          console.warn('[STT] blob 過小，可能未錄到聲音，略過辨識');
          return;
        }

        setIsSttLoading(true);
        const t0 = performance.now();
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          formData.append('language', 'zh');
          if (assistantid) formData.append('assistant_id', String(assistantid));

          const activeRulesNow = activeRulesRef.current;
          console.log('[STT] initial_prompt 對照規則 (%d 條):', activeRulesNow.length,
            activeRulesNow.map(r => `${r.wrongText} → ${r.correctText}`));
          console.log('[STT] 送出辨識請求...');
          const res = await fetch(buildApiUrl('/api/stt/transcribe'), {
            method: 'POST',
            body: formData,
          });
          console.log('[STT] HTTP 回應:', res.status, `(${(performance.now() - t0).toFixed(0)}ms)`);
          if (!res.ok) throw new Error(`STT HTTP ${res.status}`);

          const { text: raw } = await res.json();
          console.log('[STT] 原始辨識結果:', JSON.stringify(raw));
          const rules = activeRulesRef.current;
          let transcript = raw;
          for (const rule of rules.filter(r => r.enabled)) {
            const before = transcript;
            transcript = transcript.split(rule.wrongText).join(rule.correctText ?? '');
            if (transcript !== before) {
              console.log(`[STT] 關鍵字修正: "${rule.wrongText}" → "${rule.correctText}" | 結果: ${JSON.stringify(transcript)}`);
            }
          }
          if (transcript === raw) {
            console.log('[STT] 關鍵字檢查：無需修正');
          } else {
            console.log('[STT] 最終修正結果:', JSON.stringify(raw), '→', JSON.stringify(transcript));
          }
          if (!transcript?.trim()) {
            console.warn('[STT] 辨識結果為空，略過送出');
            return;
          }
          console.log('[STT] 最終送出文字:', JSON.stringify(transcript));
          sendMessage(transcript.trim());
        } catch (err) {
          console.error('STT 辨識失敗:', err);
          alert('語音辨識失敗，請再試一次。');
        } finally {
          setIsSttLoading(false);
        }
      };

      recorder.start();
      setIsListening(true);
      autoRestartMicRef.current = true;
    } catch (error) {
      console.error('無法取得麥克風權限:', error);
      const msg =
        error.name === 'NotAllowedError' ? '麥克風權限被拒絕，請在瀏覽器設定中允許。' :
        error.name === 'NotFoundError'   ? '找不到麥克風設備，請確認已連接。' :
                                           '無法使用麥克風。';
      alert(msg);
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
  const audioRef = useRef(null);
  const audioObjectUrlRef = useRef(null);
  const ttsBlobCacheRef = useRef(new Map());
  const TTS_BLOB_CACHE_MAX_ITEMS = 48;
  const DIGIT_TO_ZH = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
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
    return input.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, ' ');
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
    text = text.replace(
      /\(0\d{1,2}\)\s*\d{3,4}[\-\s]?\d{3,4}/g,
      match => toPlaceholder(digitsToZhSpaced(match.replace(/\D/g, '')))
    );

    // 純市話（不含分機），如 02-26558899 / 04 1234 5678
    text = text.replace(/0\d{1,2}[\-\s]?\d{3,4}[\-\s]?\d{3,4}/g, match =>
      toPlaceholder(digitsToZhSpaced(match.replace(/\D/g, '')))
    );

    // 電話/分機語境逐位念：如「電話10090」、「分機: 10090」、「轉 10090」、「ext 10090」
    text = text.replace(
      /((?:電話|專線|分機|轉|ext\.?|#)\s*[:：]?\s*)(\d{1,10})/gi,
      (_, prefix, extDigits) => `${prefix}${toPlaceholder(digitsToZhSpaced(extDigits))}`
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

  function cleanText(text) {
    const normalized = normalizeEnglishAcronymsForSpeech(
      formatDecimalAndPercentForSpeech(formatPhoneForSpeech(formatEmailForSpeech(text)))
    );

    return normalized
      // 移除 emoji
      .replace(/[\p{Extended_Pictographic}]/gu, '')
      // 保留中英文常見斷句標點與換行，讓後端能正確做斷句停頓
      .replace(/[^\p{L}\p{N}\s.%。，、！？!?：:；;、•\-]/gu, ' ')
      // 保留換行（供條列偵測），僅壓縮同一行內多餘空白
      .replace(/[^\S\r\n]+/g, ' ')
      // 壓縮連續空行，避免過多靜音
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function ttsCacheKey(segmentText) {
    return `edge:${EDGE_VOICE}:${EDGE_RATE}:${segmentText}`;
  }

  async function fetchTtsAudio(segmentText) {
    const key = ttsCacheKey(segmentText);
    const cachedBlob = ttsBlobCacheRef.current.get(key);
    if (cachedBlob) {
      ttsBlobCacheRef.current.delete(key);
      ttsBlobCacheRef.current.set(key, cachedBlob);
      console.info(
        `[TTS][frontend] fetch_cache_hit provider=edge text_len=${segmentText.length} blob_bytes=${cachedBlob.size}`
      );
      return cachedBlob;
    }

    const fetchStart = performance.now();
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
    console.info(
      `[TTS][frontend] fetch_done provider=edge text_len=${segmentText.length} blob_bytes=${blob.size} elapsed_ms=${(performance.now() - fetchStart).toFixed(1)}`
    );
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

      // 若已可播，直接通過，避免多等
      if (audio.readyState >= 2) {
        finish();
        return;
      }

      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('loadeddata', onReady, { once: true });
      audio.addEventListener('error', onReady, { once: true });
      // 保底：避免少數情況事件不回來造成卡住
      timer = setTimeout(finish, timeoutMs);
    });
  }

  function speakText(text) {
    if (!text) return;
    const speakStart = performance.now();

    // 停止目前的播放（保留舊邏輯：新訊息來就中斷舊播放）
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
    const cleaned = cleanText(text);
    console.info(
      `[TTS][frontend] speak_start raw_len=${text.length} cleaned_len=${cleaned.length}`
    );
    if (!cleaned) {
      setIsSpeaking(false);
      return;
    }

    const segments = cleaned
      .split(/[。！？!?]/)
      .map(segment => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      setIsSpeaking(false);
      return;
    }

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
    function playNextSegment() {
      if (speechId !== currentSpeechIdRef.current) return;

      if (index >= segments.length) {
        console.info(
          `[TTS][frontend] playback_ended total_ms=${(performance.now() - speakStart).toFixed(1)}`
        );
        setIsSpeaking(false);
        // TTS 播完後自動重啟麥克風
        if (autoRestartMicRef.current) {
          setTimeout(() => {
            if (autoRestartMicRef.current) {
              handleVoiceInput();
            }
          }, 500);
        }
        return;
      }

      const currentIndex = index;
      const segmentText = segments[currentIndex];
      const segmentPromise = getOrCreateSegmentFetch(currentIndex);
      if (!segmentPromise) {
        index = currentIndex + 1;
        Promise.resolve().then(playNextSegment);
        return;
      }

      segmentPromise
        .then(blob => {
          if (speechId !== currentSpeechIdRef.current) return;
          console.info('[TTS] provider=edge status=ok');
          console.info(
            `[TTS][frontend] segment_blob_ready index=${currentIndex + 1}/${segments.length} elapsed_ms=${(performance.now() - speakStart).toFixed(1)}`
          );
          prefetchSegment(currentIndex + 1);

          stopCurrentAudio();
          const objectUrl = URL.createObjectURL(blob);
          const audio = new Audio(objectUrl);
          audioRef.current = audio;
          audioObjectUrlRef.current = objectUrl;

          audio.onended = () => {
            stopCurrentAudio();
            if (speechId !== currentSpeechIdRef.current) return;
            index = currentIndex + 1;
            speechTimeoutRef.current = setTimeout(() => {
              if (speechId !== currentSpeechIdRef.current) return;
              playNextSegment();
            }, 30);
          };

          audio.onerror = err => {
            stopCurrentAudio();
            console.error('TTS 語音播放錯誤:', err);
            if (speechId !== currentSpeechIdRef.current) return;
            setIsSpeaking(false);
          };

          return waitAudioReady(audio).then(() => {
            console.info(
              `[TTS][frontend] play_begin index=${currentIndex + 1}/${segments.length} elapsed_ms=${(performance.now() - speakStart).toFixed(1)}`
            );
            return audio.play();
          });
        })
        .catch(err => {
          console.error('TTS 語音合成錯誤:', err);
          console.warn('[TTS] provider=web-speech-fallback reason=edge-failed');
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
              index = currentIndex + 1;
              speechTimeoutRef.current = setTimeout(() => {
                if (speechId !== currentSpeechIdRef.current) return;
                playNextSegment();
              }, 30);
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

    playNextSegment();
  }

  useEffect(() => {
    return () => {
      if (speakDebounceTimerRef.current) {
        clearTimeout(speakDebounceTimerRef.current);
        speakDebounceTimerRef.current = null;
      }
      pendingSpeakTextRef.current = '';
      ttsBlobCacheRef.current.clear();
      stopCurrentAudio();
      if (speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  async function safeSend(msg) {
    try {
      await ws.waitUntilConntected();
      ws.sendRaw(msg);
    } catch (error) {
      console.warn('WebSocket 無法送出', error);
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
              // display: 'inline-block',
              display: 'none',
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
                <Box
                  component="div"
                  sx={{
                    color: message.isBot ? 'black' : 'white',
                    wordBreak: 'break-word',
                    lineHeight: 1.4,
                    flex: 1,
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.text ?? ''}
                  </ReactMarkdown>
                </Box>

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
              disabled={isSttLoading}
              sx={{
                m: 0.5,
                bgcolor: isListening ? 'error.main' : 'secondary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: isListening ? 'error.dark' : 'secondary.dark',
                },
              }}
            >
              {isSttLoading ? <CircularProgress size={24} color="inherit" /> : <MicIcon />}
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
