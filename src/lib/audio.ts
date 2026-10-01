// Web Audio API Synthesizer for high-priority partner alerts
let audioCtx: AudioContext | null = null;
let alertInterval: number | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a double chime for incoming high-priority job radar offer
 */
export function playRadarAlertTone() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.25);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.45); // A6
    gain2.gain.setValueAtTime(0.4, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.52);
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
}

/**
 * Start looping radar chime until dismissed or accepted
 */
export function startContinuousRadarAlert() {
  stopContinuousRadarAlert();
  playRadarAlertTone();
  alertInterval = window.setInterval(() => {
    playRadarAlertTone();
  }, 1400);
}

/**
 * Stop looping alert chime
 */
export function stopContinuousRadarAlert() {
  if (alertInterval !== null) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
}

/**
 * Play celebration chime for job completion
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + (idx * 0.1);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.36);
    });
  } catch (e) {
    // Graceful fallback
  }
}
