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

  private playSound(fileName: string, volume = 0.5) {
    if (this.muted || typeof window === 'undefined') return;
    this.initCtx();
    if (!this.ctx) return;

    const effectiveVolume = volume * this.sfxVolume;
    const path = `/assets/sound/${fileName}`;
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
    this.playSound('skill_fireball.wav', 0.55);
  }

  playLightning() {
    this.playSound('skill_lightning.wav', 0.65);
  }

  playFirewall() {
    this.playSound('skill_firewall.wav', 0.5);
  }

  playShield() {
    this.playSound('skill_shield.wav', 0.6);
  }

  playSoulFireball() {
    this.playSound('skill_talisman.wav', 0.55);
  }

  playPoison() {
    this.playSound('skill_poison.wav', 0.55);
  }

  playSummon() {
    this.playSound('skill_shinsu.wav', 0.6);
  }

  playIceStorm() {
    this.playSound('skill_iceroar.wav', 0.6);
  }

  playLaser() {
    this.playSound('skill_beam.wav', 0.6);
  }

  playHellfire() {
    this.playSound('skill_hellfire.wav', 0.55);
  }

  playHellThunder() {
    this.playSound('skill_hellthunder.wav', 0.65);
  }

  playHolyWord() {
    this.playSound('skill_holyword.wav', 0.6);
  }

  playRepel() {
    this.playSound('skill_repel.wav', 0.5);
  }

  playHalfMoon() {
    this.playSound('skill_slash.wav', 0.5);
  }

  playFireSword() {
    this.playSound('skill_slash.wav', 0.65);
  }

  playCharge() {
    this.playSound('skill_slash.wav', 0.55);
  }

  playSwordSlash() {
    this.playSound('hit_sword.wav', 0.45);
  }

  playHit() {
    this.playSound('hit_sword.wav', 0.4);
  }

  playHeal() {
    this.playSound('potion.wav', 0.55);
  }

  playRevive() {
    this.playSound('potion.wav', 0.7);
  }

  playGem() {
    this.playSound('coin.wav', 0.4);
  }

  playLevelUp() {
    this.playSound('teleport.wav', 0.6);
  }

  playWaveComplete() {
    this.playSound('teleport.wav', 0.6);
  }

  playTeleport() {
    this.playSound('teleport.wav', 0.6);
  }

  playClick() {
    this.playSound('ui_click.wav', 0.35);
  }

  playHurt() {
    this.playSound('player_hurt.wav', 0.5);
  }

  playDie() {
    this.playSound('player_die.wav', 0.7);
  }

  playMonsterHurt() {
    this.playSound('monster_hurt.wav', 0.3);
  }

  playMonsterDie() {
    this.playSound('monster_die.wav', 0.4);
  }
}

export const sound = new SoundSystem();
