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
      this._attached = false;

      this._onKeyDown = this._onKeyDown.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this._onWheel = this._onWheel.bind(this);
    }

    attach() {
      if (this._attached) return;
      this._attached = true;
      document.addEventListener('keydown', this._onKeyDown, { capture: true });
      document.addEventListener('keyup', this._onKeyUp, { capture: true });
      window.addEventListener('wheel', this._onWheel, { passive: false });
    }

    detach() {
      if (!this._attached) return;
      this._attached = false;
      document.removeEventListener('keydown', this._onKeyDown, true);
      document.removeEventListener('keyup', this._onKeyUp, true);
      window.removeEventListener('wheel', this._onWheel);

      // Clean up state in case space was held when detaching
      if (this.spaceHeld) {
        this.spaceHeld = false;
        this.sc.deactivateTurbo();
      }
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
        this.spaceHeld = true;
        this.scrolledDuringHold = false;
        const speed = this.sc.activateTurbo();
        this.vm.applySpeed(speed);
      }
    }

    _onKeyUp(e) {
      if (e.code !== 'Space') return;
      if (!this.spaceHeld) return;

      e.preventDefault();
      e.stopPropagation();

      this.spaceHeld = false;

      if (this.scrolledDuringHold) {
        // User adjusted speed via scroll — keep the new speed, cancel turbo revert
        this.sc.isTurboActive = false;
      } else {
        // Pure spacebar hold — revert to previous speed
        const speed = this.sc.deactivateTurbo();
        this.vm.applySpeed(speed);
      }
    }

    _onWheel(e) {
      if (!this.spaceHeld) return;

      e.preventDefault();
      e.stopPropagation();

      this.scrolledDuringHold = true;

      // On first scroll during hold, revert turbo so adjustments start from the
      // user's base speed rather than the turbo speed.
      if (this.sc.isTurboActive) {
        this.sc.currentSpeed = this.sc.previousSpeed;
        this.sc.isTurboActive = false;
      }

      const speed = this.sc.adjustByScroll(e.deltaY);
      this.vm.applySpeed(speed);
    }
  }

  USC.InputController = InputController;
})();
