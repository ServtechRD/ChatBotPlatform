import { useEffect, useRef, useState } from 'react';

import type {
  WSClient,
  WSConnectionStatus,
  WSListener,
} from '../../types/common/ws';

type ListenerMap = Record<string, WSListener[]>;
type OpenResolver = ((error?: Error) => void) | null;

export function useWSClient(): WSClient {
  const wsRef = useRef<WebSocket | null>(null);
  const urlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<WSConnectionStatus>('disconnected');
  const listenersRef = useRef<ListenerMap>({});
  const openResolverRef = useRef<OpenResolver>(null);

  const reconnectAttempsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_INTERVAL = 3000;

  useEffect(() => {
    return () => {
      urlRef.current = null;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('disconnected');
    };
  }, []);

  function connect(wsUrl: string): void {
    if (
      wsRef.current?.readyState === WebSocket.OPEN &&
      urlRef.current === wsUrl
    ) {
      console.warn('[WS] 已有連線存在');
      return;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setStatus('disconnected');
    }

    urlRef.current = wsUrl;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      reconnectAttempsRef.current = 0;
      setStatus('connected');
      console.log('[WS] 連線成功');
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as Record<string, unknown>;
        if (data) {
          const channel =
            typeof data.channel === 'string' ? data.channel : 'chat';
          listenersRef.current[channel]?.forEach(fn => fn(data));
        } else {
          console.warn('[WS] 未知 channel 或沒有訂閱', data);
        }
      } catch (error) {
        console.error('[WS] 解析錯誤', e.data, error);
      }
    };

    ws.onerror = error => {
      console.error('[WS] 連線錯誤', error);
    };

    ws.onclose = () => {
      setStatus('disconnected');
      console.warn('[WS] 連線關閉');

      if (
        reconnectAttempsRef.current < MAX_RECONNECT_ATTEMPTS &&
        urlRef.current
      ) {
        reconnectAttempsRef.current++;
        console.log(
          `[WS] ${reconnectAttempsRef.current} 次嘗試重新連線， ${RECONNECT_INTERVAL} 秒後重新連線`
        );
        setTimeout(() => connect(urlRef.current as string), RECONNECT_INTERVAL);
      }
    };
  }

  function subscribe(channel: string, fn: WSListener): () => void {
    listenersRef.current[channel] ||= [];
    listenersRef.current[channel].push(fn);
    return () =>
      (listenersRef.current[channel] = listenersRef.current[channel]?.filter(
        f => f !== fn
      ));
  }

  function send(data: unknown): void {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WS] 尚未連線或已斷線');
      return;
    }
    wsRef.current.send(JSON.stringify(data));
  }

  function disconnect(): void {
    urlRef.current = null;
    reconnectAttempsRef.current = 0;
    if (!wsRef.current) return;
    wsRef.current.close();
    wsRef.current = null;
    setStatus('disconnected');
  }

  function getCurrentUrl(): string | null {
    return urlRef.current ?? null;
  }

  function getStatus(): WSConnectionStatus {
    return status;
  }

  function waitUntilConntected(timeoutMs = 5000): Promise<void> {
    if (wsRef.current?.readyState === WebSocket.OPEN && urlRef.current) {
      return Promise.resolve();
    }
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        openResolverRef.current = null;
        rej(new Error('Websocket 連線逾時，請稍後再試'));
      }, timeoutMs);
      const prev = openResolverRef.current;
      openResolverRef.current = (err?: Error) => {
        clearTimeout(t);
        openResolverRef.current = null;
        if (err) {
          rej(err);
        } else {
          res();
        }
      };
      if (prev) {
        prev(new Error('WebSocket 連線逾時(被取代)'));
      }
    });
  }

  return {
    subscribe,
    connect,
    send,
    disconnect,
    getStatus,
    getCurrentUrl,
    waitUntilConntected,
  };
}
