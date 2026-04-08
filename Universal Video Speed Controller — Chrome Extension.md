# Universal Video Speed Controller — Chrome Extension
## Complete Project Blueprint

***

## Executive Summary

This document outlines a full project plan for building a **Universal Video Speed Controller** Chrome Extension using Manifest V3. The extension lets users scroll while holding Spacebar to set playback speed between 0.01x–5.00x, jump to 2x by simply holding Spacebar, and instantly revert on release — all working on any HTML5 video including YouTube, Reddit, Twitter/X, Twitch, and embedded iframes.

***

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Extension API | Chrome Manifest V3 | Required for all new Chrome extensions; supports Service Workers[^1][^2] |
| Core Logic | Vanilla JavaScript (ES2022+) | No framework needed; keeps payload tiny; full DOM access[^3] |
| Video API | `HTMLMediaElement.playbackRate` | Native browser API for speed control; no hacks required[^4][^5] |
| DOM Watching | `MutationObserver` | Detects dynamically injected `<video>` elements in SPAs[^6][^7] |
| Keyboard Events | `keydown` / `keyup` on `document` | Captures spacebar state reliably in content scripts[^8][^9] |
| Scroll Events | `WheelEvent.deltaY` | Detects scroll direction and magnitude[^10][^11] |
| Persistence | `chrome.storage.sync` | Syncs user preferences across devices automatically[^12][^13] |
| Overlay UI | Injected `<div>` with CSS | Speed badge injected directly into the video's DOM parent[^14] |
| Build Tool | Vite + CRXJS | Fast hot-reload development workflow for Chrome extensions |
| Package Manager | pnpm | Fast, disk-efficient |

No React, no TypeScript is strictly required — pure vanilla JS keeps the extension under 50 KB total, fast to load, and easy to audit.

***

## Project Architecture

The extension follows the standard **Manifest V3 three-layer architecture**:[^15][^16]

```
┌──────────────────────────────────────────────────────┐
│                    CHROME BROWSER                    │
│                                                      │
│  ┌─────────────────┐     ┌────────────────────────┐  │
│  │  Service Worker │     │     Popup (popup.html)  │  │
│  │  (background.js)│◄───►│   Speed presets, prefs  │  │
│  │                 │     │   On/Off toggle          │  │
│  └────────┬────────┘     └────────────────────────┘  │
│           │ chrome.runtime.sendMessage                 │
│           ▼                                            │
│  ┌─────────────────────────────────────────────────┐  │
│  │            Content Script (content.js)           │  │
│  │                                                  │  │
│  │   ┌──────────────┐   ┌────────────────────────┐ │  │
│  │   │ VideoManager │   │   InputController      │ │  │
│  │   │              │   │                        │ │  │
│  │   │ - findVideos │   │ - keydown (Space)      │ │  │
│  │   │ - attachUI   │   │ - keyup  (Space)       │ │  │
│  │   │ - setSpeed   │   │ - wheel  (deltaY)      │ │  │
│  │   │ - MutObs     │   │ - preventDefault       │ │  │
│  │   └──────┬───────┘   └──────────┬─────────────┘ │  │
│  │          └──────────┬───────────┘               │  │
│  │                     ▼                            │  │
│  │            SpeedController (core)                │  │
│  │            - currentSpeed state                  │  │
│  │            - previousSpeed memory                │  │
│  │            - clamp(0.01 – 5.00)                  │  │
│  │            - updateOverlay()                     │  │
│  └─────────────────────────────────────────────────┘  │
│                          │                             │
│              ┌───────────▼──────────┐                  │
│              │   chrome.storage.sync│                  │
│              │   { speed, step,     │                  │
│              │     enabled, sites } │                  │
│              └──────────────────────┘                  │
└──────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Service Worker (`background.js`)**
Runs off the main thread and stays dormant until needed. Its only jobs are: initializing default storage on install, relaying messages from the popup to the active tab's content script, and handling the extension icon badge (showing current speed). It cannot touch the DOM.[^1][^15]

**Content Script (`content.js`)**
Injected into every page (`*://*/*`) at `document_idle`. This is where all the real work happens. It scans for `<video>` elements, attaches event listeners, manages the speed overlay, and handles SPA re-injection via `MutationObserver`.[^6][^3]

