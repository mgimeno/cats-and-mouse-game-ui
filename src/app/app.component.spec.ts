import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { NEVER } from 'rxjs';
import { type IPlayerHasInProgressGameMessage } from './shared/interfaces/player-has-in-progress-game-message';
import { SignalrService } from './shared/services/signalr-service';
import { ChunkLoadReloadService } from './shared/services/chunk-load-reload.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let router: { url: string; navigate: ReturnType<typeof vi.fn>; events: typeof NEVER };
  let subscriptions: Map<string, (message: unknown) => void>;
  let signalrService: {
    connected: ReturnType<typeof signal<boolean>>;
    subscribeToMethod: ReturnType<typeof vi.fn>;
  };

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
      subscribeToMethod: vi.fn((methodName: string, callback: (message: unknown) => void) => {
        subscriptions.set(methodName, callback);
        return vi.fn();
      })
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SignalrService, useValue: signalrService },
        { provide: Router, useValue: router },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ close: vi.fn() })) } },
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
