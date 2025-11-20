
import { BossType } from "./types";

// Simple Web Audio API Synthesizer
let audioCtx: AudioContext | null = null;
let musicOscillators: OscillatorNode[] = [];
let musicGain: GainNode | null = null;
let isMusicPlaying = false;

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const createOscillator = (type: OscillatorType, freq: number, duration: number, vol: number = 0.1) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

const createNoise = (duration: number, vol: number = 0.2) => {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    
    // Simple Lowpass to make it sound like an explosion
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noise.start();
};

export const playSound = (type: 'shoot' | 'explosion' | 'powerup' | 'damage' | 'gate' | 'boss_spawn' | 'beam' | 'collect' | 'glitch' | 'coin') => {
  if (!audioCtx) return;

  switch (type) {
    case 'shoot':
      createOscillator('square', 400 + Math.random() * 200, 0.1, 0.05);
      break;
    case 'explosion':
      createNoise(0.3, 0.3);
      break;
    case 'damage':
      createOscillator('sawtooth', 100, 0.1, 0.1);
      break;
    case 'powerup':
      createOscillator('sine', 600, 0.1, 0.1);
      setTimeout(() => createOscillator('sine', 800, 0.2, 0.1), 50);
      break;
    case 'collect':
      createOscillator('sine', 1200, 0.1, 0.1);
      break;
    case 'gate':
      createOscillator('triangle', 440, 0.3, 0.1);
      createOscillator('triangle', 554, 0.3, 0.1);
      createOscillator('triangle', 659, 0.3, 0.1);
      break;
    case 'boss_spawn':
      createOscillator('sawtooth', 150, 1.0, 0.2);
      createOscillator('sawtooth', 100, 1.0, 0.2);
      break;
    case 'beam':
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 2);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 2);
      break;
    case 'glitch':
      createOscillator('sawtooth', 800, 0.1, 0.1);
      createOscillator('square', 1200, 0.05, 0.1);
      setTimeout(() => createOscillator('sawtooth', 50, 0.2, 0.2), 50);
      break;
    case 'coin':
      createOscillator('sine', 1500, 0.1, 0.1);
      setTimeout(() => createOscillator('sine', 2000, 0.3, 0.1), 50);
      break;
  }
};

export const startBossMusic = (bossType: BossType) => {
    if (!audioCtx || isMusicPlaying) return;
    isMusicPlaying = true;
    
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.1;
    musicGain.connect(audioCtx.destination);
    
    if (bossType === BossType.SIEGE_BREAKER) {
        // INDUSTRIAL / HEAVY
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 60;
        osc.connect(musicGain);
        osc.start();
        
        const lfo = audioCtx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 4; 
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune); 
        lfo.start();
        musicOscillators.push(osc, lfo);

    } else if (bossType === BossType.THE_ALGORITHM) {
        // TECHNO / GLITCH
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 110;
        osc.connect(musicGain);
        osc.start();
        
        const arp = audioCtx.createOscillator();
        arp.type = 'square';
        arp.frequency.value = 8; 
        const arpGain = audioCtx.createGain();
        arpGain.gain.value = 1000;
        arp.connect(arpGain);
        arpGain.connect(osc.frequency);
        arp.start();
        musicOscillators.push(osc, arp);

    } else if (bossType === BossType.THE_MONETIZER) {
        // CASINO / JAZZ-ISH
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 150;
        osc.connect(musicGain);
        osc.start();
        
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 2; 
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        musicOscillators.push(osc, lfo);
    }
};

export const stopMusic = () => {
    musicOscillators.forEach(o => o.stop());
    musicOscillators = [];
    if (musicGain) musicGain.disconnect();
    isMusicPlaying = false;
};