**Popup (`popup.html` + `popup.js`)**
A minimal 300×200px panel showing the current speed, preset buttons (0.5x, 1x, 1.5x, 2x), and an on/off toggle. Communicates with the content script via `chrome.tabs.sendMessage`.

***

## File Structure

```
universal-speed-controller/
├── manifest.json
├── background.js              # Service Worker
├── content/
│   ├── content.js             # Main content script (entry)
│   ├── videoManager.js        # Video detection & overlay injection
│   ├── inputController.js     # Keyboard + scroll event handling
│   ├── speedController.js     # Core speed state machine
│   └── overlay.css            # Speed badge styles (injected via manifest)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html           # Advanced settings page
│   └── options.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── package.json
```

***

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "Universal Video Speed Controller",
  "version": "1.0.0",
  "description": "Scroll + Spacebar to control video speed on any HTML5 site",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["*://*/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*/*"],
      "js": ["content/content.js"],
      "css": ["content/overlay.css"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

Key decisions: `"all_frames": true` ensures the extension works inside iframes (Twitch, embedded players, Reddit video). `host_permissions: ["*://*/*"]` is required to run on all sites including YouTube and Twitter.[^3][^14]

***

## Core Module Implementations

### speedController.js — The State Machine

```javascript
// speedController.js
const SPEED_MIN = 0.01;
const SPEED_MAX = 5.00;
const SCROLL_STEP = 0.10; // speed delta per scroll tick

export class SpeedController {
  constructor() {
    this.currentSpeed = 1.0;
    this.previousSpeed = 1.0;   // saved before spacebar-hold
    this.isTurboActive = false;
    this.TURBO_SPEED = 2.0;
  }

  clamp(value) {
    return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
  }

  // Called by scroll+spacebar combo
  adjustByScroll(deltaY) {
    const direction = deltaY > 0 ? -1 : 1;  // scroll down = slower
    const newSpeed = this.clamp(
      parseFloat((this.currentSpeed + direction * SCROLL_STEP).toFixed(2))
    );
    this.currentSpeed = newSpeed;
    return newSpeed;
  }

  // Called on Spacebar keydown
  activateTurbo() {
    if (this.isTurboActive) return this.currentSpeed;
    this.previousSpeed = this.currentSpeed;
    this.currentSpeed = this.TURBO_SPEED;
    this.isTurboActive = true;
    return this.TURBO_SPEED;
  }

  // Called on Spacebar keyup
  deactivateTurbo() {
    if (!this.isTurboActive) return this.currentSpeed;
    this.currentSpeed = this.previousSpeed;
    this.isTurboActive = false;
    return this.previousSpeed;
  }

  reset() {
    this.currentSpeed = 1.0;
    this.isTurboActive = false;
    return 1.0;
  }
}
```

The `clamp()` function enforces the 0.01–5.00 boundary. Chrome does not define a hard upper limit on `playbackRate` in the W3C spec, but audio mutes above 4.0x. The `toFixed(2)` call prevents floating-point drift when chaining scroll increments.[^17][^4]

### inputController.js — Keyboard & Scroll

```javascript
// inputController.js
export class InputController {
  constructor(speedController, videoManager) {
    this.sc = speedController;
    this.vm = videoManager;
    this.spaceHeld = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
  }

  attach() {
    document.addEventListener('keydown', this._onKeyDown, { capture: true });
    document.addEventListener('keyup', this._onKeyUp, { capture: true });
    window.addEventListener('wheel', this._onWheel, { passive: false });
  }

  detach() {
    document.removeEventListener('keydown', this._onKeyDown, true);
    document.removeEventListener('keyup', this._onKeyUp, true);
    window.removeEventListener('wheel', this._onWheel);
  }

  _onKeyDown(e) {
    // Space = keyCode 32, but use e.code for reliability
    if (e.code !== 'Space') return;

    // Don't capture if user is typing in input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (!this.spaceHeld) {
      this.spaceHeld = true;
      // Prevent default page scroll only when we handle it
      e.preventDefault();
      e.stopPropagation();
      const speed = this.sc.activateTurbo();
      this.vm.applySpeed(speed);
    } else {
      // Already held — prevent repeat key scroll default
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    if (e.code !== 'Space') return;
    this.spaceHeld = false;
    const speed = this.sc.deactivateTurbo();
    this.vm.applySpeed(speed);
  }

  _onWheel(e) {
    if (!this.spaceHeld) return;  // only active while Spacebar held
    e.preventDefault();           // block page scroll
    e.stopPropagation();
    const speed = this.sc.adjustByScroll(e.deltaY);
    this.vm.applySpeed(speed);
  }
}
```

Using `{ capture: true }` on keydown/keyup ensures the extension's listener fires before page scripts (including YouTube's own keyboard handler). Using `e.code` instead of `e.keyCode` is the modern MDN-recommended approach. The `_onWheel` listener uses `{ passive: false }` so `preventDefault()` is allowed — critical for blocking page scroll.[^8][^9][^11]

