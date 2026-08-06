import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as signalR from '@microsoft/signalr';

import { environment } from 'src/environments/environment';
import { type IForegroundContext, PageVisibilityService } from './page-visibility.service';
import { SignalrService } from './signalr-service';

interface FakeHub {
  state: signalR.HubConnectionState;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  invoke: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  onreconnecting: ReturnType<typeof vi.fn>;
  onreconnected: ReturnType<typeof vi.fn>;
  onclose: ReturnType<typeof vi.fn>;
  serverTimeoutInMilliseconds: number;
  keepAliveIntervalInMilliseconds: number;
}

describe('SignalrService', () => {
  let hub: FakeHub;
  let closeHandlers: ((error?: Error) => void)[];
  let reconnectedHandlers: (() => void)[];
  let foregroundHandlers: ((context: IForegroundContext) => void)[];
  let visible: ReturnType<typeof signal<boolean>>;
  let onResync: ReturnType<typeof vi.fn<() => void>>;
  let withStatefulReconnect: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.setItem(`${environment.localStoragePrefix}user-id`, 'user-1');
    closeHandlers = [];
    reconnectedHandlers = [];
    foregroundHandlers = [];
    visible = signal(true);
    onResync = vi.fn<() => void>();

    hub = {
      state: signalR.HubConnectionState.Disconnected,
      start: vi.fn().mockImplementation(() => {
        hub.state = signalR.HubConnectionState.Connected;
        return Promise.resolve();
      }),
      stop: vi.fn().mockImplementation(() => {
        hub.state = signalR.HubConnectionState.Disconnected;
        closeHandlers.forEach(handler => handler());
        return Promise.resolve();
      }),
      invoke: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn((handler: () => void) => reconnectedHandlers.push(handler)),
      onclose: vi.fn((handler: (error?: Error) => void) => closeHandlers.push(handler)),
      serverTimeoutInMilliseconds: 0,
      keepAliveIntervalInMilliseconds: 0
    };

    // The real builder is left in place so the production wiring is exercised; only the
    // connection it produces is faked.
    withStatefulReconnect = vi.spyOn(signalR.HubConnectionBuilder.prototype, 'withStatefulReconnect');
    vi.spyOn(signalR.HubConnectionBuilder.prototype, 'build').mockReturnValue(hub as unknown as signalR.HubConnection);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: PageVisibilityService,
          useValue: {
            visible,
            get isVisible(): boolean {
              return visible();
            },
            onForeground: (handler: (context: IForegroundContext) => void): (() => void) => {
              foregroundHandlers.push(handler);
              return (): void => undefined;
            }
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('does not opt into stateful reconnect, whose failed resume bypasses automatic reconnect', async () => {
    await connect();

    // A failed in-place resume calls _stopConnection instead of handing over to
    // withAutomaticReconnect, so a drop a proxy will not carry becomes a dead socket.
    expect(withStatefulReconnect).not.toHaveBeenCalled();
  });

  it('does not ask subscribers to resync on the first connection', async () => {
    await connect();

    expect(onResync).not.toHaveBeenCalled();
  });

  it('asks subscribers to resync after an automatic reconnect', async () => {
    await connect();

    reconnectedHandlers.forEach(handler => handler());
    await settle();

    expect(onResync).toHaveBeenCalledOnce();
  });

  it('resets the game feed before re-registering, since the hub replays it from the start', async () => {
    const onGameFeedReset = vi.fn<() => void>();
    const service = await connect();
    service.onGameFeedReset(onGameFeedReset);
    hub.invoke.mockClear();

    reconnectedHandlers.forEach(handler => handler());
    await settle();

    // The replayed pushes arrive ahead of the invocation's own completion, so a reset
    // that ran afterwards would wipe the very conversation it was meant to rebuild.
    expect(onGameFeedReset).toHaveBeenCalledOnce();
    expect(onGameFeedReset.mock.invocationCallOrder[0]).toBeLessThan(hub.invoke.mock.invocationCallOrder[0]);
  });

  it('does not reset the game feed on the first connection', async () => {
    const onGameFeedReset = vi.fn<() => void>();
    const created = TestBed.inject(SignalrService);
    created.onGameFeedReset(onGameFeedReset);

    created.startConnection();
    await settle();

    expect(onGameFeedReset).not.toHaveBeenCalled();
  });

  it('registers the user before asking subscribers to resync, so the hub knows who is asking', async () => {
    await connect();
    hub.invoke.mockClear();

    reconnectedHandlers.forEach(handler => handler());
    await settle();

    expect(hub.invoke).toHaveBeenCalledWith('RegisterConnection', 'user-1');
    expect(hub.invoke.mock.invocationCallOrder[0]).toBeLessThan(onResync.mock.invocationCallOrder[0]);
  });

  it('does not ask subscribers to resync when registration failed', async () => {
    await connect();
    // Without the connection-to-user mapping every refetch throws, and play-game reads
    // that as a missing game and routes the player out of a game that is still alive.
    hub.invoke.mockRejectedValue(new Error('Connection is not registered'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reconnectedHandlers.forEach(handler => handler());
    await settle();

    expect(onResync).not.toHaveBeenCalled();
  });

  it('ignores a momentary tab switch', async () => {
    await connect();
    hub.invoke.mockClear();

    await enterForeground({ hiddenDurationMs: 500, wasRestoredFromBackForwardCache: false });

    expect(hub.invoke).not.toHaveBeenCalled();
    expect(onResync).not.toHaveBeenCalled();
  });

  it('proves the socket still works and resyncs without dropping it', async () => {
    await connect();
    hub.invoke.mockClear();
    hub.stop.mockClear();

    await enterForeground({ hiddenDurationMs: 60_000, wasRestoredFromBackForwardCache: false });

    expect(hub.invoke).toHaveBeenCalledWith('Ping');
    expect(hub.stop).not.toHaveBeenCalled();
    expect(onResync).toHaveBeenCalledOnce();
  });

  it('probes with Ping, never RegisterConnection', async () => {
    await connect();
    hub.invoke.mockClear();

    await enterForeground({ hiddenDurationMs: 60_000, wasRestoredFromBackForwardCache: false });

    // RegisterConnection replays the game state and the full chat history and tells the
    // opponent this player reconnected. Probing with it would duplicate every chat line
    // and spam "has reconnected" each time the player switched tabs.
    expect(hub.invoke).not.toHaveBeenCalledWith('RegisterConnection', expect.anything());
  });

  it('reconnects a socket that reports Connected but never answers', async () => {
    vi.useFakeTimers();

    try {
      await connect();
      // The zombie case: the OS tore the socket down while the page was frozen, so the
      // invoke never settles even though state still reports Connected.
      hub.invoke.mockReturnValue(new Promise(() => undefined));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      foregroundHandlers.forEach(handler =>
        handler({ hiddenDurationMs: 600_000, wasRestoredFromBackForwardCache: false })
      );
      await vi.advanceTimersByTimeAsync(10_000);

      expect(hub.stop).toHaveBeenCalledOnce();
      expect(hub.start).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconnects straight away after a back/forward cache restore', async () => {
    await connect();
    hub.stop.mockClear();

    await enterForeground({ hiddenDurationMs: 0, wasRestoredFromBackForwardCache: true });

    expect(hub.stop).toHaveBeenCalledOnce();
    expect(onResync).toHaveBeenCalledOnce();
  });

  it('does not abort the reconnect it just woke when returning while the server is down', async () => {
    vi.useFakeTimers();

    try {
      hub.start.mockRejectedValue(new Error('server down'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      TestBed.inject(SignalrService).startConnection();
      await vi.advanceTimersByTimeAsync(5_000);

      foregroundHandlers.forEach(handler =>
        handler({ hiddenDurationMs: 600_000, wasRestoredFromBackForwardCache: false })
      );
      await vi.advanceTimersByTimeAsync(1_000);

      // Stopping here would reject the in-flight start with "stopped during
      // negotiation" and push the backoff out further, for no gain.
      expect(hub.stop).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the connection alive in the background rather than closing it', async () => {
    await connect();
    hub.stop.mockClear();

    visible.set(false);
    await settle();

    expect(hub.stop).not.toHaveBeenCalled();
    expect(hub.state).toBe(signalR.HubConnectionState.Connected);
  });

  it('backs off further between retries while nobody is watching', async () => {
    vi.useFakeTimers();

    try {
      hub.start.mockRejectedValue(new Error('server down'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // Worst case for the jitter, so the assertion is on the ceiling itself.
      vi.spyOn(Math, 'random').mockReturnValue(1);
      visible.set(false);

      TestBed.inject(SignalrService).startConnection();
      await vi.advanceTimersByTimeAsync(0);

      const attemptsBefore = hub.start.mock.calls.length;
      await vi.advanceTimersByTimeAsync(120_000);

      // A visible client doubles from 1.5s up to a 30s ceiling and would have made
      // well over a dozen attempts across two minutes.
      expect(hub.start.mock.calls.length - attemptsBefore).toBeLessThanOrEqual(6);
    } finally {
      vi.useRealTimers();
    }
  });

  async function connect(): Promise<SignalrService> {
    const service = TestBed.inject(SignalrService);
    service.onResync(onResync);
    service.startConnection();
    await settle();

    return service;
  }

  async function enterForeground(context: IForegroundContext): Promise<void> {
    foregroundHandlers.forEach(handler => handler(context));
    await settle();
  }

  async function settle(): Promise<void> {
    for (let index = 0; index < 20; index += 1) {
      await Promise.resolve();
    }
  }
});
