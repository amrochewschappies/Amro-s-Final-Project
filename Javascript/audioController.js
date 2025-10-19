// audioDirector.js
// Separate audio file per section, seamless loop per section,
// crossfade on switch, and transition SFX (default or per-transition).
// Works with MP3/WAV/OGG; WAV/OGG recommended for perfect loops.

class AudioDirector {
  constructor({
    clips,                  // { id: { url, loopStart?:0, loopEnd?:<dur> } }
    defaultSfxUrl = null,   // e.g., "../Assets/audio/whoosh.mp3"
    transitionSfx = {},     // { "intro->verse": url, "verse->build": url, ... }
    masterGain = 0.9,
    crossfadeSec = 0.28,    // between clips
    pauseFadeSec = 0.35,    // for pause/resume
    sfxGain = 1.0,          // relative loudness of SFX
    bpm = null,             // optional: set to quantize switches to bars
    beatsPerBar = 4
  }) {
    this.clips = clips;
    this.defaultSfxUrl = defaultSfxUrl;
    this.transitionSfx = transitionSfx;

    this.masterGainLevel = masterGain;
    this.crossfadeSec = crossfadeSec;
    this.pauseFadeSec = pauseFadeSec;
    this.sfxGainLevel = sfxGain;

    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;

    this.ctx = null;
    this.master = null;

    this.buffers = new Map();      // id -> AudioBuffer
    this.sfxBuffers = new Map();   // url -> AudioBuffer (cache)
    this.defaultSfxBuffer = null;

    this.current = null;           // { id, node, gain, loopStart, loopEnd, buffer }
    this.isPaused = true;
    this.ready = false;
  }

  // ---------- Setup / Loading ----------
  async _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0; // start silent
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  async _decode(url) {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await this.ctx.decodeAudioData(arr);
  }

  async _loadClip(id, url) {
    if (this.buffers.has(id)) return;
    const buf = await this._decode(url);
    this.buffers.set(id, buf);
  }

  async _loadSfx(url) {
    if (!url) return null;
    if (this.sfxBuffers.has(url)) return this.sfxBuffers.get(url);
    const buf = await this._decode(url);
    this.sfxBuffers.set(url, buf);
    return buf;
  }

  async loadAll() {
    await this._ensureCtx();
    // load clips
    const clipLoads = Object.entries(this.clips).map(([id, meta]) => this._loadClip(id, meta.url));
    await Promise.all(clipLoads);
    // load default SFX if provided
    if (this.defaultSfxUrl) {
      this.defaultSfxBuffer = await this._loadSfx(this.defaultSfxUrl);
    }
    // preload transition-specific SFX (optional — or they’ll lazy-load)
    await Promise.all(
      Object.values(this.transitionSfx)
        .filter(Boolean)
        .map(url => this._loadSfx(url))
    );
    this.ready = true;
  }

  // ---------- Node creation / Playback ----------
  _makeLoopNode(id) {
    const buffer = this.buffers.get(id);
    const meta = this.clips[id] || {};
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;

    const loopStart = meta.loopStart ?? 0;
    const loopEnd = meta.loopEnd ?? buffer.duration;
    node.loopStart = loopStart;
    node.loopEnd   = loopEnd;

    const g = this.ctx.createGain();
    g.gain.value = 0;
    node.connect(g);
    g.connect(this.master);

    return { node, gain: g, loopStart, loopEnd, buffer };
  }

  async start(id) {
    if (!this.ready) await this.loadAll();

    // stop previous if any
    if (this.current) this.stop();

    const t = this.ctx.currentTime;
    const clip = this._makeLoopNode(id);
    clip.node.start(t, clip.loopStart);

    // fade in active clip
    clip.gain.gain.setValueAtTime(0, t);
    clip.gain.gain.linearRampToValueAtTime(1, t + this.crossfadeSec);

    this.current = { id, ...clip };
    await this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
    this.isPaused = false;
  }

  stop() {
    if (!this.current) return;
    try { this.current.node.stop(); } catch {}
    this.current = null;
  }

  async pause() {
    if (!this.ctx) return;
    await this._fadeMasterTo(0, this.pauseFadeSec);
    await this.ctx.suspend();
    this.isPaused = true;
  }

  async play() {
    if (!this.ctx) return;
    await this.ctx.resume();
    this.isPaused = false;
    await this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
  }

  async toggle({ startId }) {
    if (!this.ready || !this.current) {
      await this.start(startId);
      return true;
    }
    if (this.isPaused) { await this.play(); return true; }
    else { await this.pause(); return false; }
  }