### videoManager.js — Video Detection & SPA Handling

```javascript
// videoManager.js
export class VideoManager {
  constructor() {
    this.videos = new Set();
    this.observer = null;
  }

  // Find all current videos and start watching for new ones
  init() {
    this._scanForVideos();
    this._startMutationObserver();
    this._handleSPANavigation();
  }

  _scanForVideos() {
    document.querySelectorAll('video').forEach(v => this._attachVideo(v));
  }

  _attachVideo(video) {
    if (this.videos.has(video)) return;
    this.videos.add(video);
    this._injectOverlay(video);
  }

  applySpeed(speed) {
    this.videos.forEach(video => {
      try {
        video.playbackRate = speed;  // HTMLMediaElement native API
      } catch (err) {
        // Element may have been removed from DOM
        this.videos.delete(video);
      }
    });
    this._updateAllOverlays(speed);
  }

  // Watch for dynamically added <video> elements (SPA sites, lazy loaders)
  _startMutationObserver() {
    this.observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          if (node.nodeName === 'VIDEO') this._attachVideo(node);
          if (node.querySelectorAll) {
            node.querySelectorAll('video').forEach(v => this._attachVideo(v));
          }
        });
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  // YouTube SPA: fires yt-navigate-finish on every video navigation
  _handleSPANavigation() {
    window.addEventListener('yt-navigate-finish', () => {
      this.videos.clear();
      this._scanForVideos();
    });
    // Generic SPA: watch for URL changes via History API
    const originalPushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      originalPushState(...args);
      setTimeout(() => this._scanForVideos(), 800);
    };
  }

  _injectOverlay(video) {
    const badge = document.createElement('div');
    badge.className = 'usc-speed-badge';
    badge.textContent = '1.00×';
    badge.dataset.videoId = Math.random().toString(36).slice(2);
    video.dataset.uscId = badge.dataset.videoId;
    // Insert badge inside the video's parent to follow layout
    const parent = video.parentElement;
    if (parent) {
      parent.style.position = parent.style.position || 'relative';
      parent.appendChild(badge);
    }
  }

  _updateAllOverlays(speed) {
    document.querySelectorAll('.usc-speed-badge').forEach(badge => {
      badge.textContent = `${speed.toFixed(2)}×`;
      badge.classList.add('usc-flash');
      setTimeout(() => badge.classList.remove('usc-flash'), 400);
    });
  }

  destroy() {
    this.observer?.disconnect();
    document.querySelectorAll('.usc-speed-badge').forEach(b => b.remove());
    this.videos.clear();
  }
}
```

The `MutationObserver` on `document.body` with `subtree: true` ensures newly injected video elements (e.g., Reddit's lazy video loader, Twitter's media player) are caught automatically. The YouTube-specific `yt-navigate-finish` event is the most reliable way to detect SPA navigation on YouTube without polling.[^7][^18][^19][^6]

### overlay.css — Speed Badge Styles

```css
.usc-speed-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2147483647;           /* Max z-index to appear above all UI */
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 14px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  pointer-events: none;          /* Don't block mouse on video */
  user-select: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

/* Show badge when speed is not 1x, or during turbo mode */
.usc-speed-badge.usc-flash,
.usc-speed-badge[data-active="true"] {
  opacity: 1;
}

.usc-speed-badge.usc-flash {
  transform: scale(1.1);
}
```

### content.js — Entry Point (Wires Everything)

