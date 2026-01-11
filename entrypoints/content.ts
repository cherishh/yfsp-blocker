import { storage } from '@wxt-dev/storage';

const AD_OVERLAY_SELECTOR = '.publicbox.ng-star-inserted';
const PLAY_BUTTON_SELECTOR = '.overlay-play-container .vv-state.iconfont.ng-star-inserted';
const VIDEO_SELECTOR = 'video';

let adBlockerStyleInjected = false;

const blockedCountStorage = storage.defineItem<number>('local:blockedCount', {
  fallback: 0,
});

async function incrementBlockedCount(): Promise<void> {
  const current = await blockedCountStorage.getValue();
  await blockedCountStorage.setValue(current + 1);
}

function removeAdOverlay(element: Element): boolean {
  element.remove();
  console.log('[YFSP Blocker] Ad overlay removed');
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

  const player = document.querySelector('vg-player');
  if (player) {
    player.classList.add('yfsp-force-controls');
    console.log('[YFSP Blocker] Force controls class added to player');

    setTimeout(() => {
      player.classList.remove('yfsp-force-controls');
      console.log('[YFSP Blocker] Force controls class removed');
    }, 25000);
  }
}

function resumePlayback(): void {
  const playButton = document.querySelector(PLAY_BUTTON_SELECTOR);
  if (playButton instanceof HTMLElement) {
    playButton.click();
    console.log('[YFSP Blocker] Clicked play button to resume');
    return;
  }

  const video = document.querySelector(VIDEO_SELECTOR);
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
  const existingAds = document.querySelectorAll(AD_OVERLAY_SELECTOR);
  existingAds.forEach(ad => handleAdDetection(ad));
}

function setupMutationObserver(): MutationObserver {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches(AD_OVERLAY_SELECTOR)) {
          handleAdDetection(node);
          continue;
        }

        const adOverlay = node.querySelector(AD_OVERLAY_SELECTOR);
        if (adOverlay) {
          handleAdDetection(adOverlay);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

export default defineContentScript({
  matches: ['*://*.yfsp.tv/*'],
  runAt: 'document_idle',

  main() {
    console.log('[YFSP Blocker] Content script loaded');

    checkExistingAds();
    setupMutationObserver();
  },
});
