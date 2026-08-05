import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';

import { PageVisibilityService } from './page-visibility.service';
import { TurnAlertService } from './turn-alert.service';

const BASE_TITLE = 'Cats & Mouse. Multiplayer Game';

describe('TurnAlertService', () => {
  let visible: ReturnType<typeof signal<boolean>>;
  let focused: ReturnType<typeof signal<boolean>>;
  let currentTitle: string;
  let setAppBadge: ReturnType<typeof vi.fn>;
  let clearAppBadge: ReturnType<typeof vi.fn>;
  let audioPlay: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    visible = signal(true);
    focused = signal(true);
    currentTitle = BASE_TITLE;
    setAppBadge = vi.fn().mockResolvedValue(undefined);
    clearAppBadge = vi.fn().mockResolvedValue(undefined);
    audioPlay = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal(
      'Audio',
      class {
        currentTime = 0;
        play = audioPlay;
      }
    );

    Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge });
    Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: clearAppBadge });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: PageVisibilityService,
          useValue: { visible, focused, hasUserAttention: computed(() => visible() && focused()) }
        },
        {
          provide: Title,
          useValue: {
            getTitle: vi.fn(() => currentTitle),
            setTitle: vi.fn((title: string) => {
              currentTitle = title;
            })
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'setAppBadge');
    Reflect.deleteProperty(navigator, 'clearAppBadge');
  });

  it('plays the alert sound', () => {
    TestBed.inject(TurnAlertService).alert('Your turn!');

    expect(audioPlay).toHaveBeenCalledOnce();
  });

  it('leaves the title alone while the player is watching', () => {
    const service = TestBed.inject(TurnAlertService);

    service.alert('Your turn!');
    TestBed.tick();

    expect(currentTitle).toBe(BASE_TITLE);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('badges a visible window that lost focus, such as a game on a second monitor', () => {
    const service = TestBed.inject(TurnAlertService);

    service.alert('Your turn!');
    focused.set(false);
    TestBed.tick();

    expect(currentTitle).toBe('Your turn! · Cats & Mouse. Multiplayer Game');
    expect(setAppBadge).toHaveBeenCalledWith(1);
  });

  it('clears the badge when the player focuses the window again', () => {
    const service = TestBed.inject(TurnAlertService);

    service.alert('Your turn!');
    focused.set(false);
    TestBed.tick();
    focused.set(true);
    TestBed.tick();

    expect(currentTitle).toBe(BASE_TITLE);
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('badges the tab and the app icon once the player leaves', () => {
    const service = TestBed.inject(TurnAlertService);

    service.alert('Your turn!');
    visible.set(false);
    TestBed.tick();

    expect(currentTitle).toBe('Your turn! · Cats & Mouse. Multiplayer Game');
    expect(setAppBadge).toHaveBeenCalledWith(1);
  });

  it('restores the original title when the player comes back', () => {
    const service = TestBed.inject(TurnAlertService);

    service.alert('Your turn!');
    visible.set(false);
    TestBed.tick();
    visible.set(true);
    TestBed.tick();

    expect(currentTitle).toBe(BASE_TITLE);
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('stops badging once the alert is cleared', () => {
    const service = TestBed.inject(TurnAlertService);

    service.alert('Your turn!');
    visible.set(false);
    TestBed.tick();
    service.clear();
    TestBed.tick();

    expect(currentTitle).toBe(BASE_TITLE);
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('does not stack the badge when the same alert repeats', () => {
    const service = TestBed.inject(TurnAlertService);

    visible.set(false);
    service.alert('Your turn!');
    TestBed.tick();
    service.alert('Your turn!');
    TestBed.tick();

    expect(currentTitle).toBe('Your turn! · Cats & Mouse. Multiplayer Game');
  });
});
