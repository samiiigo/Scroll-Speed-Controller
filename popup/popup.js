/**
 * Popup script — communicates with the active tab's content script
 * via chrome.tabs.sendMessage and persists settings in chrome.storage.sync.
 */
(async function () {
  'use strict';

  const $speed    = document.getElementById('current-speed');
  const $toggle   = document.getElementById('toggle-enabled');
  const $turbo    = document.getElementById('turbo-speed');
  const $step     = document.getElementById('scroll-step');
  const $reset    = document.getElementById('reset-speed');
  const $presets  = document.querySelectorAll('.preset-btn');

  // ── Load persisted settings ──

  const stored = await chrome.storage.sync.get([
    'enabled', 'turboSpeed', 'scrollStep',
  ]);

  const isEnabled = stored.enabled !== false;
  $toggle.checked = isEnabled;
  document.body.classList.toggle('disabled', !isEnabled);

  if (stored.turboSpeed !== undefined) $turbo.value = String(stored.turboSpeed);
  if (stored.scrollStep !== undefined) $step.value  = String(stored.scrollStep);

  // ── Query the current speed from the active tab ──

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'QUERY_SPEED' }, (resp) => {
        if (chrome.runtime.lastError) return; // no content script on this page
        if (resp?.speed != null) updateSpeedDisplay(resp.speed);
      });
    }
  } catch (_) { /* ignore tabs that can't be queried */ }

  // ── Helpers ──

  function sendToTab(payload) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, payload);
    });
  }

  function updateSpeedDisplay(speed) {
    $speed.textContent = `${Number(speed).toFixed(2)}×`;

    $presets.forEach(btn => {
      const match = Math.abs(parseFloat(btn.dataset.speed) - speed) < 0.001;
      btn.classList.toggle('active', match);
    });
  }

  // ── Toggle on/off ──

  $toggle.addEventListener('change', () => {
    const on = $toggle.checked;
    document.body.classList.toggle('disabled', !on);
    chrome.storage.sync.set({ enabled: on });
    sendToTab({ type: 'TOGGLE', enabled: on });
  });

  // ── Preset buttons ──

  $presets.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      updateSpeedDisplay(speed);
      sendToTab({ type: 'SET_SPEED', speed });
    });
  });

  // ── Turbo speed select ──

  $turbo.addEventListener('change', () => {
    const val = parseFloat($turbo.value);
    chrome.storage.sync.set({ turboSpeed: val });
    sendToTab({ type: 'UPDATE_SETTINGS', turboSpeed: val });
  });

  // ── Scroll step select ──

  $step.addEventListener('change', () => {
    const val = parseFloat($step.value);
    chrome.storage.sync.set({ scrollStep: val });
    sendToTab({ type: 'UPDATE_SETTINGS', scrollStep: val });
  });

  // ── Reset ──

  $reset.addEventListener('click', () => {
    updateSpeedDisplay(1.0);
    sendToTab({ type: 'RESET_SPEED' });
  });
})();
