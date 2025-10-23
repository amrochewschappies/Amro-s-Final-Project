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
    beatsPerBar = 4,

    // === Ambient Additions ===
    ambient = null          // { url, loopStart?:0, loopEnd?:<dur>, gain?:0.45, enabled?:true, autoStart?:true }
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

    // === Ambient Additions ===
    this.ambientCfg = ambient;
    this.ambientBuffer = null;
    this.ambientNode = null;
    this.ambientGain = null;
    this.ambientEnabled = !!(ambient && (ambient.enabled ?? true));
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

  // === Ambient Additions ===
  async _loadAmbient() {
    if (!this.ambientCfg || this.ambientBuffer) return;
    this.ambientBuffer = await this._decode(this.ambientCfg.url);
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

    // === Ambient Additions ===
    await this._loadAmbient();

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
    node.loopEnd = loopEnd;

    const g = this.ctx.createGain();
    g.gain.value = 0;
    node.connect(g);
    g.connect(this.master);

    return { node, gain: g, loopStart, loopEnd, buffer };
  }

  // === Ambient Additions ===
  _makeAmbientNode() {
    if (!this.ambientBuffer) return null;
    const node = this.ctx.createBufferSource();
    node.buffer = this.ambientBuffer;
    node.loop = true;
    const loopStart = this.ambientCfg.loopStart ?? 0;
    const loopEnd = this.ambientCfg.loopEnd ?? this.ambientBuffer.duration;
    node.loopStart = loopStart;
    node.loopEnd = loopEnd;

    const g = this.ctx.createGain();
    g.gain.value = this.ambientCfg.gain ?? 0.45;
    node.connect(g);
    g.connect(this.master);
    return { node, gain: g };
  }

  _ensureAmbientStarted() {
    if (!this.ambientEnabled) return;
    if (!this.ambientBuffer) return;
    if (this.ambientNode) return;
    const a = this._makeAmbientNode();
    if (!a) return;
    const t = this.ctx.currentTime + 0.01;
    a.node.start(t, this.ambientCfg.loopStart ?? 0);
    this.ambientNode = a.node;
    this.ambientGain = a.gain;
  }

  _stopAmbient() {
    if (!this.ambientNode) return;
    try { this.ambientNode.stop(); } catch { }
    this.ambientNode = null;
    this.ambientGain = null;
  }

  async start(id) {
    if (!this.ready) await this.loadAll();

    // === Ambient Additions ===
    if (this.ambientCfg?.autoStart ?? true) this._ensureAmbientStarted();

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
    try { this.current.node.stop(); } catch { }
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
    // === Ambient Additions ===
    this._ensureAmbientStarted();
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
    try { g.setValueAtTime(g.value, t0); } catch { }
    g.linearRampToValueAtTime(target, t0 + dur);
    await new Promise(r => setTimeout(r, dur * 1000));
  }

  async playOneShot(url, { gain = 1.0, at = null } = {}) {
    if (!this.ready) await this.loadAll();
    const buf = await this._loadSfx(url);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const g = this.ctx.createGain();
    g.gain.value = Math.max(0, gain);
    src.connect(g);
    g.connect(this.master);

    const t = Math.max(at ?? this.ctx.currentTime + 0.01, this.ctx.currentTime + 0.01);
    src.start(t);
  }
}



// 1) Section clips (each loops while active)
const CLIPS = {
  intro: { url: "../Assets/First Part.mp3" },
  verse: { url: "../Assets/Second Part.mp3" },
  build: { url: "../Assets/Test Song.mp3" },
  drop: { url: "../Assets/Car_Audio_V1.mp3" },
};

// 2) Default SFX
const DEFAULT_SFX = "../Assets/whoosh.mp3";

// 3) Transition-specific SFX
const TRANSITION_SFX = {
  "intro->verse": "../Assets/Whoosh.mp3",
  "verse->build": "../Assets/whoosh.mp3",
  "build->drop": "../Assets/whoosh.mp3",
};

// === Ambient Additions ===
const AMBIENT = {
  url: "../Assets/Rain Background Audio.mp3", // WAV/OGG loop recommended
  loopStart: 0,
  gain: 0.25,
  enabled: true,
  autoStart: true,
};

export const audioDir = new AudioDirector({
  clips: CLIPS,
  defaultSfxUrl: DEFAULT_SFX,
  transitionSfx: TRANSITION_SFX,
  masterGain: 0.9,
  crossfadeSec: 0.28,
  pauseFadeSec: 0.35,
  sfxGain: 1.0,
  bpm: null,
  beatsPerBar: 4,
  ambient: AMBIENT, // added here
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

  window.ScrollTrigger.create({ trigger: "#hero", start: "top top", end: "bottom top", onEnter: () => safe("intro"), onEnterBack: () => safe("intro") });
  window.ScrollTrigger.create({ trigger: "#section-3", start: "top 60%", onEnter: () => safe("verse") });
  window.ScrollTrigger.create({ trigger: "#section-4", start: "top 60%", onEnter: () => safe("build") });
  window.ScrollTrigger.create({ trigger: "#section-6", start: "top 60%", onEnter: () => safe("drop") });

  window.ScrollTrigger.create({
    trigger: "#section-1",
    start: "top 100%",
    once: true,                           // fire a single time
    onEnter: () => audioDir.playOneShot("../Assets/Vroom.mp3", { gain: 3.9 })
  });

  window.addEventListener("load", () => setTimeout(() => window.ScrollTrigger.refresh(), 0));
}
