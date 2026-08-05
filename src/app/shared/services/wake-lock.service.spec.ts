import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageVisibilityService } from './page-visibility.service';
import { WakeLockService } from './wake-lock.service';

describe('WakeLockService', () => {
  let visible: ReturnType<typeof signal<boolean>>;
  let request: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let releaseListeners: (() => void)[];

  beforeEach(() => {
    visible = signal(true);
    releaseListeners = [];
    release = vi.fn().mockResolvedValue(undefined);
    request = vi.fn().mockImplementation(() =>
      Promise.resolve({
        release,
        addEventListener: (_type: string, listener: () => void) => releaseListeners.push(listener)
      })
    );

    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: PageVisibilityService, useValue: { visible } }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('holds the screen awake while enabled and visible', async () => {
    const service = TestBed.inject(WakeLockService);

    service.setEnabled(true);
    await settle();

    expect(request).toHaveBeenCalledWith('screen');
  });

  it('does not ask for a lock while the page is hidden, which the browser would refuse', async () => {
    const service = TestBed.inject(WakeLockService);

    visible.set(false);
    service.setEnabled(true);
    await settle();

    expect(request).not.toHaveBeenCalled();
  });

  it('releases the lock when the game no longer needs it', async () => {
    const service = TestBed.inject(WakeLockService);

    service.setEnabled(true);
    await settle();
    service.setEnabled(false);
    await settle();

    expect(release).toHaveBeenCalledOnce();
  });

  it('re-acquires after the platform drops the lock on hide', async () => {
    const service = TestBed.inject(WakeLockService);

    service.setEnabled(true);
    await settle();

    // The platform releases the lock itself whenever the page hides, and never
    // restores it, so returning to the foreground has to ask for a fresh one.
    releaseListeners.forEach(listener => listener());
    visible.set(false);
    await settle();
    visible.set(true);
    await settle();

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the browser has no Wake Lock API', async () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    const service = TestBed.inject(WakeLockService);

    service.setEnabled(true);
    await settle();

    expect(request).not.toHaveBeenCalled();
  });

  it('survives a refused request', async () => {
    request.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = TestBed.inject(WakeLockService);

    service.setEnabled(true);
    await settle();
    service.setEnabled(false);
    await settle();

    expect(release).not.toHaveBeenCalled();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
});
