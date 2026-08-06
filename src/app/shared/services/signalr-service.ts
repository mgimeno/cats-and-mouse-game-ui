import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { type IChatMessage } from '../interfaces/chat-message.interface';
import { type IPlayerHasLeftGameMessage } from '../interfaces/player-has-left-game-message';
import { type IPlayerHasSurrenderedMessage } from '../interfaces/player-has-surrendered-message';
import { type IPlayerOnlyConnectionStatusChangedMessage } from '../interfaces/player-only-connection-status-changed-message';
import { type IPlayerWantsRematchMessage } from '../interfaces/player-wants-rematch-message';
import { type IForegroundContext, PageVisibilityService } from './page-visibility.service';

type HubCallback<T> = (message: T) => void;
type GameFeedCallback = (event: GameFeedEvent) => boolean;
type ResyncCallback = () => void;
type GameFeedResetCallback = () => void;

const GAME_FEED_BUFFER_SIZE = 100;
const GAME_FEED_GAME_BUFFER_LIMIT = 20;

const RECONNECT_BASE_DELAY_MS = 1_500;
const RECONNECT_MAX_DELAY_VISIBLE_MS = 30_000;
// Browsers throttle background timers to roughly one tick per minute after a few
// minutes hidden, so retrying faster than this mostly burns battery and server
// capacity for a user who is not watching. Returning to the foreground cancels the
// wait immediately, so a long ceiling costs nothing in responsiveness.
const RECONNECT_MAX_DELAY_HIDDEN_MS = 300_000;

const AUTOMATIC_RECONNECT_VISIBLE_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000];
const AUTOMATIC_RECONNECT_HIDDEN_DELAYS_MS = [0, 5_000, 30_000, 120_000, 300_000];

const CONNECTION_PROBE_TIMEOUT_MS = 5_000;
const CONNECTION_STOP_TIMEOUT_MS = 5_000;
// A momentary tab switch cannot outlive the transport, so it is not worth a round trip.
const FOREGROUND_RECOVERY_MIN_HIDDEN_MS = 2_000;

export type GameFeedEvent =
  | { methodName: 'ChatMessage'; message: IChatMessage }
  | { methodName: 'PlayerHasLeftGame'; message: IPlayerHasLeftGameMessage }
  | { methodName: 'PlayerWantsRematch'; message: IPlayerWantsRematchMessage }
  | { methodName: 'PlayerHasSurrendered'; message: IPlayerHasSurrenderedMessage }
  | { methodName: 'PlayerOnlyConnectionStatusChanged'; message: IPlayerOnlyConnectionStatusChangedMessage };

