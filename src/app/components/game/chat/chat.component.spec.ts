import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { TeamEnum } from 'src/app/shared/enums/team.enum';
import { NotificationService } from 'src/app/shared/services/notification.service';
import { type GameFeedEvent, SignalrService } from 'src/app/shared/services/signalr-service';
import { ChatComponent } from './chat.component';

describe('ChatComponent', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let component: ChatComponent;
  let signalrService: {
    sendMessage: ReturnType<typeof vi.fn>;
    subscribeToGameFeed: ReturnType<typeof vi.fn>;
  };
  let notificationService: { showCommonError: ReturnType<typeof vi.fn> };
  let subscriptions: Map<string, (event: GameFeedEvent) => void>;

  beforeEach(async () => {
    subscriptions = new Map();
    signalrService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      subscribeToGameFeed: vi.fn((callback: (event: GameFeedEvent) => boolean) => {
        subscriptions.set('game-feed', callback);
        return vi.fn();
      })
    };
    notificationService = { showCommonError: vi.fn() };
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalrService, useValue: signalrService },
        { provide: NotificationService, useValue: notificationService }
      ]
    })
      .overrideComponent(ChatComponent, {
        set: { template: '', imports: [] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    fixture.componentRef.setInput('gameId', 'game-1');
    fixture.componentRef.setInput('canSendMessages', true);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('adds only messages for the current game and maps team colors', () => {
    emit('ChatMessage', {
      gameId: 'game-1',
      chatLine: { userName: 'Marta', teamId: TeamEnum.Cats, message: 'hello' }
    });
    emit('ChatMessage', {
      gameId: 'game-2',
      chatLine: { userName: 'Alex', teamId: TeamEnum.Mouse, message: 'ignored' }
    });
    emit('PlayerOnlyConnectionStatusChanged', {
      gameId: 'game-1',
      userName: 'Alex',
      teamId: TeamEnum.Mouse,
      isConnected: false
    });

    expect(component.chatLines()).toEqual([
      { userName: 'Marta', teamId: TeamEnum.Cats, message: 'hello', class: 'black' },
      { userName: 'Alex', teamId: TeamEnum.Mouse, message: 'Alex has disconnected', class: 'red' }
    ]);
  });

  it('keeps only the latest 100 chat lines', () => {
    for (let index = 0; index < 105; index++) {
      emit('PlayerHasLeftGame', {
        gameId: 'game-1',
        userName: `user-${index}`,
        teamId: TeamEnum.Cats
      });
    }

    expect(component.chatLines()).toHaveLength(100);
    expect(component.chatLines()[0].userName).toBe('user-5');
    expect(component.chatLines()[99].userName).toBe('user-104');
  });

  it('trims outgoing messages, sends them, and clears the input', async () => {
    component.formGroup.controls.message.setValue('  move now  ');

    component.onSubmit();
    await Promise.resolve();

    expect(signalrService.sendMessage).toHaveBeenCalledWith('SendChatMessage', {
      gameId: 'game-1',
      message: 'move now'
    });
    expect(component.formGroup.controls.message.value).toBeNull();
  });

  it('does not send blank messages and reports send failures', async () => {
    component.formGroup.controls.message.setValue('   ');
    component.onSubmit();

    expect(signalrService.sendMessage).not.toHaveBeenCalled();

    signalrService.sendMessage.mockRejectedValueOnce(new Error('network'));
    component.formGroup.controls.message.setValue('hello');
    component.onSubmit();

    await vi.waitFor(() => expect(notificationService.showCommonError).toHaveBeenCalledOnce());
  });

  function emit(methodName: GameFeedEvent['methodName'], message: { gameId: string } & Record<string, unknown>): void {
    const callback = subscriptions.get('game-feed');

    callback?.({ methodName, message } as unknown as GameFeedEvent);
  }
});
