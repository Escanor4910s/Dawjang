// Premium Web Audio API synthesizer for luxury UI haptic sound effects
class AudioEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Organic, woody low-frequency click
  playSoftClick() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine';
      // Fast exponential pitch drop to mimic solid physical feedback
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {
      console.warn("Web Audio API not allowed or failed to play soft click.", e);
    }
  }

  // Soft lowpass filtered white noise sweep mimicking a physical smooth slide
  playDrawerSlide() {
    try {
      this.init();
      if (!this.ctx) return;

      const bufferSize = this.ctx.sampleRate * 0.18; // 180ms
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Fill buffer with white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.18);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {
      console.warn("Failed to play drawer slide audio.", e);
    }
  }

  // Sparkling celestial success chime (triad chord with delayed release)
  playSuccessChime() {
    try {
      this.init();
      if (!this.ctx) return;

      const baseFrequencies = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (C-major triad chord)
      const now = this.ctx.currentTime;

      baseFrequencies.forEach((freq, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle'; // Pure, warm voice
        osc.frequency.setValueAtTime(freq, now + index * 0.04); // Staggered arpeggio entry

        // Shimmer reverb effect
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + index * 0.04 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.04 + 0.6);

        osc.start(now + index * 0.04);
        osc.stop(now + index * 0.04 + 0.65);
      });
    } catch (e) {
      console.warn("Failed to play success chime.", e);
    }
  }
}

export const uiAudio = new AudioEffects();
