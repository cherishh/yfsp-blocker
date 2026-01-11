import { storage } from '@wxt-dev/storage';

const AD_OVERLAY_SELECTOR = '.publicbox.ng-star-inserted';
const PLAY_CONTAINER_SELECTOR = '.overlay-play-container';
const VIDEO_SELECTOR = 'video';

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

function resumePlayback(): void {
  const playContainer = document.querySelector(PLAY_CONTAINER_SELECTOR);
  if (playContainer instanceof HTMLElement) {
    playContainer.click();
    console.log('[YFSP Blocker] Clicked play container to resume');
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
    setTimeout(resumePlayback, 100);
  }
}

function checkExistingAds(): void {
  const existingAds = document.querySelectorAll(AD_OVERLAY_SELECTOR);
  existingAds.forEach((ad) => handleAdDetection(ad));
}

function setupMutationObserver(): MutationObserver {
  const observer = new MutationObserver((mutations) => {
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