@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private readonly pageVisibilityService = inject(PageVisibilityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reconnectPolicy = new ServerReconnectPolicy(this.pageVisibilityService);
  private readonly connectionStateSignal = signal(signalR.HubConnectionState.Disconnected);
  private readonly gameFeedCallbacks = new Set<GameFeedCallback>();
  private readonly resyncCallbacks = new Set<ResyncCallback>();
  private readonly gameFeedResetCallbacks = new Set<GameFeedResetCallback>();
  private readonly pendingGameFeedEvents = new Map<string, GameFeedEvent[]>();
  private readonly pendingRetryWakeUps = new Set<() => void>();

  private hubConnection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private recoveryPromise: Promise<void> | null = null;
  private hasConnectedBefore = false;

  readonly connectionState = this.connectionStateSignal.asReadonly();
  readonly connected = computed(() => this.connectionState() === signalR.HubConnectionState.Connected);

  constructor() {
    const unsubscribeFromForeground = this.pageVisibilityService.onForeground(context => {
      this.onForeground(context);
    });

    this.destroyRef.onDestroy(() => {
      unsubscribeFromForeground();
      this.resyncCallbacks.clear();
      this.gameFeedCallbacks.clear();
      this.gameFeedResetCallbacks.clear();
    });
  }

  get isConnected(): boolean {
    return this.connected();
  }

  startConnection(): void {
    this.ensureConnection();
    void this.start();
  }

  subscribeToMethod<T>(methodName: string, callback: HubCallback<T>): () => void {
    const connection = this.ensureConnection();
    connection.on(methodName, callback);

    return () => connection.off(methodName, callback);
  }

  unsubscribeToMethod(methodName: string): void {
    this.hubConnection?.off(methodName);
  }

  subscribeToGameFeed(callback: GameFeedCallback): () => void {
    this.ensureConnection();

    this.gameFeedCallbacks.add(callback);
    this.replayPendingGameFeedEvents(callback);

    return () => this.gameFeedCallbacks.delete(callback);
  }

  /**
   * Runs `callback` whenever server state may have moved on without this client:
   * after any reconnection, and after the page returns from the background with a
   * transport that did not survive. Subscribers must refetch whatever authoritative
   * state their screen renders; a hub push cannot be relied on to have arrived.
   */
  onResync(callback: ResyncCallback): () => void {
    this.resyncCallbacks.add(callback);

    return () => this.resyncCallbacks.delete(callback);
  }

  /**
   * Runs just before the hub replays the game feed from the beginning, which it does on
   * every reconnection. Subscribers accumulate feed events into a list, so they have to
   * drop what they are holding or the replay renders every line a second time.
   */
  onGameFeedReset(callback: GameFeedResetCallback): () => void {
    this.gameFeedResetCallbacks.add(callback);

    return () => this.gameFeedResetCallbacks.delete(callback);
  }

  async sendMessage<TResponse = unknown, TParameters = unknown>(
    method: string,
    parameters?: TParameters
  ): Promise<TResponse> {
    await this.start();

    const connection = this.ensureConnection();
    if (parameters === undefined || parameters === null) {
      return connection.invoke<TResponse>(method);
    }

    return connection.invoke<TResponse>(method, parameters);
  }

  private ensureConnection(): signalR.HubConnection {
    if (this.hubConnection) {
      return this.hubConnection;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.apiGameHubUrl)
      .configureLogging(environment.production ? signalR.LogLevel.Warning : signalR.LogLevel.Information)
      .withAutomaticReconnect(this.reconnectPolicy)
      // Deliberately no withStatefulReconnect(). It resumes a dropped socket in place and
      // replays buffered messages, but a failed resume calls _stopConnection directly and
      // never hands over to withAutomaticReconnect, so any environment that will not carry
      // the resumed connection id (a proxy in front of the hub, for one) turns a recoverable
      // drop into a dead connection. onResync already refetches authoritative state after
      // every reconnect, which is the correctness guarantee the replay was standing in for.
      .build();

    this.registerGameFeedHandlers();

    this.hubConnection.serverTimeoutInMilliseconds = 2 * 60 * 1000;
    this.hubConnection.keepAliveIntervalInMilliseconds = 15 * 1000;

    this.hubConnection.onreconnecting(() => {
      this.connectionStateSignal.set(signalR.HubConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected(() => {
      void this.onConnectionEstablished();
    });

    this.hubConnection.onclose(error => {
      this.connectionStateSignal.set(signalR.HubConnectionState.Disconnected);
      this.startPromise = null;

      if (error) {
        console.error('SignalR connection closed', error);
      }

      void this.start();
    });

    return this.hubConnection;
  }

  private async start(): Promise<void> {
    const connection = this.ensureConnection();

    if (connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.startPromise !== null) {
      return this.startPromise;
    }

    this.connectionStateSignal.set(signalR.HubConnectionState.Connecting);
    this.startPromise = this.startWithRetry();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startWithRetry(): Promise<void> {
    const connection = this.ensureConnection();
    let attempt = 0;

    while (connection.state === signalR.HubConnectionState.Disconnected) {
      try {
        await connection.start();
      } catch (error) {
        this.connectionStateSignal.set(signalR.HubConnectionState.Disconnected);
        console.error('SignalR connection failed; retrying', error);
        await this.delay(this.getRetryDelay(attempt));
        attempt += 1;
        continue;
      }

      await this.onConnectionEstablished();
      return;
    }
  }

  /**
   * Single place where a live transport is turned into a usable session, so the
   * initial connect, an automatic reconnect and a forced restart all behave the same.
   */
  private async onConnectionEstablished(): Promise<void> {
    this.connectionStateSignal.set(signalR.HubConnectionState.Connected);

    const isReconnection = this.hasConnectedBefore;
    this.hasConnectedBefore = true;

    // Must happen before registering: the hub answers that call by replaying the whole
    // feed, and those pushes arrive ahead of the invocation's own completion.
    if (isReconnection) {
      this.notifyGameFeedReset();
    }

    const isRegistered = await this.registerConnectionSafely();

    // Anything the hub pushed while the transport was down is gone, so subscribers have
    // to refetch. Only once registered, though: without the connection-to-user mapping
    // every refetch throws, and play-game reads a failed fetch as a missing game and
    // sends the player home -- out of a game that is still perfectly alive.
    if (isReconnection && isRegistered) {
      this.notifyResyncCallbacks();
    }
  }

  private onForeground(context: IForegroundContext): void {
    if (!context.wasRestoredFromBackForwardCache && context.hiddenDurationMs < FOREGROUND_RECOVERY_MIN_HIDDEN_MS) {
      return;
    }

    // Cancels any background backoff so a waiting reconnect fires now that someone is
    // actually watching, rather than at the end of a multi-minute ceiling.
    this.wakePendingRetries();

    void this.recoverConnection(context);
  }

  /** Coalesces overlapping foreground events into a single recovery attempt. */
  private async recoverConnection(context: IForegroundContext): Promise<void> {
    if (this.recoveryPromise !== null) {
      return this.recoveryPromise;
    }

    this.recoveryPromise = this.runRecovery(context);

    try {
      await this.recoveryPromise;
    } catch (error) {
      console.error('SignalR foreground recovery failed', error);
    } finally {
      this.recoveryPromise = null;
    }
  }

  private async runRecovery(context: IForegroundContext): Promise<void> {
    // Nothing to recover while a reconnect is already in flight, and closing the
    // connection here would abort the attempt wakePendingRetries() just triggered.
    // That reconnect ends in onConnectionEstablished(), which resyncs subscribers.
    if (!this.isConnected) {
      return;
    }

    // A back/forward cache restore always arrives with a closed socket, so skip the
    // probe and go straight to a reconnect.
    const needsReconnect = context.wasRestoredFromBackForwardCache || !(await this.isConnectionAlive());

    if (needsReconnect) {
      // Ends in onConnectionEstablished(), which notifies subscribers itself.
      await this.restart();
      return;
    }

    this.notifyResyncCallbacks();
  }

  /**
   * `connection.state` still reports Connected over a socket the OS tore down while
   * the page was frozen, and the client-side timeout that would notice is itself a
   * throttled background timer. Only a completed round trip proves the transport works.
   */
  private async isConnectionAlive(): Promise<boolean> {
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) {
      return false;
    }

    try {
      // Ping exists purely for this and pushes nothing back. RegisterConnection would
      // also prove the round trip, but it replays the game state and the whole chat
      // history and tells the opponent this player just reconnected -- on every single
      // return to the foreground.
      const ping = this.ensureConnection().invoke('Ping');
      await this.withTimeout(ping, CONNECTION_PROBE_TIMEOUT_MS, 'SignalR liveness probe timed out');
      return true;
    } catch (error) {
      console.error('SignalR connection is not responding; reconnecting', error);
      return false;
    }
  }

  private async restart(): Promise<void> {
    const connection = this.ensureConnection();

    try {
      // Closing reports Disconnected and triggers onclose, which starts a fresh
      // connection; awaiting start() below simply joins that attempt.
      await this.withTimeout(connection.stop(), CONNECTION_STOP_TIMEOUT_MS, 'SignalR stop timed out');
    } catch (error) {
      console.error('SignalR stop failed; starting a new connection anyway', error);
    }

    await this.start();
  }

  /** Returns whether the hub now maps this connection to the browser's user id. */
  private async registerConnectionSafely(): Promise<boolean> {
    const userId = localStorage.getItem(`${environment.localStoragePrefix}user-id`);
    if (!userId || !this.isConnected) {
      return false;
    }

    try {
      await this.ensureConnection().invoke('RegisterConnection', userId);
      return true;
    } catch (error) {
      // The transport is up and only the user-id association failed, so log it rather
      // than tearing down a working connection. The next reconnect retries it.
      console.error('SignalR connection registration failed', error);
      return false;
    }
  }

  private registerGameFeedHandlers(): void {
    const connection = this.ensureConnection();

    connection.on('ChatMessage', (message: IChatMessage) => {
      this.handleGameFeedEvent({ methodName: 'ChatMessage', message });
    });

    connection.on('PlayerHasLeftGame', (message: IPlayerHasLeftGameMessage) => {
      this.handleGameFeedEvent({ methodName: 'PlayerHasLeftGame', message });
    });

    connection.on('PlayerWantsRematch', (message: IPlayerWantsRematchMessage) => {
      this.handleGameFeedEvent({ methodName: 'PlayerWantsRematch', message });
    });

    connection.on('PlayerHasSurrendered', (message: IPlayerHasSurrenderedMessage) => {
      this.handleGameFeedEvent({ methodName: 'PlayerHasSurrendered', message });
    });

    connection.on('PlayerOnlyConnectionStatusChanged', (message: IPlayerOnlyConnectionStatusChangedMessage) => {
      this.handleGameFeedEvent({ methodName: 'PlayerOnlyConnectionStatusChanged', message });
    });
  }

  private handleGameFeedEvent(event: GameFeedEvent): void {
    const wasHandled = this.notifyGameFeedCallbacks(event);

    if (!wasHandled) {
      this.bufferGameFeedEvent(event);
    }
  }

  private replayPendingGameFeedEvents(callback: GameFeedCallback): void {
    Array.from(this.pendingGameFeedEvents.entries()).forEach(([gameId, pendingEvents]) => {
      const unhandledEvents = pendingEvents.filter(event => !this.notifyGameFeedCallback(callback, event));

      if (unhandledEvents.length === 0) {
        this.pendingGameFeedEvents.delete(gameId);
        return;
      }

      this.pendingGameFeedEvents.set(gameId, unhandledEvents);
    });
  }

  private notifyGameFeedCallbacks(event: GameFeedEvent): boolean {
    let wasHandled = false;

    this.gameFeedCallbacks.forEach(callback => {
      wasHandled = this.notifyGameFeedCallback(callback, event) || wasHandled;
    });

    return wasHandled;
  }

  private notifyGameFeedCallback(callback: GameFeedCallback, event: GameFeedEvent): boolean {
    try {
      return callback(event);
    } catch (error) {
      console.error('SignalR game feed handler failed', error);
      return false;
    }
  }

  private notifyGameFeedReset(): void {
    // The replay repopulates this too, so anything held for a screen that has not
    // subscribed yet would otherwise be duplicated as well.
    this.pendingGameFeedEvents.clear();

    this.gameFeedResetCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('SignalR game feed reset handler failed', error);
      }
    });
  }

  private notifyResyncCallbacks(): void {
    this.resyncCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('SignalR resync handler failed', error);
      }
    });
  }

  private bufferGameFeedEvent(event: GameFeedEvent): void {
    if (
      !this.pendingGameFeedEvents.has(event.message.gameId) &&
      this.pendingGameFeedEvents.size >= GAME_FEED_GAME_BUFFER_LIMIT
    ) {
      const oldestGameId = this.pendingGameFeedEvents.keys().next().value;
      if (oldestGameId) {
        this.pendingGameFeedEvents.delete(oldestGameId);
      }
    }

    const pendingEvents = this.pendingGameFeedEvents.get(event.message.gameId) ?? [];
    pendingEvents.push(event);
    pendingEvents.splice(0, pendingEvents.length - GAME_FEED_BUFFER_SIZE);
    this.pendingGameFeedEvents.set(event.message.gameId, pendingEvents);
  }

  private getRetryDelay(attempt: number): number {
    const ceiling = this.pageVisibilityService.isVisible
      ? RECONNECT_MAX_DELAY_VISIBLE_MS
      : RECONNECT_MAX_DELAY_HIDDEN_MS;
    const exponentialDelay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, ceiling);

    // Equal jitter keeps the backoff curve while stopping every client of a restarted
    // server from retrying on the same tick.
    return exponentialDelay / 2 + Math.random() * (exponentialDelay / 2);
  }

  private wakePendingRetries(): void {
    // Copied first because each wake-up removes itself from the set.
    Array.from(this.pendingRetryWakeUps).forEach(wakeUp => wakeUp());
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => {
      const finish = (): void => {
        window.clearTimeout(timeoutId);
        this.pendingRetryWakeUps.delete(finish);
        resolve();
      };

      const timeoutId = window.setTimeout(finish, milliseconds);
      this.pendingRetryWakeUps.add(finish);
    });
  }

  private withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);

      void promise.then(resolve, reject).finally(() => window.clearTimeout(timeoutId));
    });
  }
}

class ServerReconnectPolicy implements signalR.IRetryPolicy {
  constructor(private readonly pageVisibilityService: PageVisibilityService) {}

  nextRetryDelayInMilliseconds(context: signalR.RetryContext): number {
    const delays = this.pageVisibilityService.isVisible
      ? AUTOMATIC_RECONNECT_VISIBLE_DELAYS_MS
      : AUTOMATIC_RECONNECT_HIDDEN_DELAYS_MS;

    return delays[context.previousRetryCount] ?? delays[delays.length - 1];
  }
}
