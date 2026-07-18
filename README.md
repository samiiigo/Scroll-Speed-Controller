# Universal Video Speed Controller

**Control how fast any web video plays—without digging through player menus.**

This Chrome extension adds a simple gesture: hold **Space**, use your **mouse wheel** to speed up or slow down, and let go when you’re done. You can also jump straight to a faster “turbo” speed the moment you press Space, then fine-tune with the wheel while you hold it. 

We've recently added a huge set of keyboard shortcuts and new functionalities to give you complete control over your viewing experience on almost any website.

---

## Why use it

- **Stay in the flow** — Adjust speed while you watch, without clicking through settings on every site.
- **Works almost everywhere** — Streaming sites, social feeds, and embedded players that use the browser’s standard video (YouTube, Reddit, X, Twitch, and many others). Includes robust support for Single Page Applications (SPAs).
- **Your shortcuts** — Pick how big each scroll “step” is and how fast “turbo” should be.
- **Optional on-screen label** — See the current speed on the video corner you choose, or turn it off for a minimal look.
- **Turn it off per site** — If you don’t want it on a specific site, add that site to a blacklist in settings.
- **Deep detection** — Seamlessly finds videos deeply nested in modern web components (Shadow DOM).
- **Accessible** — Fully supports screen readers with ARIA live announcements for speed changes.
- **Lightweight & Fast** — Loads instantly at document start and runs with minimal permissions.

---

## Features & Keyboard Shortcuts

The extension significantly supercharges video players by adding a standardized set of hotkeys across all sites:

### Playback & Speed Controls
- **Space (Short Press):** Play or pause the video.
- **Space (Long Press):** Jump to your "turbo" speed (e.g., 2.0x).
- **Space + Scroll:** Fine-tune playback speed. Scroll up to go faster, down to go slower. Releasing Space returns to 1.0x.
- **Shift + `,` / `.`**: Step speed down/up.
- **R:** Reset speed back to normal (1.0x).
- **K:** Play or pause the video.

### Navigation & Seeking
- **J / L:** Seek backward or forward by 10 seconds.
- **Arrow Left / Right:** Seek backward or forward by 5 seconds (with visual skip animation!).
- **0-9:** Seek to a specific percentage of the video (e.g., `0` for 0%, `5` for 50%, `9` for 90%). Numpad is also supported. Safely ignores livestreams.
- **Home / End:** Jump to the start (0%) or end (100%) of the video.
- **Shift + Scroll:** Fine-seeking (1 second steps).
- **Alt + Scroll:** Scrubbing (5 second steps).
- **Shift + N / P:** Jump to the Next or Previous video (works on supported sites).

### Volume & Visuals
- **Arrow Up / Down:** Increase or decrease volume by 5%.
- **M:** Toggle mute on/off.
- **F / Double Click:** Toggle Fullscreen (double-clicking must be directly on the video).
- **P:** Toggle Picture-in-Picture mode.
- **T:** Toggle Theater mode.
- **I:** Toggle Miniplayer.
- **Z:** Cycle through Zoom levels (1x up to 3x) to crop out black bars or focus on details.
- **B:** Cycle through Brightness levels (up to 2x or down to 0.5x).
- **O:** Toggle video Loop.
- **S:** Take a screenshot of the current video frame (saves as PNG).

*(Note: When you’re typing in a search box, comment field, or form—including custom web elements using `role="textbox"` or `combobox`—all shortcuts are automatically disabled so they don't interfere with your typing.)*

### Under the Hood Enhancements
- **Shadow DOM Support:** Deeply nested videos inside modern Web Components and Shadow DOMs are fully detected and controllable.
- **Accessibility:** Screen reader announcements via `aria-live` automatically call out speed adjustments as you make them.
- **SPA Resilience:** Enhanced polling for Single Page Applications guarantees that dynamically loaded videos and "soft navigations" are handled flawlessly without leaving "ghost" overlays.

---

## From the toolbar

Click the extension icon to open a small panel where you can:

- See the **current speed**
- Turn the extension **on or off**
- Jump to **presets** (like half speed, normal, one-and-a-half, double)
- Tweak **turbo speed** and **scroll step** for quick changes
- **Reset** speed in one click

---

## More settings

Open the extension’s **options** page for extras: finer control of turbo and scroll step, whether to show the speed label and where it sits, optional reset when you navigate between videos on sites that load new clips without a full page reload, and the **site blacklist** for places you want left alone.

---

## Privacy

Your preferences are saved in Chrome and can sync if you use Chrome sync. The extension isn’t built to collect analytics or send your viewing data anywhere—it’s about controlling playback speed on the page you’re already watching.

---

## Install

If you’re installing from this project: open Chrome’s Extensions page, turn on **Developer mode**, choose **Load unpacked**, and select the folder that contains this project.

When the extension is listed on the Chrome Web Store, that will be the easiest way for most people to install it.
