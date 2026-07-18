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
      this.videoBadges = new WeakMap();
      this.videoSkipBadges = new WeakMap();
      this.lastInteractedVideo = null;
      this.observer = null;
      this.showBadge = options.showBadge !== false;
      this.badgePosition = options.badgePosition || 'top-left';
      this.videoStates = new WeakMap();
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
          this.videoSpeeds.set(video, speed);
        } catch (_) {
          if (!video.isConnected) toRemove.push(video);
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
        if (!video.isConnected) {
          this.videos.delete(video);
        }
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
      const rescan = () => {
        document.querySelectorAll('.usc-speed-badge').forEach(b => b.remove());
        this.videos.clear();
        this._scanForVideos();
      };

      window.addEventListener('yt-navigate-finish', rescan);
      window.addEventListener('popstate', () => setTimeout(() => this._scanForVideos(), 800));
      window.addEventListener('hashchange', () => setTimeout(() => this._scanForVideos(), 800));
    }

    _injectOverlay(video) {
      const badge = document.createElement('div');
      badge.className = 'usc-speed-badge';
      badge.textContent = '1.00×';

      this._applyBadgePosition(badge);

      const uid = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      badge.dataset.videoId = uid;

      this.videoBadges.set(video, badge);

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
      if (!video) return;
      const badge = this.videoBadges.get(video);
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
      this.videoBadges = new WeakMap();
      this.videoSkipBadges = new WeakMap();
      this.videoStates = new WeakMap();
      document.querySelectorAll('.usc-skip-badge').forEach(b => b.remove());
    }

    _getVideoState(video) {
      if (!this.videoStates.has(video)) {
        this.videoStates.set(video, { zoom: 1, brightness: 1, audioContext: null, gainNode: null, boosted: false });
      }
      return this.videoStates.get(video);
    }

    _applyVisuals(video) {
      const state = this._getVideoState(video);
      let filter = '';
      let transform = '';
      if (state.brightness !== 1) filter += `brightness(${state.brightness}) `;
      if (state.zoom !== 1) transform += `scale(${state.zoom}) `;
      video.style.filter = filter.trim();
      video.style.transform = transform.trim();
    }

    togglePlayPause(video) {
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }

    toggleMute(video) {
      if (!video) return;
      video.muted = !video.muted;
    }

    changeVolume(video, delta) {
      if (!video) return;
      let newVolume = video.volume + delta;
      newVolume = Math.max(0, Math.min(1, newVolume));
      video.volume = newVolume;
    }

    toggleLoop(video) {
      if (!video) return;
      video.loop = !video.loop;
    }

    seek(video, delta) {
      if (!video) return;
      video.currentTime += delta;
      this._showSkipAnimation(video, delta);
    }

    _showSkipAnimation(video, delta) {
      if (!video) return;
      let badge = this.videoSkipBadges.get(video);
      
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'usc-skip-badge';
        this.videoSkipBadges.set(video, badge);
      }
      
      const parent = video.parentElement;
      if (parent && badge.parentElement !== parent) {
        if (!parent.style.position || parent.style.position === 'static') {
          parent.style.position = 'relative';
        }
        parent.appendChild(badge);
      }
      
      if (delta > 0) {
        badge.classList.remove('usc-skip-left');
        badge.classList.add('usc-skip-right');
      } else {
        badge.classList.remove('usc-skip-right');
        badge.classList.add('usc-skip-left');
      }
      
      const sign = delta > 0 ? '+' : '';
      badge.textContent = `${sign}${delta}s`;
      
      badge.classList.remove('usc-animate');
      void badge.offsetWidth; // trigger reflow
      badge.classList.add('usc-animate');
      
      if (badge._timeoutId) clearTimeout(badge._timeoutId);
      badge._timeoutId = setTimeout(() => {
        badge.classList.remove('usc-animate');
      }, 500);
    }

    seekToPercentage(video, percent) {
      if (!video || !video.duration || !isFinite(video.duration)) return;
      video.currentTime = (percent / 100) * video.duration;
    }

    cycleZoom(video) {
      if (!video) return;
      const state = this._getVideoState(video);
      const levels = [1, 1.25, 1.5, 2, 2.5, 3];
      let idx = levels.indexOf(state.zoom);
      state.zoom = levels[(idx + 1) % levels.length];
      this._applyVisuals(video);
    }

    cycleBrightness(video) {
      if (!video) return;
      const state = this._getVideoState(video);
      const levels = [1, 1.5, 2, 0.5];
      let idx = levels.indexOf(state.brightness);
      state.brightness = levels[(idx + 1) % levels.length];
      this._applyVisuals(video);
    }

    async togglePiP(video) {
      if (!video) return;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      } else {
        await video.requestPictureInPicture().catch(() => {});
      }
    }

    async toggleFullscreen(video) {
      if (!video) return;
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      } else {
        await video.requestFullscreen().catch(() => {});
      }
    }

    triggerSiteSpecific(action, video) {
      const selectors = {
        theater: ['.ytp-size-button'],
        miniplayer: ['.ytp-miniplayer-button'],
        next: ['.ytp-next-button', '.vjs-next-button', '[class*="next" i]', '[id*="next" i]', 'a[rel="next" i]'],
        prev: ['.ytp-prev-button', '.vjs-prev-button', '[class*="prev" i]', '[id*="prev" i]', 'a[rel="prev" i]']
      };
      
      const targetSelectors = selectors[action];
      if (targetSelectors) {
        for (const sel of targetSelectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return true;
          }
        }
      }

      // Generic fallback for any HTML5 video
      if (action === 'theater') {
        this.toggleGenericTheaterMode(video);
        return true;
      }
      if (action === 'miniplayer') {
        this.toggleGenericMiniPlayer(video);
        return true;
      }

      return false;
    }

    toggleGenericTheaterMode(video) {
       if (!video) return;
       if (video.classList.contains('usc-generic-theater')) {
           video.classList.remove('usc-generic-theater');
       } else {
           video.classList.remove('usc-generic-miniplayer');
           video.classList.add('usc-generic-theater');
       }
    }

    toggleGenericMiniPlayer(video) {
       if (!video) return;
       if (video.classList.contains('usc-generic-miniplayer')) {
           video.classList.remove('usc-generic-miniplayer');
       } else {
           video.classList.remove('usc-generic-theater');
           video.classList.add('usc-generic-miniplayer');
       }
    }

    takeScreenshot(video) {
      if (!video) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = `screenshot_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }

    toggleAudioBoost(video) {
      if (!video) return;
      const state = this._getVideoState(video);
      try {
        if (!state.audioContext) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          state.audioContext = new AudioContext();
          const source = state.audioContext.createMediaElementSource(video);
          state.gainNode = state.audioContext.createGain();
          source.connect(state.gainNode);
          state.gainNode.connect(state.audioContext.destination);
        }
        
        state.boosted = !state.boosted;
        state.gainNode.gain.value = state.boosted ? 2.0 : 1.0;
        
        if (state.audioContext.state === 'suspended') {
          state.audioContext.resume();
        }
      } catch (e) {
        console.warn('Audio boost failed, might be due to CORS:', e);
      }
    }
  }

  USC.VideoManager = VideoManager;
})();