```javascript
// content.js
import { SpeedController } from './speedController.js';
import { VideoManager } from './videoManager.js';
import { InputController } from './inputController.js';

(async () => {
  // Load saved settings
  const { enabled = true, turboSpeed = 2.0, scrollStep = 0.1 } =
    await chrome.storage.sync.get(['enabled', 'turboSpeed', 'scrollStep']);

  if (!enabled) return;

  const sc = new SpeedController();
  sc.TURBO_SPEED = turboSpeed;

  const vm = new VideoManager();
  vm.init();

  const ic = new InputController(sc, vm);
  ic.attach();

  // Listen for messages from popup / background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SET_SPEED') {
      sc.currentSpeed = sc.clamp(msg.speed);
      vm.applySpeed(sc.currentSpeed);
    }
    if (msg.type === 'TOGGLE') {
      msg.enabled ? ic.attach() : ic.detach();
    }
  });
})();
```

Using a top-level async IIFE lets the content script read `chrome.storage.sync` settings before attaching any listeners. This prevents a race where a user disabled the extension on a site but events still fire.[^12][^13]

### background.js — Service Worker

```javascript
// background.js
const DEFAULTS = {
  enabled: true,
  turboSpeed: 2.0,
  scrollStep: 0.10,
  showBadge: true,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(Object.keys(DEFAULTS), (stored) => {
    const toSet = {};
    Object.keys(DEFAULTS).forEach(k => {
      if (stored[k] === undefined) toSet[k] = DEFAULTS[k];
    });
    chrome.storage.sync.set(toSet);
  });
});

// Update extension badge with current speed
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'SPEED_CHANGED' && sender.tab) {
    chrome.action.setBadgeText({
      text: `${msg.speed}×`,
      tabId: sender.tab.id,
    });
    chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
  }
});
```

The Service Worker initializes only missing keys, so future updates can add new defaults without overwriting existing user preferences.[^20][^1]

***

## Feature Implementation Details

### Feature 1 — Scroll + Spacebar to Adjust Speed (0.01x–5.00x)

The `WheelEvent.deltaY` property returns a positive value scrolling down and negative scrolling up. Combined with the `spaceHeld` gate in `InputController`, this creates the combo:[^10][^11]

- **Scroll Down** while Spacebar held → speed decreases by 0.10x per tick
- **Scroll Up** while Spacebar held → speed increases by 0.10x per tick
- Speed is clamped between 0.01 and 5.00 using `SpeedController.clamp()`
- Page scroll is blocked via `e.preventDefault()` during the combo

> ⚠️ Chrome audio mutes automatically outside the 0.25x–4.0x range, but video continues playing. The UI can show a muted audio icon when speed is outside that window.[^4][^17]

### Feature 2 — Spacebar Hold → Instant 2x Turbo

On `keydown` with `e.code === 'Space'`, `SpeedController.activateTurbo()` saves the previous speed and sets `playbackRate = 2.0`. On `keyup`, `deactivateTurbo()` restores the saved speed. The `spaceHeld` guard prevents the keydown repeat event (fired continuously while a key is held) from triggering multiple activations.

Input fields (`INPUT`, `TEXTAREA`, `SELECT`) are whitelisted — the extension never fires when the user is typing.[^21]

### Feature 3 — SPA & Cross-Site Compatibility

| Site | Challenge | Solution |
|---|---|---|
| YouTube | SPA, replaces `<video>` on navigation[^22] | `yt-navigate-finish` event listener[^18][^19] |
| Reddit | Lazy-loaded video in feed | `MutationObserver` catches new `<video>` nodes[^6] |
| Twitter/X | Video in shadow DOM / iframes | `"all_frames": true` in manifest[^14] |
| Twitch | iframe-embedded player | `"all_frames": true` + iframe video scan[^3] |
| Generic HTML5 | Any `<video>` element | `querySelectorAll('video')` scan + `MutationObserver` |

The `history.pushState` override acts as a fallback for any SPA not using YouTube's custom event, rescanning for videos 800ms after each navigation.

***

## Popup UI Design

```
┌───────────────────────────────┐
│  ⚡ Speed Controller     [ON] │
├───────────────────────────────┤
│                               │
│       Current Speed           │
│         2.00×                 │
│                               │
│  [0.5×] [1.0×] [1.5×] [2.0×] │
│                               │
│  ──── Turbo Speed ────        │
│  Hold Space:  [2.0×  ▼]       │
│                               │
│  ──── Scroll Step ────        │
│  Per tick:    [0.10  ▼]       │
│                               │
│         [Reset Speed]         │
└───────────────────────────────┘
```

The popup uses `chrome.tabs.sendMessage` to dispatch `SET_SPEED` messages to the active tab's content script in real time. The `[ON]` toggle dispatches `TOGGLE` messages.

***

