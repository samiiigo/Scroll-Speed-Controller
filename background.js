/**
 * Service Worker — runs off the main thread, stays dormant until needed.
 * Responsibilities:
 *   1. Initialize default storage on install.
 *   2. Relay messages from popup → content script.
 *   3. Update the extension badge with the current speed.
 */

const DEFAULTS = {
  enabled: true,
  turboSpeed: 5.0,
  scrollStep: 0.25,
  showBadge: true,
  badgePosition: 'top-left',
  siteBlacklist: '',
  autoReset: false,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(Object.keys(DEFAULTS), (stored) => {
    const toSet = {};
    for (const key of Object.keys(DEFAULTS)) {
      if (stored[key] === undefined) toSet[key] = DEFAULTS[key];
    }
    if (Object.keys(toSet).length) chrome.storage.sync.set(toSet);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SPEED_CHANGED' && sender.tab) {
    const text = msg.speed === 1.0 ? '' : `${msg.speed.toFixed(1)}×`;
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
  }

  if (msg.type === 'GET_SPEED') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return sendResponse({ speed: 1.0 });
      chrome.tabs.sendMessage(tabs[0].id, { type: 'QUERY_SPEED' }, (resp) => {
        if (chrome.runtime.lastError) return sendResponse({ speed: 1.0 });
        sendResponse(resp || { speed: 1.0 });
      });
    });
    return true; // async sendResponse
  }


});
