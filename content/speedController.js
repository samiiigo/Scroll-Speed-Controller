/**
 * SpeedController — core speed state machine.
 * Owns the current/previous speed values and enforces clamping.
 */
(function () {
  'use strict';

  const USC = window.USC = window.USC || {};

  const SPEED_MIN = 0.01;
  const SPEED_MAX = 5.00;

  class SpeedController {
    constructor() {
      this.currentSpeed = 1.0;
      this.previousSpeed = 1.0;
      this.isTurboActive = false;
      this.scrollStep = 0.10;
      this.TURBO_SPEED = 2.0;
    }

    clamp(value) {
      return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
    }

    /**
     * Adjust speed from a scroll event.
     * Scroll up → faster, scroll down → slower.
     */
    adjustByScroll(deltaY) {
      const direction = deltaY > 0 ? -1 : 1;
      const raw = this.currentSpeed + direction * this.scrollStep;
      this.currentSpeed = this.clamp(parseFloat(raw.toFixed(2)));
      return this.currentSpeed;
    }

    /** Spacebar keydown — jump to turbo speed. */
    activateTurbo() {
      if (this.isTurboActive) return this.currentSpeed;
      this.previousSpeed = this.currentSpeed;
      this.currentSpeed = this.TURBO_SPEED;
      this.isTurboActive = true;
      return this.TURBO_SPEED;
    }

    /** Spacebar keyup — revert to previous speed. */
    deactivateTurbo() {
      if (!this.isTurboActive) return this.currentSpeed;
      this.currentSpeed = this.previousSpeed;
      this.isTurboActive = false;
      return this.previousSpeed;
    }

    /**
     * Force-restore the speed captured before Space turbo activation.
     * Used as a robust keyup/cleanup path even if turbo was toggled off mid-hold.
     */
    restorePreviousSpeed() {
      this.currentSpeed = this.previousSpeed;
      this.isTurboActive = false;
      return this.currentSpeed;
    }

    setSpeed(speed) {
      this.currentSpeed = this.clamp(parseFloat(speed.toFixed(2)));
      if (this.isTurboActive) {
        this.previousSpeed = this.currentSpeed;
        this.isTurboActive = false;
      }
      return this.currentSpeed;
    }

    reset() {
      this.currentSpeed = 1.0;
      this.previousSpeed = 1.0;
      this.isTurboActive = false;
      return 1.0;
    }
  }

  USC.SpeedController = SpeedController;
})();
