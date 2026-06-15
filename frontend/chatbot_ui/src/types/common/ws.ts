export type WSConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface WSMessage {
  channel?: string;
  type?: string;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
}

export type WSListener = (message: WSMessage) => void;

export interface WSClient {
  status: WSConnectionStatus;
  subscribe: (channel: string, fn: WSListener) => () => void;
  connect: (wsUrl: string) => void;
  send: (data: unknown) => void;
  sendRaw: (text: string) => void;
  disconnect: () => void;
  getStatus: () => WSConnectionStatus;
  getCurrentUrl: () => string | null;
  waitUntilConntected: (timeoutMs?: number) => Promise<void>;
}