## Options Page — Advanced Settings

The options page (`options.html`) should expose:

- **Scroll Step Size** — 0.01 to 0.50 (default 0.10)
- **Turbo Speed Value** — 1.25x to 5.0x (default 2.0x)
- **Site Blacklist** — comma-separated domains to disable on
- **Show Speed Badge** — toggle the overlay on/off
- **Badge Position** — top-left, top-right, bottom-left, bottom-right
- **Auto-reset on navigation** — whether to revert to 1x between videos

All settings are persisted via `chrome.storage.sync` and are available in both the content script and popup without any additional messaging.[^12]

***

## Edge Cases & Known Browser Constraints

| Edge Case | Handling Strategy |
|---|---|
| Audio mutes above 4.0x[^17] | Show muted audio icon in badge above 4.0x |
| Negative `playbackRate` not supported uniformly[^23] | Clamp minimum to 0.01, never negative |
| `wheel` event `deltaY` is in pixels, not ticks[^11] | Normalize: use `Math.sign(deltaY)` for direction only |
| YouTube intercepts keyboard events | Use `capture: true` on event listeners to fire first[^8] |
| iframe cross-origin videos | `"all_frames": true` injects into same-origin iframes; cross-origin iframes require the site's own CSP to allow it[^14] |
| SPA removes and re-adds `<video>`[^24] | `MutationObserver` + `videos.delete()` on error |
| Multiple simultaneous videos | `VideoManager.videos` is a `Set` — all videos updated on every speed change |
| Extension disabled mid-page | `ic.detach()` removes all listeners; `vm.destroy()` removes overlays and disconnects observer |

***

## Development Workflow

### Setup

```bash
pnpm create vite universal-speed-controller --template vanilla
cd universal-speed-controller
pnpm add -D @crxjs/vite-plugin
```

### Local Dev Loop

1. Edit source files in `content/` or `popup/`
2. Run `pnpm dev` — CRXJS hot-reloads the extension in Chrome without manual reload
3. Open `chrome://extensions` with Developer Mode ON → load unpacked from `dist/`
4. Test on YouTube, Reddit, Twitter, and a raw HTML5 video page

### Build for Production

```bash
pnpm build
# Output: dist/ — ready to zip and upload to Chrome Web Store
```

***

## Chrome Web Store Publishing Checklist

- [ ] Privacy policy URL (required if `host_permissions` includes `*://*/*`)
- [ ] Justification for `activeTab` and `scripting` permissions in store listing
- [ ] 1280×800 and 640×400 screenshots
- [ ] Promotional tile (440×280)
- [ ] Short description (≤ 132 chars) and detailed description
- [ ] Version bump in `manifest.json` before each upload
- [ ] Test on Chrome stable, Chrome Beta, and Edge (Chromium)[^25]

***

## Security & Privacy Considerations

- The extension reads no user data, sends no network requests, and has no remote code execution.
- `chrome.storage.sync` stores only the five preference keys above — no URLs, no video content, no PII.
- Content scripts run in an **isolated world** by default, meaning page scripts cannot access extension variables.[^3]
- Avoid `"world": "MAIN"` unless absolutely necessary, as it exposes the content script to XSS from the page.[^7]
- The `scripting` permission is used only for badge updates from the service worker, not for arbitrary code injection.

---

## References

1. [Migrate to a service worker - Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) - A service worker replaces the extension's background or event page to ensure that background code st...

