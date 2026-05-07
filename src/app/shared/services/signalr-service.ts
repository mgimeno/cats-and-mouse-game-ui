import { Injectable, computed, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { type IChatMessage } from '../interfaces/chat-message.interface';
import { type IPlayerHasLeftGameMessage } from '../interfaces/player-has-left-game-message';
import { type IPlayerHasSurrenderedMessage } from '../interfaces/player-has-surrendered-message';
import { type IPlayerOnlyConnectionStatusChangedMessage } from '../interfaces/player-only-connection-status-changed-message';
import { type IPlayerWantsRematchMessage } from '../interfaces/player-wants-rematch-message';

type HubCallback<T> = (message: T) => void;
type GameFeedCallback = (event: GameFeedEvent) => boolean;
const GAME_FEED_BUFFER_SIZE = 100;
const GAME_FEED_GAME_BUFFER_LIMIT = 20;

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
  private hubConnection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private readonly reconnectPolicy = new ServerReconnectPolicy();
  private readonly connectionStateSignal = signal(signalR.HubConnectionState.Disconnected);
  private readonly gameFeedCallbacks = new Set<GameFeedCallback>();
  private readonly pendingGameFeedEvents = new Map<string, GameFeedEvent[]>();

  readonly connectionState = this.connectionStateSignal.asReadonly();
  readonly connected = computed(() => this.connectionState() === signalR.HubConnectionState.Connected);

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
      .build();

    this.registerGameFeedHandler('ChatMessage');
    this.registerGameFeedHandler('PlayerHasLeftGame');
    this.registerGameFeedHandler('PlayerWantsRematch');
    this.registerGameFeedHandler('PlayerHasSurrendered');
    this.registerGameFeedHandler('PlayerOnlyConnectionStatusChanged');

    this.hubConnection.serverTimeoutInMilliseconds = 2 * 60 * 1000;
    this.hubConnection.keepAliveIntervalInMilliseconds = 15 * 1000;

    this.hubConnection.onreconnecting(() => {
      this.connectionStateSignal.set(signalR.HubConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected(() => {
      this.connectionStateSignal.set(signalR.HubConnectionState.Connected);
      void this.registerConnection();
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

    while (connection.state === signalR.HubConnectionState.Disconnected) {
      try {
        await connection.start();
        this.connectionStateSignal.set(signalR.HubConnectionState.Connected);
        await this.registerConnection();
      } catch (error) {
        this.connectionStateSignal.set(signalR.HubConnectionState.Disconnected);
        console.error('SignalR connection failed; retrying', error);
        await this.delay(1500);
      }
    }
  }

  private async registerConnection(): Promise<void> {
    const userId = localStorage.getItem(`${environment.localStoragePrefix}user-id`);
    if (!userId || !this.isConnected) {
      return;
    }

    await this.ensureConnection().invoke('RegisterConnection', userId);
  }

  private registerGameFeedHandler(methodName: GameFeedEvent['methodName']): void {
    this.ensureConnection().on(methodName, message => {
      this.handleGameFeedEvent({ methodName, message } as GameFeedEvent);
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

  private bufferGameFeedEvent(event: GameFeedEvent): void {
    if (
      !this.pendingGameFeedEvents.has(event.message.gameId) &&
      this.pendingGameFeedEvents.size >= GAME_FEED_GAME_BUFFER_LIMIT
    ) {
      const oldestGameId = this.pendingGameFeedEvents.keys().next().value as string | undefined;
      if (oldestGameId) {
        this.pendingGameFeedEvents.delete(oldestGameId);
      }
    }

    const pendingEvents = this.pendingGameFeedEvents.get(event.message.gameId) ?? [];
    pendingEvents.push(event);
    pendingEvents.splice(0, pendingEvents.length - GAME_FEED_BUFFER_SIZE);
    this.pendingGameFeedEvents.set(event.message.gameId, pendingEvents);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }
}

class ServerReconnectPolicy implements signalR.IRetryPolicy {
  nextRetryDelayInMilliseconds(context: signalR.RetryContext): number {
    const fastReconnectDelays = [0, 2000, 5000, 10000, 30000];
    return fastReconnectDelays[context.previousRetryCount] ?? 30000;
  }
}
