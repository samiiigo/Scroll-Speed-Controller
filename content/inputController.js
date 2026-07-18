/**
 * InputController — captures Spacebar + Scroll combo.
 * - Spacebar hold alone → turbo speed.
 * - Spacebar + scroll → fine-grained speed adjustment.
 * - Ignores input when user is typing in a form field.
 */
(function () {
  'use strict';

  const USC = window.USC = window.USC || {};

  class InputController {
    constructor(speedController, videoManager) {
      this.sc = speedController;
      this.vm = videoManager;
      this.spaceHeld = false;
      this.scrolledDuringHold = false;
      this.holdVideo = null;
      this.holdBaseSpeed = 1.0;
      this.longPressTimeout = null;
      this.pointerX = null;
      this.pointerY = null;
      this.hoveredVideo = null;
      this._attached = false;

      this._onKeyDown = this._onKeyDown.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this._onWheel = this._onWheel.bind(this);
      this._onBlur = this._onBlur.bind(this);
      this._onVisibilityChange = this._onVisibilityChange.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onDoubleClick = this._onDoubleClick.bind(this);
    }

    attach() {
      if (this._attached) return;
      this._attached = true;
      document.addEventListener('keydown', this._onKeyDown, { capture: true });
      document.addEventListener('keyup', this._onKeyUp, { capture: true });
      window.addEventListener('wheel', this._onWheel, { passive: false });
      window.addEventListener('blur', this._onBlur);
      document.addEventListener('visibilitychange', this._onVisibilityChange);
      document.addEventListener('mousemove', this._onMouseMove, { capture: true });
      document.addEventListener('dblclick', this._onDoubleClick); // Bubble phase fallback
    }

    detach() {
      if (!this._attached) return;
      this._attached = false;
      document.removeEventListener('keydown', this._onKeyDown, true);
      document.removeEventListener('keyup', this._onKeyUp, true);
      window.removeEventListener('wheel', this._onWheel);
      window.removeEventListener('blur', this._onBlur);
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      document.removeEventListener('mousemove', this._onMouseMove, true);
      document.removeEventListener('dblclick', this._onDoubleClick);

      if (this.longPressTimeout) {
        clearTimeout(this.longPressTimeout);
        this.longPressTimeout = null;
      }

      if (this.spaceHeld) {
        this._restoreFromSpaceHold();
      }
    }

    _restoreFromSpaceHold() {
      const video = this.holdVideo;

      this.spaceHeld = false;
      this.scrolledDuringHold = false;
      this.holdVideo = null;
      this.holdBaseSpeed = 1.0;
      if (this.longPressTimeout) {
        clearTimeout(this.longPressTimeout);
        this.longPressTimeout = null;
      }

      this.sc.reset();

      if (video) {
        this.vm.applySpeedToVideo(video, 1.0, { remember: true });
      }
    }

    _pickTargetVideo(e) {
      const fromEvent = this.vm.getVideoAtPoint(e?.clientX, e?.clientY);
      if (fromEvent) return fromEvent;
      if (this.hoveredVideo && this.vm.videos.has(this.hoveredVideo)) return this.hoveredVideo;
      return this.vm.getActiveVideoOrFirst();
    }

    _isTyping() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return el.isContentEditable;
    }

    _onKeyDown(e) {
      if (this._isTyping()) return;

      // Ignore shortcuts with Ctrl, Alt, or Meta (Command) so we don't break browser defaults like Ctrl+R
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();

        if (e.repeat) return; // Ignore repeated keydowns when held

        if (!this.spaceHeld && !this.longPressTimeout) {
          const video = this._pickTargetVideo(e);
          if (!video) return;

          this.holdVideo = video;

          this.longPressTimeout = setTimeout(() => {
            this.longPressTimeout = null;
            this.spaceHeld = true;
            this.scrolledDuringHold = false;
            this.holdBaseSpeed = this.vm.getRememberedSpeed(this.holdVideo);
            this.sc.currentSpeed = this.holdBaseSpeed;
            this.sc.activateTurbo();
            this.vm.applySpeedToVideo(this.holdVideo, this.sc.TURBO_SPEED, { remember: false });
          }, 250);
        }
        return;
      }

      if (e.repeat) return;

      const video = this._pickTargetVideo(e);
      if (!video) return;
      let handled = true;

      switch(e.code) {
        case 'KeyK': this.vm.togglePlayPause(video); break;
        case 'KeyJ': this.vm.seek(video, -10); break;
        case 'KeyL': this.vm.seek(video, 10); break;
        case 'KeyF': this.vm.toggleFullscreen(video); break;
        case 'KeyM': this.vm.toggleMute(video); break;
        case 'KeyR':
          this.sc.reset();
          this.vm.applySpeedToVideo(video, 1.0, { remember: true });
          break;
        case 'KeyZ': this.vm.cycleZoom(video); break;
        case 'KeyB': this.vm.cycleBrightness(video); break;
        case 'KeyO': this.vm.toggleLoop(video); break;
        case 'KeyP':
          if (e.shiftKey) {
            handled = this.vm.triggerSiteSpecific('prev', video);
          } else {
            this.vm.togglePiP(video);
          }
          break;
        case 'KeyT':
          handled = this.vm.triggerSiteSpecific('theater', video);
          break;
        case 'KeyI':
          handled = this.vm.triggerSiteSpecific('miniplayer', video);
          break;
        case 'KeyN':
          if (e.shiftKey) {
            handled = this.vm.triggerSiteSpecific('next', video);
          } else {
            handled = false;
          }
          break;
        case 'KeyS': this.vm.takeScreenshot(video); break;
        case 'KeyA': this.vm.toggleAudioBoost(video); break;
        case 'ArrowLeft': this.vm.seek(video, -5); break;
        case 'ArrowRight': this.vm.seek(video, 5); break;
        case 'ArrowUp': this.vm.changeVolume(video, 0.05); break;
        case 'ArrowDown': this.vm.changeVolume(video, -0.05); break;
        case 'Home': this.vm.seekToPercentage(video, 0); break;
        case 'End': this.vm.seekToPercentage(video, 100); break;
        case 'Comma':
          if (e.shiftKey) {
            this.sc.currentSpeed = video.playbackRate;
            const speed = this.sc.stepSpeed(-1);
            this.vm.applySpeedToVideo(video, speed, { remember: true });
          } else {
            handled = false;
          }
          break;
        case 'Period':
          if (e.shiftKey) {
            this.sc.currentSpeed = video.playbackRate;
            const speed = this.sc.stepSpeed(1);
            this.vm.applySpeedToVideo(video, speed, { remember: true });
          } else {
            handled = false;
          }
          break;
        default:
          const match = e.code.match(/^(?:Digit|Numpad)(\d)$/);
          if (match) {
            const digit = parseInt(match[1], 10);
            this.vm.seekToPercentage(video, digit * 10);
          } else {
            handled = false;
          }
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    _onKeyUp(e) {
      if (e.code !== 'Space') return;

      e.preventDefault();
      e.stopPropagation();

      if (this.longPressTimeout) {
        // Short press detected
        clearTimeout(this.longPressTimeout);
        this.longPressTimeout = null;

        if (this.holdVideo) {
          if (this.holdVideo.paused) {
            this.holdVideo.play().catch(() => { });
          } else {
            this.holdVideo.pause();
          }
          this.holdVideo = null;
        }
        return;
      }

      if (!this.spaceHeld) return;

      // Space keyup is the authoritative restore event.
      this._restoreFromSpaceHold();
    }

    _onWheel(e) {
      if (this.longPressTimeout) {
        // User scrolled during the short press window, convert immediately to spaceHeld
        clearTimeout(this.longPressTimeout);
        this.longPressTimeout = null;
        this.spaceHeld = true;
        if (!this.holdVideo) {
          this.holdVideo = this._pickTargetVideo(e);
        }
        if (this.holdVideo) {
          this.holdBaseSpeed = this.vm.getRememberedSpeed(this.holdVideo);
          this.sc.currentSpeed = this.holdBaseSpeed;
        }
      }

      const isModifierScroll = e.shiftKey || e.altKey;

      if (!this.spaceHeld && !isModifierScroll) return;

      e.preventDefault();
      e.stopPropagation();

      const video = this._pickTargetVideo(e) || this.holdVideo;
      if (!video) return;

      if (isModifierScroll) {
        // Fine seeking (Shift) or Scrubbing (Alt)
        const direction = e.deltaY > 0 ? -1 : 1;
        const delta = e.shiftKey ? 1 : 5; // 1s for shift, 5s for alt
        this.vm.seek(video, direction * delta);
        return;
      }

      if (this.holdVideo && this.holdVideo !== video) {
        this.vm.applySpeedToVideo(this.holdVideo, 1.0, { remember: true });
        this.holdBaseSpeed = this.vm.getRememberedSpeed(video);
      }
      this.holdVideo = video;

      this.scrolledDuringHold = true;

      const speed = this.sc.adjustByScroll(e.deltaY);
      this.vm.applySpeedToVideo(video, speed, { remember: true });
    }

    _onBlur() {
      if (this.longPressTimeout) {
        this._restoreFromSpaceHold();
        return;
      }
      if (!this.spaceHeld) return;
      this._restoreFromSpaceHold();
    }

    _onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (this.longPressTimeout) {
          this._restoreFromSpaceHold();
          return;
        }
        if (!this.spaceHeld) return;
        this._restoreFromSpaceHold();
      }
    }

    _onMouseMove(e) {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      const video = this.vm.getVideoAtPoint(this.pointerX, this.pointerY);
      if (video) this.hoveredVideo = video;
    }

    _onDoubleClick(e) {
      // If the event bubbled all the way here, the site probably doesn't handle it.
      const video = this._pickTargetVideo(e);
      if (!video) return;
      
      e.preventDefault();
      this.vm.toggleFullscreen(video);
    }
  }

  USC.InputController = InputController;
})();
