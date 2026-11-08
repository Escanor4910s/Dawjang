// Premium Web Audio API synthesizer for luxury UI haptic sound effects
class AudioEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  playClick() {
    this.playSoftClick();
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

  // Alias for backward compatibility — most call sites use playSuccess()
  playSuccess() {
    this.playSuccessChime();
  }

  // Soft pop sound for toggles (e.g., ThemeToggle)
  playToggle() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {
      console.warn("Failed to play toggle sound.", e);
    }
  }

  // Bright, short ping for notifications opening
  playNotificationPing() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.02); // A6

      gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Failed to play notification ping.", e);
    }
  }

  // Deep, muffled thud for errors
  playError() {
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'square';
      osc.frequency.setValueAtTime(100, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {
      console.warn("Failed to play error sound.", e);
    }
  }

  // ----------------------------------------------------
  // ADVANCED BINAURAL BEATS FOR FLOW STATE
  // ----------------------------------------------------
  private binauralNodes: {
    oscL: OscillatorNode;
    oscR: OscillatorNode;
    gainL: GainNode;
    gainR: GainNode;
  } | null = null;

  startBinauralBeats() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.binauralNodes) return; // Already running

      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();

      oscL.type = 'sine';
      oscR.type = 'sine';

      // 10Hz Binaural delta/alpha focus gap (200Hz Left / 210Hz Right)
      oscL.frequency.setValueAtTime(200, this.ctx.currentTime);
      oscR.frequency.setValueAtTime(210, this.ctx.currentTime);

      // Low volume for gentle background focus
      gainL.gain.setValueAtTime(0.015, this.ctx.currentTime);
      gainR.gain.setValueAtTime(0.015, this.ctx.currentTime);

      // Panning left and right channel safely
      if (this.ctx.createStereoPanner) {
        const panL = this.ctx.createStereoPanner();
        panL.pan.setValueAtTime(-1, this.ctx.currentTime);
        const panR = this.ctx.createStereoPanner();
        panR.pan.setValueAtTime(1, this.ctx.currentTime);

        oscL.connect(gainL);
        gainL.connect(panL);
        panL.connect(this.ctx.destination);

        oscR.connect(gainR);
        gainR.connect(panR);
        panR.connect(this.ctx.destination);
      } else {
        // Fallback for mono compatibility
        oscL.connect(gainL).connect(this.ctx.destination);
        oscR.connect(gainR).connect(this.ctx.destination);
      }

      oscL.start();
      oscR.start();

      this.binauralNodes = { oscL, oscR, gainL, gainR };
    } catch (e) {
      console.warn("Failed to initiate Binaural Beats.", e);
    }
  }

  stopBinauralBeats() {
    if (!this.binauralNodes) return;
    try {
      this.binauralNodes.oscL.stop();
      this.binauralNodes.oscR.stop();
    } catch (e) {
      console.warn("Error stopping binaural beats", e);
    }
    this.binauralNodes = null;
  }

  // ----------------------------------------------------
  // IMMERSIVE HEARTBEAT LOOP FOR HIGH PRESSURE ECOS
  // ----------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private heartbeatInterval: any = null;

  startHeartbeatLoop(bpm: number, onBeat?: () => void) {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    const playBeat = () => {
      try {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        
        // --- Lub (Sys) ---
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.connect(gain1).connect(this.ctx.destination);
        osc1.frequency.setValueAtTime(55, now);
        osc1.frequency.exponentialRampToValueAtTime(10, now + 0.1);
        gain1.gain.setValueAtTime(0.35, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc1.start(now);
        osc1.stop(now + 0.12);

        // --- Dub (Dia) ---
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.connect(gain2).connect(this.ctx.destination);
        osc2.frequency.setValueAtTime(45, now + 0.15);
        osc2.frequency.exponentialRampToValueAtTime(10, now + 0.28);
        gain2.gain.setValueAtTime(0.25, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.3);

        if (onBeat) onBeat();
      } catch (e) {
        console.warn("Heartbeat loop error", e);
      }
    };

    // First beat triggers instantly
    playBeat();

    const intervalMs = (60 / bpm) * 1000;
    this.heartbeatInterval = setInterval(playBeat, intervalMs);
  }

  stopHeartbeatLoop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const uiAudio = new AudioEffects();
