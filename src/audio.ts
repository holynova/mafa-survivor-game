import { assetUrl } from './utils';

export const MIR_AUDIO_MAP: Record<string, string> = {
  fireball: '04000010.WAV',
  lightning: '040000B0.WAV',
  firewall: '04000160.WAV',
  shield: '040001F0.WAV',
  repulse: '04000081.WAV',
  hellfire: '04000090.WAV',
  bigfireball: '04000050.WAV',
  teleport: '04000150.WAV',
  explosion: '04000170.WAV',
  beam: '040000A0.WAV',
  nova: '04000180.WAV',
  holy: '04000200.WAV',
  ice: '04000210.WAV',
  charm: '04000140.WAV',
  heal: '04000020.WAV',
  poison: '04000060.WAV',
  talisman: '040000D0.WAV',
  skeleton: '04000110.WAV',
  invisible: '04000120.WAV',
  ghost: '040000E1.WAV',
  armor: '040000F1.WAV',
  trap: '04000100.WAV',
  groupHeal: '040001D0.WAV',
  beast: '040001E0.WAV',
  step: '01000001.WAV',
  attack: '01010034.WAV',
  unarmed: '01010039.WAV',
  hurt: '0103008A.WAV',
};

class SoundSystem {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private sfxVolume: number = 0.7;
  private bgmVolume: number = 0.35;
  private bgmGain: GainNode | null = null;
  private bgmNodes: { stop: () => void } | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();

