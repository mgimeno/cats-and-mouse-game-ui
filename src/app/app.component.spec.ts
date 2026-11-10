import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { NEVER } from 'rxjs';
import { type IPlayerHasInProgressGameMessage } from './shared/interfaces/player-has-in-progress-game-message';
import { PageVisibilityService } from './shared/services/page-visibility.service';
import { SignalrService } from './shared/services/signalr-service';
import { ChunkLoadReloadService } from './shared/services/chunk-load-reload.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let router: { url: string; navigate: ReturnType<typeof vi.fn>; events: typeof NEVER };
  let subscriptions: Map<string, (message: unknown) => void>;
  let signalrService: {
    connected: ReturnType<typeof signal<boolean>>;
    hasConnectedBefore: ReturnType<typeof signal<boolean>>;
    subscribeToMethod: ReturnType<typeof vi.fn>;
  };
  let pageVisibilityService: { visible: ReturnType<typeof signal<boolean>> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let dialogClose: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.clear();
    subscriptions = new Map();
    router = {
      url: '/?game=game-1',
      navigate: vi.fn().mockResolvedValue(true),
      events: NEVER
    };
    signalrService = {
      connected: signal(true),
      hasConnectedBefore: signal(true),
      subscribeToMethod: vi.fn((methodName: string, callback: (message: unknown) => void) => {
        subscriptions.set(methodName, callback);
        return vi.fn();
      })
    };
    pageVisibilityService = { visible: signal(true) };
    dialogClose = vi.fn();
    dialog = { open: vi.fn(() => ({ close: dialogClose })) };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalrService, useValue: signalrService },
        { provide: Router, useValue: router },
        { provide: PageVisibilityService, useValue: pageVisibilityService },
        { provide: MatDialog, useValue: dialog },
        {
          provide: Meta,
          useValue: {
            updateTag: vi.fn(),
            getTag: vi.fn(() => null),
            removeTag: vi.fn(),
            addTags: vi.fn()
          }
        },
        { provide: Title, useValue: { setTitle: vi.fn() } },
        {
          provide: ChunkLoadReloadService,
          useValue: {
            isChunkLoadError: vi.fn(() => false),
            reloadIfChunkLoadError: vi.fn()
          }
        }
      ]
    })
      .overrideComponent(AppComponent, {
        set: { template: '', imports: [] }
      })
      .compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('keeps a shared game URL when the browser has no in-progress game', () => {
    createComponent();

    emitHasInProgressGame(false);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('routes to play when the browser has an in-progress game', () => {
    createComponent();

    emitHasInProgressGame(true);

    expect(router.navigate).toHaveBeenCalledWith(['/play']);
  });

  it('routes from play to home when the browser has no in-progress game', () => {
    router.url = '/play';
    createComponent();

    emitHasInProgressGame(false);

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('subscribes to in-progress game messages', () => {
    createComponent();

    expect(signalrService.subscribeToMethod).toHaveBeenCalledWith('HasInProgressGame', expect.any(Function));
  });

  describe('connection dialog', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      signalrService.connected.set(false);
    });

    it('does not show the dialog when the first connection completes within the grace period', () => {
      signalrService.hasConnectedBefore.set(false);
      createComponent();

      vi.advanceTimersByTime(499);
      connect();
      vi.advanceTimersByTime(1_000);

      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('shows the dialog once the first connection outlasts the grace period', () => {
      signalrService.hasConnectedBefore.set(false);
      createComponent();

      vi.advanceTimersByTime(499);
      expect(dialog.open).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(dialog.open).toHaveBeenCalledTimes(1);
    });

    it('keeps a just-shown dialog up for its minimum duration so it does not blink', () => {
      signalrService.hasConnectedBefore.set(false);
      createComponent();
      vi.advanceTimersByTime(500);

      vi.advanceTimersByTime(10);
      connect();
      vi.advanceTimersByTime(389);
      expect(dialogClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(dialogClose).toHaveBeenCalledTimes(1);
    });

    it('closes the dialog at once when connecting after its minimum duration', () => {
      signalrService.hasConnectedBefore.set(false);
      createComponent();
      vi.advanceTimersByTime(1_000);

      connect();

      expect(dialogClose).toHaveBeenCalledTimes(1);
    });

    it('shows the dialog at once when an established connection is lost', () => {
      signalrService.hasConnectedBefore.set(true);
      createComponent();

      expect(dialog.open).toHaveBeenCalledTimes(1);
    });

    it('closes a reconnection dialog the moment the connection returns', () => {
      signalrService.hasConnectedBefore.set(true);
      createComponent();

      vi.advanceTimersByTime(10);
      connect();

      expect(dialogClose).toHaveBeenCalledTimes(1);
    });

    it('does not let the player dismiss the dialog', () => {
      signalrService.hasConnectedBefore.set(true);
      createComponent();

      expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ disableClose: true }));
    });

    it('restarts the grace period when the page is hidden before it ends', () => {
      signalrService.hasConnectedBefore.set(false);
      createComponent();

      vi.advanceTimersByTime(400);
      setVisible(false);
      vi.advanceTimersByTime(1_000);
      expect(dialog.open).not.toHaveBeenCalled();

      setVisible(true);
      vi.advanceTimersByTime(499);
      expect(dialog.open).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(dialog.open).toHaveBeenCalledTimes(1);
    });

    it('closes the dialog at once when the page is hidden, ignoring its minimum duration', () => {
      signalrService.hasConnectedBefore.set(true);
      createComponent();

      setVisible(false);

      expect(dialogClose).toHaveBeenCalledTimes(1);
    });

    function connect(): void {
      signalrService.connected.set(true);
      signalrService.hasConnectedBefore.set(true);
      TestBed.tick();
    }

    function setVisible(visible: boolean): void {
      pageVisibilityService.visible.set(visible);
      TestBed.tick();
    }
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  }

  function emitHasInProgressGame(hasInProgressGame: boolean): void {
    const callback = subscriptions.get('HasInProgressGame');

    expect(callback).toBeDefined();
    callback?.({ hasInProgressGame } satisfies Partial<IPlayerHasInProgressGameMessage>);
  }
});
