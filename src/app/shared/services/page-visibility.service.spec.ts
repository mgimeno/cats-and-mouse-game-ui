import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { type IForegroundContext, PageVisibilityService } from './page-visibility.service';

describe('PageVisibilityService', () => {
  let contexts: IForegroundContext[];

  beforeEach(() => {
    contexts = [];
    setVisibilityState('visible');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    setVisibilityState('visible');
  });

  it('starts from the current document state', () => {
    setVisibilityState('hidden');

    expect(createService().visible()).toBe(false);
  });

  it('reports the page going away and coming back', () => {
    const service = createService();
    service.onForeground(context => contexts.push(context));

    goHidden();

    expect(service.visible()).toBe(false);
    expect(contexts).toHaveLength(0);

    goVisible();

    expect(service.visible()).toBe(true);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].hiddenDurationMs).toBeGreaterThanOrEqual(0);
    expect(contexts[0].wasRestoredFromBackForwardCache).toBe(false);
  });

  it('does not report a foreground event when the page was never hidden', () => {
    const service = createService();
    service.onForeground(context => contexts.push(context));

    goVisible();

    expect(contexts).toHaveLength(0);
  });

  it('flags a back/forward cache restore, which always arrives with a closed socket', () => {
    const service = createService();
    service.onForeground(context => contexts.push(context));

    dispatchPageShow(true);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].wasRestoredFromBackForwardCache).toBe(true);
  });

  it('ignores an ordinary pageshow on first load', () => {
    const service = createService();
    service.onForeground(context => contexts.push(context));

    dispatchPageShow(false);

    expect(contexts).toHaveLength(0);
  });

  it('does not report the restore twice when visibilitychange follows pageshow', () => {
    const service = createService();
    service.onForeground(context => contexts.push(context));

    goHidden();
    dispatchPageShow(true);
    goVisible();

    expect(contexts).toHaveLength(1);
  });

  it('tracks focus separately from visibility', () => {
    const service = createService();

    window.dispatchEvent(new Event('blur'));

    // A window can be fully rendered and still not be the one the user is working in.
    expect(service.visible()).toBe(true);
    expect(service.focused()).toBe(false);
    expect(service.hasUserAttention()).toBe(false);

    window.dispatchEvent(new Event('focus'));

    expect(service.hasUserAttention()).toBe(true);
  });

  it('does not treat a focus change as a foreground event', () => {
    const service = createService();
    service.onForeground(context => contexts.push(context));

    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));

    // Losing focus neither throttles timers nor closes sockets, so it must not trigger
    // a connection probe.
    expect(contexts).toHaveLength(0);
  });

  it('treats pagehide as going to the background', () => {
    const service = createService();
    service.onForeground(context => contexts.push(context));

    window.dispatchEvent(new Event('pagehide'));

    expect(service.visible()).toBe(false);
  });

  it('keeps notifying the remaining subscribers when one throws', () => {
    const service = createService();
    service.onForeground(() => {
      throw new Error('handler blew up');
    });
    service.onForeground(context => contexts.push(context));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    goHidden();
    goVisible();

    expect(contexts).toHaveLength(1);
  });

  it('stops notifying after unsubscribing', () => {
    const service = createService();
    const unsubscribe = service.onForeground(context => contexts.push(context));

    unsubscribe();
    goHidden();
    goVisible();

    expect(contexts).toHaveLength(0);
  });

  function createService(): PageVisibilityService {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    return TestBed.inject(PageVisibilityService);
  }

  function goHidden(): void {
    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  }

  function goVisible(): void {
    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
  }
});

function setVisibilityState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state
  });
}

function dispatchPageShow(persisted: boolean): void {
  // Built by hand because jsdom does not implement PageTransitionEvent.
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });

  window.dispatchEvent(event);
}