2. [Use the "background.service_worker" key instead manifest_version 3](https://stackoverflow.com/questions/66055882/chrome-extensions-use-the-background-service-worker-key-instead-manifest-vers) - Manifest V3 no longer supports background pages. Instead it now supports a new feature called servic...

3. [Content scripts | Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) - An explanation of content scripts and how to use them in your Chrome Extension.

4. [HTMLMediaElement.playbackRate - Web APIs - MDN Web Docs](https://mdn2.netlify.app/en-us/docs/web/api/htmlmediaelement/playbackrate/) - The HTMLMediaElement.playbackRate property sets the rate at which the media is being played back. Th...

5. [HTMLMediaElement: playbackRate property - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate) - The HTMLMediaElement.playbackRate property sets the rate at which the media is being played back. Th...

6. [A Guide to Listening for DOM Elements using MutationObserver](https://chromeextensions.substack.com/p/a-guide-to-listening-for-dom-elements) - In your Chrome extension's content script, create a function called waitForElement that takes a sele...

7. [Script finds element, but extension content_script comes back ...](https://www.reddit.com/r/learnjavascript/comments/18dxbvf/script_finds_element_but_extension_content_script/) - Currently I have a script that executes successfully in the dev console on Chrome; when running it i...

8. [chrome extension : How to get key events - Stack Overflow](https://stackoverflow.com/questions/5498893/chrome-extension-how-to-get-key-events) - To catch keypresses globally, or at least on web pages, you will have to use a content script that s...

9. [KeyboardEvent - Web APIs - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent) - KeyboardEvent objects describe a user interaction with the keyboard; each event describes a single i...

10. [HTML | DOM WheelEvent deltaY Property - GeeksforGeeks](https://www.geeksforgeeks.org/html/html-dom-wheelevent-deltay-property/) - The WheelEvent.deltaY property in HTML is used to return a positive double value when the web page i...

11. [WheelEvent: deltaY property - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY) - The WheelEvent.deltaY read-only property is a double representing the vertical scroll amount in the ...

12. [chrome.storage | Reference - Chrome for Developers](https://developer.chrome.com/docs/extensions/mv2/reference/storage) - The Storage API provides an extension-specific way to persist user data and state. It's similar to t...

13. [chrome.storage | API - Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/storage) - The Storage API provides an extension-specific way to persist user data and state. It's similar to t...

14. [Chrome Extension - Show custom notification/popup (HTML element ...](https://stackoverflow.com/questions/36181870/chrome-extension-show-custom-notification-popup-html-element-on-top-of-a-ful) - I want to write an extension for Chrome (as seems the easiest option) that would show notifications ...

15. [The Architecture of Chrome Extension Permissions: A Deep Dive](https://voicewriter.io/blog/the-architecture-of-chrome-extension-permissions-a-deep-dive) - The three most important components are the content scripts, popup pages, and background service wor...

16. [Chrome Extension Development: The Complete System Architecture ...](https://blog.devops.dev/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e) - It's about how service workers replace background pages, why declarativeNetRequest replaces the depr...

17. [HTML5 Video - what is the maximum playback rate? - Stack Overflow](https://stackoverflow.com/questions/30970920/html5-video-what-is-the-maximum-playback-rate) - MDN HTML Media Element says that some browsers will stop playing audio outside of a playback range b...

18. [Chrome Extension issues with YouTube SPA | Asif Jalil posted on ...](https://www.linkedin.com/posts/asifjalil0_chromeextension-spa-extensiondev-activity-7323700976970870785-rCHh) - FIXED: Chrome extension SPA rendering issue If your Chrome Extension injects a UI element into a Sin...

19. [IMGLAB YouTube Immersive – User Guide – IMG LAB](https://imglab.net/en/imglab-youtube-immersive-user-guide/) - IMGLAB YouTube Immersive is a Chrome extension that works exclusively on YouTube. Install it once an...

20. [How to initialize Chrome extension `storage.local` under Manifest ...](https://stackoverflow.com/questions/71255886/how-to-initialize-chrome-extension-storage-local-under-manifest-v3-service-wor) - I want to do this in a way that the data can be accessed from content scripts and options pages unde...

21. [Any script of extension that enables scrolling with space when video ...](https://www.reddit.com/r/youtube/comments/l1t3x2/any_script_of_extension_that_enables_scrolling/) - I'd like to allow the regular pause/play when the video is in focus but when scrolling videos / comm...

22. [Youtube Interesting Method of page LOAD - javascript - Stack Overflow](https://stackoverflow.com/questions/45972104/youtube-interesting-method-of-page-load) - This is pretty typical for a Single Page Application (SPA). Using the HTML5 History API, the page sc...

23. [Throw exception when HTMLMediaElement's defaultPlaybackRate ...](https://github.com/whatwg/html/issues/2754) - Setting a video's defaultPlaybackRate or playbackRate to a negative value does not have uniform beha...

24. [Content script running MutationObserver conflicting with YouTube](https://stackoverflow.com/questions/61732313/content-script-running-mutationobserver-conflicting-with-youtube) - The most likely reason is an infinite loop due to a missed check in the observer listener so it proc...

25. [Super Video Speed Controller Extension for Chrome & Edge](https://super-video-speed-controller.com) - Control video speed for any video players. 100% free, Highly accurate, Keyboard shortcuts. Super Vid...

