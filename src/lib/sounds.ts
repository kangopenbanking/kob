// Lightweight button interaction sounds using Web Audio API
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.08) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

export const sounds = {
  tap: () => playTone(800, 0.08, 'sine', 0.06),
  success: () => {
    playTone(523, 0.12, 'sine', 0.07);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.07), 80);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.07), 160);
  },
  error: () => playTone(200, 0.2, 'square', 0.05),
  navigate: () => playTone(600, 0.06, 'sine', 0.04),
  confirm: () => {
    playTone(440, 0.1, 'sine', 0.06);
    setTimeout(() => playTone(660, 0.15, 'sine', 0.06), 100);
  },
};
