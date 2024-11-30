import { Injectable } from '@angular/core';
import * as signalR from "@microsoft/signalr";
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalrService {

  private hubConnection: signalR.HubConnection;

  constructor( ) {
  }

  startConnection = (): void => {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.apiGameHubUrl)
      .configureLogging(signalR.LogLevel.Information)
      .withAutomaticReconnect(this.getRetryDelaysArray())
      .build();

    this.hubConnection.serverTimeoutInMilliseconds = 15 * 60 * 1000;

    this.hubConnection.onclose((error: Error) => {
      console.error("Error when closing connection", error);
    });

    this.hubConnection.onreconnected(() => {
      this.registerConnection();
    })

    this.start();
  }

  subscribeToMethod = (methodName: string, callback: any) => {
    this.hubConnection.on(methodName, data => {
      callback(data);
    });
  };

  unsubscribeToMethod = (methodName: string) => {
    this.hubConnection.off(methodName);
  };

  get isConnected(): boolean {
    return this.hubConnection.state === signalR.HubConnectionState.Connected;
  }

  private registerConnection(): void {

    this.sendMessage("RegisterConnection", localStorage[`${environment.localStoragePrefix}user-id`]);
  }

  private start(): void {

    if (!this.isConnected) {
      this.hubConnection.start()
        .then(() => {
          this.registerConnection();
        })
        .catch(async err => {
          await new Promise(r => setTimeout(r, 100));
          this.start();
        });
    }
  }

  async sendMessage(method: string, parameters: any = null): Promise<any> {

    while (!this.isConnected) {
      await new Promise(r => setTimeout(r, 100));
    }

    if (parameters) {
      return this.hubConnection.invoke(method, parameters);
    }
    else {
      return this.hubConnection.invoke(method);
    }

  }

  private getRetryDelaysArray(): number[] {

    let result = [];
    const oneHourInSeconds = 3600;
    for (let sec = 0; sec <= oneHourInSeconds; sec++) {
      result.push(sec * 1000);
    }

    return result;
  }

}


