import { act, renderHook } from '@testing-library/react';

import { useWSClient } from './createWsClient';

const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

type MessageHandler = ((event: MessageEvent<string>) => void) | null;

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  static CONNECTING = WS_CONNECTING;
  static OPEN = WS_OPEN;
  static CLOSED = WS_CLOSED;

  url: string;
  readyState = WS_CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: MessageHandler = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = WS_CLOSED;
    this.onclose?.();
  }

  simulateOpen(): void {
    this.readyState = WS_OPEN;
    this.onopen?.();
  }

  simulateMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  simulateClose(): void {
    this.close();
  }
}

function latestSocket(): MockWebSocket {
  const socket = MockWebSocket.instances.at(-1);
  if (!socket) {
    throw new Error('MockWebSocket 尚未建立');
  }
  return socket;
}

describe('useWSClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('connect 後狀態變為 connected', () => {
    const { result } = renderHook(() => useWSClient());

    act(() => {
      result.current.connect('ws://localhost/ws/assistant/1/customer-a');
    });

    expect(result.current.status).toBe('connecting');

    act(() => {
      latestSocket().simulateOpen();
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.getCurrentUrl()).toBe(
      'ws://localhost/ws/assistant/1/customer-a'
    );
  });

  it('純文字訊息派發至 chat channel', () => {
    const { result } = renderHook(() => useWSClient());
    const received: string[] = [];

    act(() => {
      result.current.connect('ws://localhost/ws/assistant/1/customer-a');
      result.current.subscribe('chat', data => {
        received.push(String(data.message));
      });
      latestSocket().simulateOpen();
    });

    act(() => {
      latestSocket().simulateMessage('@@@');
      latestSocket().simulateMessage('你好');
      latestSocket().simulateMessage('###');
    });

    expect(received).toEqual(['@@@', '你好', '###']);
  });

  it('JSON 訊息依 channel 派發', () => {
    const { result } = renderHook(() => useWSClient());
    const alerts: unknown[] = [];

    act(() => {
      result.current.connect('ws://localhost/ws/assistant/1/customer-a');
      result.current.subscribe('alert', data => alerts.push(data));
      latestSocket().simulateOpen();
    });

    act(() => {
      latestSocket().simulateMessage(
        JSON.stringify({ channel: 'alert', type: 'alert', message: '同步異常' })
      );
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: 'alert', message: '同步異常' });
  });

  it('send 送出 JSON，sendRaw 送出純文字', () => {
    const { result } = renderHook(() => useWSClient());

    act(() => {
      result.current.connect('ws://localhost/ws/assistant/1/customer-a');
      latestSocket().simulateOpen();
      result.current.send({ type: 'ping' });
      result.current.sendRaw('你好');
    });

    const socket = latestSocket();
    expect(socket.sent).toEqual([JSON.stringify({ type: 'ping' }), '你好']);
  });

  it('waitUntilConntected 在 onopen 後 resolve', async () => {
    const { result } = renderHook(() => useWSClient());

    act(() => {
      result.current.connect('ws://localhost/ws/assistant/1/customer-a');
    });

    const pending = result.current.waitUntilConntected(5000);

    await act(async () => {
      latestSocket().simulateOpen();
      await pending;
    });

    await expect(pending).resolves.toBeUndefined();
  });

  it('disconnect 後停止重連', () => {
    const { result } = renderHook(() => useWSClient());

    act(() => {
      result.current.connect('ws://localhost/ws/assistant/1/customer-a');
      latestSocket().simulateOpen();
      result.current.disconnect();
    });

    expect(result.current.status).toBe('disconnected');
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('斷線後自動重連（最多 5 次）', () => {
    const { result } = renderHook(() => useWSClient());

    act(() => {
      result.current.connect('ws://localhost/ws/assistant/1/customer-a');
      latestSocket().simulateOpen();
      latestSocket().simulateClose();
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].url).toBe(
      'ws://localhost/ws/assistant/1/customer-a'
    );
  });

  it('多個 hook 實例彼此獨立', () => {
    const hookA = renderHook(() => useWSClient());
    const hookB = renderHook(() => useWSClient());
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    act(() => {
      hookA.result.current.connect('ws://localhost/ws/assistant/1/customer-a');
      hookB.result.current.connect('ws://localhost/ws/assistant/1/customer-b');
      hookA.result.current.subscribe('chat', data =>
        receivedA.push(String(data.message))
      );
      hookB.result.current.subscribe('chat', data =>
        receivedB.push(String(data.message))
      );
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[1].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage('A');
      MockWebSocket.instances[1].simulateMessage('B');
    });

    expect(receivedA).toEqual(['A']);
    expect(receivedB).toEqual(['B']);
    expect(MockWebSocket.instances[0].url).toContain('customer-a');
    expect(MockWebSocket.instances[1].url).toContain('customer-b');
  });

  it('100 個實例可同時 connect 且互不影響', () => {
    const hooks = Array.from({ length: 100 }, () => renderHook(() => useWSClient()));

    act(() => {
      hooks.forEach((hook, index) => {
        hook.result.current.connect(
          `ws://localhost/ws/assistant/1/customer-${index}`
        );
      });
      MockWebSocket.instances.forEach(socket => socket.simulateOpen());
    });

    expect(MockWebSocket.instances).toHaveLength(100);
    expect(
      hooks.every(hook => hook.result.current.status === 'connected')
    ).toBe(true);
    expect(new Set(MockWebSocket.instances.map(socket => socket.url)).size).toBe(
      100
    );
  });
});