  constructor() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        this.muted = localStorage.getItem('mafa_sound_muted') === 'true';
        const sfx = localStorage.getItem('mafa_sfx_volume');
        if (sfx) this.sfxVolume = Math.max(0, Math.min(1, parseFloat(sfx)));
        const bgm = localStorage.getItem('mafa_bgm_volume');
        if (bgm) this.bgmVolume = Math.max(0, Math.min(1, parseFloat(bgm)));
      } catch {
        this.muted = false;
      }
    }
  }

  private initCtx() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted() {
    return this.muted;
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  getBgmVolume() {
    return this.bgmVolume;
  }

  setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem('mafa_sfx_volume', String(this.sfxVolume));
    } catch {}
  }

  setBgmVolume(v: number) {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem('mafa_bgm_volume', String(this.bgmVolume));
    } catch {}
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.bgmVolume * 0.4, this.ctx.currentTime);
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('mafa_sound_muted', String(this.muted));
    } catch {}
    if (this.muted) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
    return this.muted;
  }

  startBgm() {
    if (this.muted || typeof window === 'undefined' || this.bgmNodes) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const masterBgm = this.ctx.createGain();
      masterBgm.gain.setValueAtTime(0, now);
      masterBgm.gain.linearRampToValueAtTime(this.bgmVolume * 0.4, now + 1.5);
      masterBgm.connect(this.ctx.destination);
      this.bgmGain = masterBgm;

      // Low drone oscillators (A1 = 55Hz, E2 = 82.4Hz)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.value = 180;
      filter.Q.value = 2.0;

      osc1.type = 'sawtooth';
      osc1.frequency.value = 55;
      osc2.type = 'triangle';
      osc2.frequency.value = 82.4;

      const oscGain = this.ctx.createGain();
      oscGain.gain.value = 0.25;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(masterBgm);

      osc1.start();
      osc2.start();

      // Atmospheric cavern wind noise
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 320;
      windFilter.Q.value = 3.0;

      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain);
      lfoGain.connect(windFilter.frequency);
      lfo.start();

      const windGain = this.ctx.createGain();
      windGain.gain.value = 0.35;

      noiseSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterBgm);

      noiseSource.start();

      this.bgmNodes = {
        stop: () => {
          try {
            osc1.stop();
            osc2.stop();
            noiseSource.stop();
            lfo.stop();
          } catch {}
        },
      };
    } catch (e) {
      console.warn('Failed to start ambient BGM:', e);
    }
  }

  stopBgm() {
    if (!this.bgmNodes || !this.ctx || !this.bgmGain) return;
    try {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
      this.bgmGain.gain.linearRampToValueAtTime(0, now + 0.8);
      const nodes = this.bgmNodes;
      this.bgmNodes = null;
      setTimeout(() => {
        nodes.stop();
        this.bgmGain = null;
      }, 900);
    } catch {
      this.bgmNodes = null;
      this.bgmGain = null;
    }
  }

  private async loadBuffer(path: string): Promise<AudioBuffer | null> {
    if (typeof window === 'undefined' || !this.ctx) return null;
    if (this.buffers.has(path)) return this.buffers.get(path)!;
    if (this.loading.has(path)) return this.loading.get(path)!;

    const promise = (async () => {
      try {
        const resp = await fetch(path);
        if (!resp.ok) return null;
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await this.ctx!.decodeAudioData(arrayBuf);
        this.buffers.set(path, audioBuf);
        return audioBuf;
      } catch {
        return null;
      } finally {
        this.loading.delete(path);
      }
    })();

    this.loading.set(path, promise);
    return promise;
  }

  play(key: string, volume = 0.5) {
    this.playSound(key, volume);
  }

  private playSound(keyOrFile: string, volume = 0.5) {
    if (this.muted || typeof window === 'undefined') return;
    this.initCtx();
    if (!this.ctx) return;

    const effectiveVolume = volume * this.sfxVolume;
    const mirFile = MIR_AUDIO_MAP[keyOrFile] || (keyOrFile.toUpperCase().endsWith('.WAV') ? keyOrFile : null);
    const path = mirFile ? assetUrl(`assets/mir/audio/${mirFile}`) : assetUrl(`assets/sound/${keyOrFile}`);
    const buf = this.buffers.get(path);
    if (buf) {
      try {
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        gain.gain.value = effectiveVolume;
        source.buffer = buf;
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
      } catch {}
    } else {
      this.loadBuffer(path).then((loadedBuf) => {
        if (!loadedBuf || this.muted || !this.ctx) return;
        try {
          const source = this.ctx.createBufferSource();
          const gain = this.ctx.createGain();
          gain.gain.value = effectiveVolume;
          source.buffer = loadedBuf;
          source.connect(gain);
          gain.connect(this.ctx.destination);
          source.start();
        } catch {}
      });
    }
  }

  playFireball() {
    this.play('fireball', 0.55);
  }

  playLightning() {
    this.play('lightning', 0.65);
  }

  playFirewall() {
    this.play('firewall', 0.5);
  }

  playShield() {
    this.play('shield', 0.6);
  }

  playSoulFireball() {
    this.play('talisman', 0.55);
  }

  playPoison() {
    this.play('poison', 0.55);
  }

  playSummon() {
    this.play('skeleton', 0.6);
  }

  playIceStorm() {
    this.play('ice', 0.6);
  }

  playLaser() {
    this.play('beam', 0.6);
  }

  playHellfire() {
    this.play('hellfire', 0.55);
  }

  playHellThunder() {
    this.play('nova', 0.65);
  }

  playHolyWord() {
    this.play('holy', 0.6);
  }

  playRepel() {
    this.play('repulse', 0.5);
  }

  playHalfMoon() {
    this.play('attack', 0.5);
  }

  playFireSword() {
    this.play('attack', 0.65);
  }

  playCharge() {
    this.play('attack', 0.55);
  }

  playSwordSlash() {
    this.play('attack', 0.45);
  }

  playHit() {
    this.play('attack', 0.4);
  }

  playHeal() {
    this.play('heal', 0.55);
  }

  playRevive() {
    this.play('heal', 0.7);
  }

  playGem() {
    this.play('unarmed', 0.4);
  }

  playLevelUp() {
    this.play('teleport', 0.6);
  }

  playWaveComplete() {
    this.play('teleport', 0.6);
  }

  playTeleport() {
    this.play('teleport', 0.6);
  }

  playClick() {
    this.play('unarmed', 0.35);
  }

  playHurt() {
    this.play('hurt', 0.5);
  }

  playDie() {
    this.play('hurt', 0.7);
  }

  playMonsterHurt() {
    this.play('attack', 0.3);
  }

  playMonsterDie() {
    this.play('hurt', 0.4);
  }
}

export const sound = new SoundSystem();
