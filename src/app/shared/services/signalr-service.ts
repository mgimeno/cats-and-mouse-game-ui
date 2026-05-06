import { Injectable, computed, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';

import { environment } from '../../../environments/environment';

type HubCallback<T> = (message: T) => void;

@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private hubConnection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private readonly reconnectPolicy = new ServerReconnectPolicy();
  private readonly connectionStateSignal = signal(signalR.HubConnectionState.Disconnected);

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
