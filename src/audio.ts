class SoundSystem {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();

  constructor() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        this.muted = localStorage.getItem('mafa_sound_muted') === 'true';
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

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('mafa_sound_muted', String(this.muted));
    } catch {}
    return this.muted;
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

    const path = `/assets/sound/${fileName}`;
    const buf = this.buffers.get(path);
    if (buf) {
      try {
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
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
          gain.gain.value = volume;
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
