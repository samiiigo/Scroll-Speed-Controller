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

      if (this.spaceHeld) {
        this._restoreFromSpaceHold();
      }
    }

    _restoreFromSpaceHold() {
      const video = this.holdVideo;
      const scrolled = this.scrolledDuringHold;
      const baseSpeed = this.holdBaseSpeed;

      this.spaceHeld = false;
      this.scrolledDuringHold = false;
      this.holdVideo = null;
      this.holdBaseSpeed = 1.0;
      this.sc.isTurboActive = false;

      if (!video) return;

      if (scrolled) {
        // User scrolled to a specific speed — it was already remembered by the
        // wheel handler, so just sync the controller state.
        this.sc.currentSpeed = this.vm.getRememberedSpeed(video);
      } else {
        // Pure turbo hold (no scroll) — restore the video's pre-turbo speed.
        this.sc.currentSpeed = baseSpeed;
        this.vm.applySpeedToVideo(video, baseSpeed, { remember: true });
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
      if (e.code !== 'Space') return;
      if (this._isTyping()) return;

      e.preventDefault();
      e.stopPropagation();

      if (!this.spaceHeld) {
        const video = this._pickTargetVideo(e);
        if (!video) return;

        this.spaceHeld = true;
        this.scrolledDuringHold = false;
        this.holdVideo = video;
        this.holdBaseSpeed = this.vm.getRememberedSpeed(video);
        this.sc.currentSpeed = this.holdBaseSpeed;
        this.sc.activateTurbo();
        this.vm.applySpeedToVideo(video, this.sc.TURBO_SPEED, { remember: false });
      }
    }

    _onKeyUp(e) {
      if (e.code !== 'Space') return;
      if (!this.spaceHeld) return;

      e.preventDefault();
      e.stopPropagation();

      // Space keyup is the authoritative restore event.
      this._restoreFromSpaceHold();
    }

    _onWheel(e) {
      if (!this.spaceHeld) return;

      e.preventDefault();
      e.stopPropagation();

      const video = this._pickTargetVideo(e) || this.holdVideo;
      if (!video) return;

      if (this.holdVideo && this.holdVideo !== video) {
        const priorSpeed = this.vm.getRememberedSpeed(this.holdVideo);
        this.vm.applySpeedToVideo(this.holdVideo, priorSpeed, { remember: true });
        this.holdBaseSpeed = this.vm.getRememberedSpeed(video);
      }
      this.holdVideo = video;

      this.scrolledDuringHold = true;

      // On first scroll during hold, revert turbo so adjustments start from the
      // user's base speed rather than the turbo speed.
      if (this.sc.isTurboActive) {
        this.sc.currentSpeed = this.holdBaseSpeed;
        this.sc.isTurboActive = false;
      }

      const speed = this.sc.adjustByScroll(e.deltaY);
      this.vm.applySpeedToVideo(video, speed, { remember: true });
    }

    _onBlur() {
      if (!this.spaceHeld) return;
      this._restoreFromSpaceHold();
    }

    _onVisibilityChange() {
      if (!this.spaceHeld) return;
      if (document.visibilityState === 'hidden') {
        this._restoreFromSpaceHold();
      }
    }

    _onMouseMove(e) {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      const video = this.vm.getVideoAtPoint(this.pointerX, this.pointerY);
      if (video) this.hoveredVideo = video;
    }
  }

  USC.InputController = InputController;
})();
