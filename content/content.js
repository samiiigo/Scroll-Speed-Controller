/**
 * Content script entry point — wires SpeedController, VideoManager,
 * and InputController together, loads persisted settings, and listens
 * for messages from the popup / background service worker.
 */
(async function () {
  'use strict';

  const { SpeedController, VideoManager, InputController } = window.USC;

  // Check the site blacklist before doing anything
  const stored = await chrome.storage.sync.get([
    'enabled', 'turboSpeed', 'scrollStep',
    'showBadge', 'badgePosition', 'siteBlacklist', 'autoReset',
  ]);

  const enabled       = stored.enabled !== false;
  const turboSpeed    = Number.isFinite(stored.turboSpeed) ? stored.turboSpeed : 5.0;
  const scrollStep    = Number.isFinite(stored.scrollStep) ? stored.scrollStep : 0.25;
  const showBadge     = stored.showBadge !== false;
  const badgePosition = typeof stored.badgePosition === 'string' ? stored.badgePosition : 'top-left';
  const siteBlacklist = typeof stored.siteBlacklist === 'string' ? stored.siteBlacklist : '';
  const autoReset     = stored.autoReset === true;

  if (!enabled) return;

  if (siteBlacklist) {
    const blocked = siteBlacklist.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const host = location.hostname.toLowerCase();
    if (blocked.some(domain => host === domain || host.endsWith('.' + domain))) return;
  }

  const sc = new SpeedController();
  sc.TURBO_SPEED = turboSpeed;
  sc.scrollStep = scrollStep;

  const vm = new VideoManager({ showBadge, badgePosition });
  const ic = new InputController(sc, vm);
  
  const start = () => {
    ic.attach();
    vm.init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Reset speed on SPA navigation if the user opted in
  if (autoReset) {
    const resetOnNav = () => {
      sc.reset();
      vm.applySpeed(1.0);
    };
    window.addEventListener('yt-navigate-finish', resetOnNav);
    window.addEventListener('popstate', resetOnNav);
  }

  // Listen for messages from popup / background
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'SET_SPEED': {
        const raw = Number(msg.speed);
        if (!Number.isFinite(raw)) break;
        const target = vm.getActiveVideoOrFirst();
        const speed = sc.setSpeed(raw);
        if (target) vm.applySpeedToVideo(target, speed, { remember: true });
        break;
      }
      case 'RESET_SPEED': {
        const target = vm.getActiveVideoOrFirst();
        const speed = sc.reset();
        if (target) vm.applySpeedToVideo(target, speed, { remember: true });
        break;
      }
      case 'TOGGLE': {
        if (msg.enabled) {
          ic.attach();
          vm.init();
        } else {
          ic.detach();
          vm.destroy();
        }
        break;
      }
      case 'UPDATE_SETTINGS': {
        if (Number.isFinite(msg.turboSpeed)) sc.TURBO_SPEED = msg.turboSpeed;
        if (Number.isFinite(msg.scrollStep)) sc.scrollStep = msg.scrollStep;
        if (typeof msg.showBadge === 'boolean') vm.updateBadgeVisibility(msg.showBadge);
        break;
      }
      case 'QUERY_SPEED': {
        const target = vm.getActiveVideoOrFirst();
        const speed = target ? vm.getRememberedSpeed(target) : sc.currentSpeed;
        sendResponse({ speed });
        break;
      }
    }
  });

  // React to storage changes in real time (e.g. from options page)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.turboSpeed && Number.isFinite(changes.turboSpeed.newValue)) {
      sc.TURBO_SPEED = changes.turboSpeed.newValue;
    }
    if (changes.scrollStep && Number.isFinite(changes.scrollStep.newValue)) {
      sc.scrollStep = changes.scrollStep.newValue;
    }
    if (changes.showBadge && typeof changes.showBadge.newValue === 'boolean') {
      vm.updateBadgeVisibility(changes.showBadge.newValue);
    }
  });
})();
