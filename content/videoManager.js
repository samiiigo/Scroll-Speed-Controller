/**
 * VideoManager — detects <video> elements, injects speed overlays,
 * and handles SPA navigation via MutationObserver + history.pushState.
 */
(function () {
  'use strict';

  const USC = window.USC = window.USC || {};

  class VideoManager {
    constructor(options = {}) {
      this.videos = new Set();
      this.videoSpeeds = new WeakMap();
      this.lastInteractedVideo = null;
      this.observer = null;
      this.showBadge = options.showBadge !== false;
      this.badgePosition = options.badgePosition || 'top-left';
    }

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
      this.videoSpeeds.set(video, 1.0);
      try {
        video.playbackRate = 1.0;
      } catch (_) {}
      if (this.showBadge) this._injectOverlay(video);
      this._updateOverlayForVideo(video, 1.0);
    }

    applySpeed(speed) {
      const toRemove = [];
      this.videos.forEach(video => {
        try {
          video.playbackRate = speed;
        } catch (_) {
          toRemove.push(video);
        }
      });
      toRemove.forEach(v => this.videos.delete(v));
      this._updateAllOverlays(speed);

      try {
        chrome.runtime.sendMessage({ type: 'SPEED_CHANGED', speed });
      } catch (_) {
        // Extension context may be invalidated on hot-reload
      }
    }

    applySpeedToVideo(video, speed, options = {}) {
      if (!video || !this.videos.has(video)) return;
      const { remember = true } = options;
      try {
        video.playbackRate = speed;
      } catch (_) {
        this.videos.delete(video);
        return;
      }
      if (remember) this.videoSpeeds.set(video, speed);
      this.lastInteractedVideo = video;
      this._updateOverlayForVideo(video, speed);
      try {
        chrome.runtime.sendMessage({ type: 'SPEED_CHANGED', speed });
      } catch (_) {}
    }

    getRememberedSpeed(video) {
      if (!video) return 1.0;
      const remembered = this.videoSpeeds.get(video);
      return remembered == null ? 1.0 : remembered;
    }

    getPrimaryVideo() {
      for (const video of this.videos) return video;
      return null;
    }

    getActiveVideoOrFirst() {
      if (this.lastInteractedVideo && this.videos.has(this.lastInteractedVideo)) {
        return this.lastInteractedVideo;
      }
      return this.getPrimaryVideo();
    }

    getVideoAtPoint(x, y) {
      if (typeof x !== 'number' || typeof y !== 'number') return null;
      const node = document.elementFromPoint(x, y);
      if (!node) return null;
      if (node.nodeName === 'VIDEO') return this.videos.has(node) ? node : null;
      if (node.closest) {
        const video = node.closest('video');
        if (video && this.videos.has(video)) return video;
      }
      return null;
    }

    _startMutationObserver() {
      if (!document.body) return;
      this.observer = new MutationObserver(mutations => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeName === 'VIDEO') this._attachVideo(node);
            if (node.querySelectorAll) {
              node.querySelectorAll('video').forEach(v => this._attachVideo(v));
            }
          }
        }
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    }

    _handleSPANavigation() {
      // YouTube fires a custom event on SPA navigation
      window.addEventListener('yt-navigate-finish', () => {
        document.querySelectorAll('.usc-speed-badge').forEach(b => b.remove());
        this.videos.clear();
        this._scanForVideos();
      });

      // Generic SPA fallback via History API
      const original = history.pushState.bind(history);
      history.pushState = (...args) => {
        original(...args);
        setTimeout(() => this._scanForVideos(), 800);
      };
    }

    _injectOverlay(video) {
      const badge = document.createElement('div');
      badge.className = 'usc-speed-badge';
      badge.textContent = '1.00×';

      this._applyBadgePosition(badge);

      const uid = Math.random().toString(36).slice(2);
      badge.dataset.videoId = uid;
      video.dataset.uscId = uid;

      const parent = video.parentElement;
      if (parent) {
        if (!parent.style.position || parent.style.position === 'static') {
          parent.style.position = 'relative';
        }
        parent.appendChild(badge);
      }
    }

    _applyBadgePosition(badge) {
      badge.style.top = badge.style.bottom = badge.style.left = badge.style.right = '';
      switch (this.badgePosition) {
        case 'top-right':
          badge.style.top = '12px'; badge.style.right = '12px'; break;
        case 'bottom-left':
          badge.style.bottom = '12px'; badge.style.left = '12px'; break;
        case 'bottom-right':
          badge.style.bottom = '12px'; badge.style.right = '12px'; break;
        default: // top-left
          badge.style.top = '12px'; badge.style.left = '12px'; break;
      }
    }

    _updateAllOverlays(speed) {
      const badges = document.querySelectorAll('.usc-speed-badge');
      badges.forEach(badge => {
        badge.textContent = `${speed.toFixed(2)}×`;

        if (speed !== 1.0) {
          badge.dataset.active = 'true';
          badge.classList.add('usc-flash');
          setTimeout(() => badge.classList.remove('usc-flash'), 400);
        } else {
          badge.dataset.active = 'false';
          badge.classList.remove('usc-flash');
        }
      });
    }

    _updateOverlayForVideo(video, speed) {
      const id = video?.dataset?.uscId;
      if (!id) return;
      const badge = document.querySelector(`.usc-speed-badge[data-video-id="${id}"]`);
      if (!badge) return;
      badge.textContent = `${speed.toFixed(2)}×`;
      if (speed !== 1.0) {
        badge.dataset.active = 'true';
        badge.classList.add('usc-flash');
        setTimeout(() => badge.classList.remove('usc-flash'), 400);
      } else {
        badge.dataset.active = 'false';
        badge.classList.remove('usc-flash');
      }
    }

    updateBadgeVisibility(show) {
      this.showBadge = show;
      if (!show) {
        document.querySelectorAll('.usc-speed-badge').forEach(b => b.remove());
      }
    }

    destroy() {
      if (this.observer) this.observer.disconnect();
      document.querySelectorAll('.usc-speed-badge').forEach(b => b.remove());
      this.videos.clear();
      this.lastInteractedVideo = null;
      this.videoSpeeds = new WeakMap();
    }
  }

  USC.VideoManager = VideoManager;
})();
