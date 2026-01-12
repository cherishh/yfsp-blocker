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

// 自定义倍速选项配置
const CUSTOM_SPEED_OPTIONS = [
  { speed: 1.1, insertAfter: '1.0x' },   // 在 1.0x 后面插入
  { speed: 2.0, insertAfter: '1.5x' },   // 在 1.5x 后面插入（VIP 2.0x 前面）
  { speed: 3.0, insertAfter: null },     // 插入到最后
];

const blockedCountStorage = storage.defineItem<number>('local:blockedCount', {
  fallback: 0,
});

const enabledStorage = storage.defineItem<boolean>('local:enabled', {
  fallback: true,
});

let isEnabled = true;

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

// ========== 倍速菜单增强功能 ==========

function injectSpeedMenuStyles(): void {
  if (document.getElementById('yfsp-speed-menu-style')) return;

  const style = document.createElement('style');
  style.id = 'yfsp-speed-menu-style';
  style.textContent = `
    /* 修复菜单 overflow 问题 */
    .player-speed-menu.opened {
      max-height: none !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
    }
    .player-speed {
      overflow: visible !important;
    }
    .yfsp-speed-indicator {
      display: inline-block;
      width: 6px;
      height: 6px;
      background: radial-gradient(circle at 30% 30%, #4ade80, #22c55e);
      border-radius: 50%;
      margin-left: 8px;
      box-shadow: 0 0 4px #22c55e, 0 0 8px rgba(34, 197, 94, 0.4);
      vertical-align: middle;
      flex-shrink: 0;
    }
    .player-speed-menu-item.yfsp-custom-speed {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .player-speed-menu-item.yfsp-custom-speed .player-speed-menu-item-label {
      flex: 1;
    }
    /* 自定义倍速 toggler 显示 */
    .player-speed-toggler-label.yfsp-custom-speed-label {
      font-family: inherit;
      font-size: 16px;
      font-style: normal;
      font-weight: 500;
    }
    .player-speed-toggler-label.yfsp-custom-speed-label::before {
      content: none !important;
    }
  `;
  document.head.appendChild(style);
  console.log('[YFSP Blocker] Speed menu styles injected');
}

function setPlaybackSpeed(speed: number): void {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (video instanceof HTMLVideoElement) {
      video.playbackRate = speed;
    }
  });
  console.log(`[YFSP Blocker] Playback speed set to ${speed}x`);
}

function closeSpeedMenu(): void {
  // 模拟点击 toggler 来关闭菜单，保持网站内部状态同步
  const toggler = document.querySelector('.player-speed-toggler');
  if (toggler instanceof HTMLElement) {
    toggler.click();
  }
}

function removeCustomSpeedOptions(): void {
  // 移除注入的自定义倍速选项
  document.querySelectorAll('.yfsp-custom-speed').forEach(el => el.remove());

  // 移除注入的样式
  const style = document.getElementById('yfsp-speed-menu-style');
  if (style) style.remove();

  // 恢复 toggler 显示
  const toggler = document.querySelector('.player-speed-toggler-label');
  if (toggler) {
    toggler.classList.remove('yfsp-custom-speed-label');
    if (!toggler.textContent?.trim()) {
      // 如果没有内容，恢复默认的 1.0x 图标
      toggler.classList.add('icona-100X');
    }
  }

  console.log('[YFSP Blocker] Custom speed options removed');
}

// 原有倍速对应的 class 名映射
const SPEED_CLASS_MAP: Record<string, string> = {
  '0.5': 'icona-050X',
  '0.75': 'icona-075X',
  '1': 'icona-100X',
  '1.25': 'icona-125X',
  '1.5': 'icona-150X',
  '2': 'icona-200X',
};

function updateSpeedTogglerDisplay(speed: number, isCustomSpeed: boolean): void {
  const toggler = document.querySelector('.player-speed-toggler-label');
  if (!toggler) return;

  // 移除所有 icona-*X 类名
  const classesToRemove = Array.from(toggler.classList).filter(c => /^icona-.*X$/i.test(c));
  classesToRemove.forEach(c => toggler.classList.remove(c));

  if (isCustomSpeed) {
    // 自定义倍速：显示文字
    toggler.classList.add('yfsp-custom-speed-label');
    toggler.textContent = `${speed}x`;
  } else {
    // 原有倍速：恢复 class 显示方式
    toggler.classList.remove('yfsp-custom-speed-label');
    toggler.textContent = '';
    const speedKey = String(speed);
    const iconClass = SPEED_CLASS_MAP[speedKey];
    if (iconClass) {
      toggler.classList.add(iconClass);
    }
  }
}

function updateActiveSpeedItem(menu: Element, speed: number): void {
  // 移除所有 active class
  menu.querySelectorAll('.player-speed-menu-item').forEach(item => {
    item.classList.remove('active');
  });

  // 为当前速度添加 active class
  const speedLabel = `${speed}x`;
  menu.querySelectorAll('.player-speed-menu-item').forEach(item => {
    const label = item.querySelector('.player-speed-menu-item-label');
    if (label && label.textContent?.trim() === speedLabel) {
      item.classList.add('active');
    }
  });
}

