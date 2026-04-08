/**
 * Options page script — reads/writes all advanced settings
 * from chrome.storage.sync with auto-save on change.
 */
(async function () {
  'use strict';

  const $scrollStep    = document.getElementById('scroll-step');
  const $turboSpeed    = document.getElementById('turbo-speed');
  const $autoReset     = document.getElementById('auto-reset');
  const $showBadge     = document.getElementById('show-badge');
  const $badgePosition = document.getElementById('badge-position');
  const $blacklist     = document.getElementById('site-blacklist');
  const $toast         = document.getElementById('toast');

  // ── Load saved values ──

  const stored = await chrome.storage.sync.get([
    'scrollStep', 'turboSpeed', 'autoReset',
    'showBadge', 'badgePosition', 'siteBlacklist',
  ]);

  if (Number.isFinite(stored.scrollStep))     $scrollStep.value    = stored.scrollStep;
  if (Number.isFinite(stored.turboSpeed))     $turboSpeed.value    = stored.turboSpeed;
  if (typeof stored.autoReset === 'boolean')  $autoReset.checked   = stored.autoReset;
  if (typeof stored.showBadge === 'boolean')  $showBadge.checked   = stored.showBadge;
  if (typeof stored.badgePosition === 'string') $badgePosition.value = stored.badgePosition;
  if (typeof stored.siteBlacklist === 'string') $blacklist.value     = stored.siteBlacklist;

  // ── Auto-save on change ──

  function save(obj) {
    chrome.storage.sync.set(obj, showToast);
  }

  $scrollStep.addEventListener('change', () => {
    const val = parseFloat($scrollStep.value);
    if (val >= 0.01 && val <= 0.50) save({ scrollStep: val });
  });

  $turboSpeed.addEventListener('change', () => {
    const val = parseFloat($turboSpeed.value);
    if (val >= 1.25 && val <= 5.00) save({ turboSpeed: val });
  });

  $autoReset.addEventListener('change', () => {
    save({ autoReset: $autoReset.checked });
  });

  $showBadge.addEventListener('change', () => {
    save({ showBadge: $showBadge.checked });
  });

  $badgePosition.addEventListener('change', () => {
    save({ badgePosition: $badgePosition.value });
  });

  let blacklistTimer;
  $blacklist.addEventListener('input', () => {
    clearTimeout(blacklistTimer);
    blacklistTimer = setTimeout(() => {
      save({ siteBlacklist: $blacklist.value.trim() });
    }, 500);
  });

  // ── Toast notification ──

  let toastTimer;
  function showToast() {
    $toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('visible'), 1500);
  }
})();
