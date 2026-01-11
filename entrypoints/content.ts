import { storage } from '@wxt-dev/storage';

const AD_OVERLAY_SELECTORS = [
  '.publicbox.ng-star-inserted',
  '[class*="publicbox"][class*="ng-star-inserted"]',
  'div[class*="ad-overlay"]',
  'div[class*="ad-container"]',
];

const PLAY_BUTTON_SELECTORS = [
  '.overlay-play-container .vv-state.iconfont.ng-star-inserted',
  '.overlay-play-container .vv-state.iconfont',
  '.overlay-play-container .iconbofang',
  '.overlay-play-container .iconzanting',
  '.overlay-play-container [class*="vv-state"]',
  '[class*="overlay-play"] .vv-state',
  'vg-play-pause [class*="icon"]',
  '#play-pause-button',
];

const PLAYER_SELECTORS = [
  'vg-player',
  '[class*="vg-player"]',
  '[class*="video-player"]',
  '.player-container',
];

const AD_CONTENT_PATTERNS = [
  /\d+\s*[sS秒]/,
  /广告/,
  /ad/i,
  /skip/i,
  /跳过/,
];

const AD_STATE_CLASSES = [
  'is-playing-ads',
  'ad-playing',
  'showing-ad',
];

let adBlockerStyleInjected = false;

const blockedCountStorage = storage.defineItem<number>('local:blockedCount', {
  fallback: 0,
});

async function incrementBlockedCount(): Promise<void> {
  const current = await blockedCountStorage.getValue();
  await blockedCountStorage.setValue(current + 1);
}

function queryFirst<T extends Element>(selectors: string[]): T | null {
  for (const selector of selectors) {
    try {
      const el = document.querySelector<T>(selector);
      if (el) return el;
    } catch {
      continue;
    }
  }
  return null;
}

function queryAll(selectors: string[]): Element[] {
  const results: Element[] = [];
  const seen = new WeakSet<Element>();

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      });
    } catch {
      continue;
    }
  }
  return results;
}

const WHITELIST_SELECTORS = [
  '.overlay-play-container',
  '.vg-controls-hidden',
  'vg-controls',
  'vg-player',
  '.player-title-bar',
  '.control-left',
  '.controll-right',
  'video',
];

function isWhitelisted(element: Element): boolean {
  return WHITELIST_SELECTORS.some(selector => {
    try {
      return element.matches(selector) || element.closest(selector) === element;
    } catch {
      return false;
    }
  });
}