function createSpeedMenuItem(speed: number): HTMLElement {
  const item = document.createElement('div');
  item.className = 'player-speed-menu-item yfsp-custom-speed ng-star-inserted';

  const label = document.createElement('span');
  label.className = 'player-speed-menu-item-label';
  label.textContent = `${speed}x`;

  const indicator = document.createElement('span');
  indicator.className = 'yfsp-speed-indicator';

  item.appendChild(label);
  item.appendChild(indicator);

  item.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 设置播放速度
    setPlaybackSpeed(speed);

    // 更新 active 状态
    const menu = item.closest('.player-speed-menu');
    if (menu) {
      updateActiveSpeedItem(menu, speed);
    }

    // 更新控制栏显示（自定义倍速）
    updateSpeedTogglerDisplay(speed, true);

    // 关闭菜单
    closeSpeedMenu();

    // 持续确保速度设置生效（防止被网站覆盖）
    setTimeout(() => setPlaybackSpeed(speed), 100);
    setTimeout(() => setPlaybackSpeed(speed), 500);
  });

  return item;
}

function enhanceSpeedMenu(menu: Element): void {
  // 防护关闭时不增强
  if (!isEnabled) return;

  // 避免重复增强
  if (menu.querySelector('.yfsp-custom-speed')) return;

  injectSpeedMenuStyles();

  const items = Array.from(menu.querySelectorAll('.player-speed-menu-item'));

  // 为原有倍速选项添加点击监听，确保 UI 正确显示
  items.forEach(item => {
    const label = item.querySelector('.player-speed-menu-item-label');
    if (!label) return;

    const speedText = label.textContent?.trim();
    if (!speedText) return;

    const speedMatch = speedText.match(/^([\d.]+)x$/);
    if (!speedMatch) return;

    const speed = parseFloat(speedMatch[1]);

    item.addEventListener('click', () => {
      // 原有倍速，恢复 class 显示方式
      updateSpeedTogglerDisplay(speed, false);
      // 移除自定义选项的 active 状态
      menu.querySelectorAll('.yfsp-custom-speed').forEach(el => {
        el.classList.remove('active');
      });
    });
  });

  for (const config of CUSTOM_SPEED_OPTIONS) {
    const newItem = createSpeedMenuItem(config.speed);

    if (config.insertAfter === null) {
      // 插入到最后
      menu.appendChild(newItem);
    } else {
      // 找到指定位置后插入
      const targetItem = items.find(item => {
        const label = item.querySelector('.player-speed-menu-item-label');
        return label?.textContent?.trim() === config.insertAfter;
      });

      if (targetItem && targetItem.nextSibling) {
        menu.insertBefore(newItem, targetItem.nextSibling);
      } else if (targetItem) {
        // 如果是最后一个，插入到后面
        targetItem.parentNode?.appendChild(newItem);
      }
    }
  }

  console.log('[YFSP Blocker] Speed menu enhanced with custom options');
}

function setupSpeedMenuObserver(): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // 检测菜单打开（class 变化添加 opened）
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target as HTMLElement;
        if (target.classList.contains('player-speed-menu') &&
            target.classList.contains('opened')) {
          enhanceSpeedMenu(target);
        }
      }

      // 检测新添加的菜单元素
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        // 直接是菜单
        if (node.classList.contains('player-speed-menu')) {
          if (node.classList.contains('opened')) {
            enhanceSpeedMenu(node);
          }
        }

        // 包含菜单的容器
        const menu = node.querySelector('.player-speed-menu.opened');
        if (menu) {
          enhanceSpeedMenu(menu);
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

// ========== 播放恢复功能 ==========

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
  if (!isEnabled) return;

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
    if (!isEnabled) return;

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

  async main(ctx) {
    console.log('[YFSP Blocker] Content script loaded');

    // 初始化开关状态
    isEnabled = await enabledStorage.getValue();
    console.log('[YFSP Blocker] Protection enabled:', isEnabled);

    // 监听开关状态变化
    const unwatchEnabled = enabledStorage.watch((newValue) => {
      isEnabled = newValue ?? true;
      console.log('[YFSP Blocker] Protection toggled:', isEnabled);

      if (!isEnabled) {
        // 关闭防护时移除注入的倍速选项
        removeCustomSpeedOptions();
      }
    });

    checkExistingAds();
    const observer = setupMutationObserver();
    const speedMenuObserver = setupSpeedMenuObserver();

    const intervalId = setInterval(checkExistingAds, 5000);

    ctx.onInvalidated(() => {
      console.log('[YFSP Blocker] Content script invalidated, cleaning up');
      clearInterval(intervalId);
      observer.disconnect();
      speedMenuObserver.disconnect();
      unwatchEnabled();
    });
  },
});
