/**
 * Content script entry point — wires SpeedController, VideoManager,
 * and InputController together, loads persisted settings, and listens
 * for messages from the popup / background service worker.
 */
(async function () {
  'use strict';

  const { SpeedController, VideoManager, InputController } = window.USC;

  // Check the site blacklist before doing anything
  const { enabled = true, turboSpeed = 2.0, scrollStep = 0.10,
          showBadge = true, badgePosition = 'top-left',
          siteBlacklist = '', autoReset = false } =
    await chrome.storage.sync.get([
      'enabled', 'turboSpeed', 'scrollStep',
      'showBadge', 'badgePosition', 'siteBlacklist', 'autoReset',
    ]);

  if (!enabled) return;

  // Honour per-site blacklist (comma-separated domains)
  if (siteBlacklist) {
    const blocked = siteBlacklist.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const host = location.hostname.toLowerCase();
    if (blocked.some(domain => host === domain || host.endsWith('.' + domain))) return;
  }

  const sc = new SpeedController();
  sc.TURBO_SPEED = turboSpeed;
  sc.scrollStep = scrollStep;

  const vm = new VideoManager({ showBadge, badgePosition });
  vm.init();

  const ic = new InputController(sc, vm);
  ic.attach();

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
        const target = vm.getActiveVideoOrFirst();
        const speed = sc.setSpeed(msg.speed);
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
        if (msg.turboSpeed !== undefined) sc.TURBO_SPEED = msg.turboSpeed;
        if (msg.scrollStep !== undefined) sc.scrollStep = msg.scrollStep;
        if (msg.showBadge !== undefined) vm.updateBadgeVisibility(msg.showBadge);
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
    if (changes.turboSpeed) sc.TURBO_SPEED = changes.turboSpeed.newValue;
    if (changes.scrollStep) sc.scrollStep = changes.scrollStep.newValue;
    if (changes.showBadge) vm.updateBadgeVisibility(changes.showBadge.newValue);
  });
})();