  async switchTo(id, { mask = true, quantizeToBar = false } = {}) {
    if (!this.ready) await this.loadAll();
    if (this.isPaused) return;
    if (!this.current) return this.start(id);
    if (id === this.current.id) return;

    let at = this.ctx.currentTime;

    if (quantizeToBar && this.bpm) {
      const secPerBeat = 60 / this.bpm;
      const barDur = secPerBeat * this.beatsPerBar;
      const bars = Math.ceil(at / barDur);
      at = bars * barDur;
      if (at < this.ctx.currentTime + 0.02) at = this.ctx.currentTime + 0.02;
    }

    // Create next loop node
    const next = this._makeLoopNode(id);
    // Start a hair after the scheduled time to avoid edge clicks
    next.node.start(at + 0.02, next.loopStart);

    // Crossfade
    next.gain.gain.setValueAtTime(0, at);
    next.gain.gain.linearRampToValueAtTime(1, at + this.crossfadeSec);

    const g = this.current.gain.gain;
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(0, at + this.crossfadeSec);
    // stop old node after crossfade
    this.current.node.stop(at + this.crossfadeSec + 0.02);

    // Transition SFX
    if (mask) await this._playTransitionSfx(this.current.id, id, at);

    // Commit
    this.current = { id, ...next };
  }

  // ---------- SFX ----------
  async _playTransitionSfx(fromId, toId, at) {
    let url = this.transitionSfx[`${fromId}->${toId}`];
    if (!url && this.defaultSfxBuffer == null && !this.defaultSfxUrl) return;

    let buf = null;
    if (url) {
      buf = this.sfxBuffers.get(url);
      if (!buf) { buf = await this._loadSfx(url); }
    } else {
      buf = this.defaultSfxBuffer; // may be null if no default provided
      if (!buf && this.defaultSfxUrl) {
        buf = await this._loadSfx(this.defaultSfxUrl);
        this.defaultSfxBuffer = buf;
      }
      if (!buf) return;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const sG = this.ctx.createGain();
    sG.gain.value = this.sfxGainLevel;
    src.connect(sG);
    sG.connect(this.master);

    const t = Math.max(at, this.ctx.currentTime + 0.01); // schedule safety
    src.start(t);
  }

  // ---------- Utils ----------
  async _fadeMasterTo(target, dur) {
    const t0 = this.ctx.currentTime;
    const g = this.master.gain;
    try { g.setValueAtTime(g.value, t0); } catch {}
    g.linearRampToValueAtTime(target, t0 + dur);
    await new Promise(r => setTimeout(r, dur * 1000));
  }
}



// 1) Section clips (each loops while active)
// Tip: WAV/OGG loop cleaner than MP3. loopStart/loopEnd are optional (seconds).
const CLIPS = {
  intro: { url: "../Assets/Test Song.mp3" /*, loopStart: 0, loopEnd: 8 */ },
  verse: { url: "../Assets/Test Song.mp3" },
  build: { url: "../Assets/Test Song.mp3" },
  drop:  { url: "../Assets/Test Song.mp3" },
};

// 2) Default SFX (used when no specific transition SFX is defined)
const DEFAULT_SFX = "../Assets/whoosh.mp3";

// 3) Transition-specific SFX (optional):
// Key format: "fromId->toId"
const TRANSITION_SFX = {
  "intro->verse": "../Assets/whoosh.mp3",
  "verse->build": "../Assets/whoosh.mp3",
  "build->drop":  "../Assets/whoosh.mp3",
  // You can also add "drop->verse": "...", etc.
};

// 4) Create a ready-to-use director instance
export const audioDir = new AudioDirector({
  clips: CLIPS,
  defaultSfxUrl: DEFAULT_SFX,    // set to null if you don't want a default
  transitionSfx: TRANSITION_SFX, // or {} if none
  masterGain: 0.9,
  crossfadeSec: 0.28,
  pauseFadeSec: 0.35,
  sfxGain: 1.0,
  bpm: null,                     // set e.g. 120 to enable bar quantize
  beatsPerBar: 4,
});

/* ========= Optional: Scroll wiring helper ========= */
let _scrollBound = false;
export function bindScrollToClips() {
  if (_scrollBound) return;
  _scrollBound = true;

  if (!window.gsap || !window.ScrollTrigger) {
    console.warn("[audioDirector] GSAP/ScrollTrigger not found.");
    return;
  }

  const safe = (id) => { if (!audioDir.isPaused) audioDir.switchTo(id, { mask: true, quantizeToBar: false }); };

  // Adjust selectors to your layout
  window.ScrollTrigger.create({ trigger: "#hero",        start: "top top",  end: "bottom top", onEnter: () => safe("intro"), onEnterBack: () => safe("intro") });
  window.ScrollTrigger.create({ trigger: "#section-3",   start: "top 60%",  onEnter: () => safe("verse") });
  window.ScrollTrigger.create({ trigger: "#section-4",   start: "top 60%",  onEnter: () => safe("build") });
  window.ScrollTrigger.create({ trigger: "#section-6",start: "top 60%",  onEnter: () => safe("drop") });

  window.addEventListener("load", () => setTimeout(() => window.ScrollTrigger.refresh(), 0));
}