function isAdOverlayByFeature(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;

  if (isWhitelisted(element)) return false;

  const className = element.className || '';
  if (/overlay-play|vg-controls|player-title|control-left|controll-right/i.test(className)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const isLargeEnough = rect.width > 200 && rect.height > 100;
  if (!isLargeEnough) return false;

  const style = window.getComputedStyle(element);
  const zIndex = parseInt(style.zIndex, 10);
  const hasHighZIndex = !isNaN(zIndex) && zIndex > 10;
  const isPositioned = style.position === 'absolute' || style.position === 'fixed';

  if (!isPositioned && !hasHighZIndex) return false;

  const text = element.textContent || '';
  const hasAdContent = AD_CONTENT_PATTERNS.some(pattern => pattern.test(text));

  const hasAdClass = /publicbox|ad-overlay|ad-container/i.test(className);

  return hasAdContent || hasAdClass;
}

function isPlayerInAdState(): boolean {
  const player = queryFirst<HTMLElement>(PLAYER_SELECTORS);
  if (!player) return false;

  const classList = player.className || '';
  return AD_STATE_CLASSES.some(cls => classList.includes(cls));
}

function removeAdOverlay(element: Element): boolean {
  element.remove();
  console.log('[YFSP Blocker] Ad overlay removed:', element.className);
  return true;
}

function injectForceShowControlsStyle(): void {
  if (adBlockerStyleInjected) return;

  const style = document.createElement('style');
  style.id = 'yfsp-blocker-style';
  style.textContent = `
    .yfsp-force-controls vg-controls.bg-overlayer,
    .yfsp-force-controls .player-title-bar {
      opacity: 1 !important;
      visibility: visible !important;
      display: flex !important;
      pointer-events: auto !important;
    }
    .yfsp-force-controls vg-controls.bg-overlayer.hide,
    .yfsp-force-controls .player-title-bar.hide {
      opacity: 1 !important;
      visibility: visible !important;
      display: flex !important;
    }
    .yfsp-force-controls .vg-controls-hidden.hide {
      opacity: 1 !important;
      visibility: visible !important;
    }
    .yfsp-force-controls vg-controls.bg-overlayer {
      flex-wrap: wrap !important;
    }
    .yfsp-force-controls .stick-bottom {
      width: 100% !important;
    }
    .yfsp-force-controls .control-left {
      flex: 0 0 auto !important;
    }
    .yfsp-force-controls .controll-right {
      flex: 0 0 auto !important;
      margin-left: auto !important;
    }
  `;
  document.head.appendChild(style);
  adBlockerStyleInjected = true;
  console.log('[YFSP Blocker] Force controls style injected');
}

function forceShowControls(): void {
  injectForceShowControlsStyle();

  const player = queryFirst<HTMLElement>(PLAYER_SELECTORS);
  if (player) {
    player.classList.add('yfsp-force-controls');
    console.log('[YFSP Blocker] Force controls class added to player');

    AD_STATE_CLASSES.forEach(cls => player.classList.remove(cls));

    setTimeout(() => {
      player.classList.remove('yfsp-force-controls');
      console.log('[YFSP Blocker] Force controls class removed');
    }, 25000);
  }
}

function resumePlayback(): void {
  const playButton = queryFirst<HTMLElement>(PLAY_BUTTON_SELECTORS);
  if (playButton) {
    playButton.click();
    console.log('[YFSP Blocker] Clicked play button to resume');
    return;
  }

  const video = document.querySelector('video');
  if (video instanceof HTMLVideoElement && video.paused) {
    video.play().catch(() => {});
    console.log('[YFSP Blocker] Called video.play() directly');
  }
}

function handleAdDetection(adOverlay: Element): void {
  const removed = removeAdOverlay(adOverlay);
  if (removed) {
    incrementBlockedCount();
    forceShowControls();
    setTimeout(resumePlayback, 100);
  }
}

function checkExistingAds(): void {
  const adsBySelector = queryAll(AD_OVERLAY_SELECTORS);
  adsBySelector.forEach(ad => handleAdDetection(ad));

  if (isPlayerInAdState()) {
    const player = queryFirst<HTMLElement>(PLAYER_SELECTORS);
    if (player) {
      const potentialAds = player.querySelectorAll('div[class*="ng-star-inserted"]');
      potentialAds.forEach(el => {
        if (isAdOverlayByFeature(el)) {
          handleAdDetection(el);
        }
      });
    }
  }
}

function matchesAnySelector(element: Element, selectors: string[]): boolean {
  return selectors.some(selector => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

function setupMutationObserver(): MutationObserver {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target as HTMLElement;
        if (AD_STATE_CLASSES.some(cls => target.classList.contains(cls))) {
          console.log('[YFSP Blocker] Detected ad state class change');
          setTimeout(checkExistingAds, 50);
        }
      }

      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (matchesAnySelector(node, AD_OVERLAY_SELECTORS)) {
          handleAdDetection(node);
          continue;
        }

        if (isAdOverlayByFeature(node)) {
          handleAdDetection(node);
          continue;
        }

        const adOverlays = queryAll(AD_OVERLAY_SELECTORS.map(s => `:scope ${s}`));
        for (const selector of AD_OVERLAY_SELECTORS) {
          try {
            const adOverlay = node.querySelector(selector);
            if (adOverlay) {
              handleAdDetection(adOverlay);
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  return observer;
}

export default defineContentScript({
  matches: ['*://*.yfsp.tv/*'],
  runAt: 'document_idle',

  main(ctx) {
    console.log('[YFSP Blocker] Content script loaded');

    checkExistingAds();
    const observer = setupMutationObserver();

    const intervalId = setInterval(checkExistingAds, 5000);

    ctx.onInvalidated(() => {
      console.log('[YFSP Blocker] Content script invalidated, cleaning up');
      clearInterval(intervalId);
      observer.disconnect();
    });
  },
});
