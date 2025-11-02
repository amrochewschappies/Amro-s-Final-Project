// AudioDirector.js  — ESM-safe asset URLs
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Resolve a file path relative to THIS module (works with Vite/ESM)
const U = (rel) => new URL(rel, import.meta.url).toString();

class AudioDirector {
  constructor({
    clips,
    defaultSfxUrl = null,
    transitionSfx = {},
    masterGain = 0.9,
    crossfadeSec = 0.28,
    pauseFadeSec = 0.15, // now used as mute/unmute fade
    sfxGain = 1.0,
    bpm = null,
    beatsPerBar = 4,
    ambient = null
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

    this.buffers = new Map();
    this.sfxBuffers = new Map();
    this.defaultSfxBuffer = null;

    // ACTIVE music track "selection" (we won't stop sources anymore)
    this.current = null;

    // Treat "paused" as muted so transport keeps running
    this.isPaused = true;
    this.ready = false;

    this.ambientCfg = ambient;
    this.ambientBuffer = null;
    this.ambientNode = null;
    this.ambientGain = null;
    this.ambientEnabled = !!(ambient && (ambient.enabled ?? true));

    // NEW: persistent tracks started once per clip, then gain-only control
    this.tracks = new Map(); // id -> { node, gain, loopStart, loopEnd, buffer }
    this.transportStartTime = null; // shared start time for stable phase, when first track starts
  }

  async _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0; // start silent (muted)
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

  async _loadAmbient() {
    if (!this.ambientCfg || this.ambientBuffer) return;
    this.ambientBuffer = await this._decode(this.ambientCfg.url);
  }

  async loadAll() {
    await this._ensureCtx();
    const clipLoads = Object.entries(this.clips).map(([id, meta]) => this._loadClip(id, meta.url));
    await Promise.all(clipLoads);

    if (this.defaultSfxUrl) {
      this.defaultSfxBuffer = await this._loadSfx(this.defaultSfxUrl);
    }

    await Promise.all(
      Object.values(this.transitionSfx)
        .filter(Boolean)
        .map(url => this._loadSfx(url))
    );

    await this._loadAmbient();

    this.ready = true;
  }

  // --- persistent track creation (start once, then gain-only control) ---
  _ensureTrack(id) {
    if (this.tracks.has(id)) return this.tracks.get(id);

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
    g.gain.value = 0; // start silent
    node.connect(g);
    g.connect(this.master);

    // Start all tracks relative to one transport start time so phase is stable
    const t0 = this.transportStartTime ?? (this.ctx.currentTime + 0.02);
    if (!this.transportStartTime) this.transportStartTime = t0;

    node.start(t0, loopStart);

    const track = { node, gain: g, loopStart, loopEnd, buffer };
    this.tracks.set(id, track);
    return track;
  }

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
    const t = (this.transportStartTime ?? this.ctx.currentTime) + 0.02;
    a.node.start(t, this.ambientCfg.loopStart ?? 0);
    this.ambientNode = a.node;
    this.ambientGain = a.gain;
  }

  // --- PUBLIC API (kept the same names, changed behavior to gain-only) ---

  // Start = select a track, bring master up (unmute), fade target in, others out
  async start(id) {
    if (!this.ready) await this.loadAll();
    this._ensureAmbientStarted();

    const t = this.ctx.currentTime;

    const next = this._ensureTrack(id);

    // bring master up to audible if we were "paused" (muted)
    await this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
    this.isPaused = false;

    // fade selected track up
    next.gain.gain.setValueAtTime(next.gain.gain.value, t);
    next.gain.gain.linearRampToValueAtTime(1, t + this.crossfadeSec);

    // fade all others down
    for (const [otherId, tr] of this.tracks) {
      if (otherId === id) continue;
      tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
      tr.gain.gain.linearRampToValueAtTime(0, t + this.crossfadeSec);
    }

    this.current = { id, ...next };
  }

  // Stop = just fade all tracks down (do NOT stop sources)
  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const { gain } of this.tracks.values()) {
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + this.crossfadeSec);
    }
    this.current = null;
  }

  // Pause/Play become Mute/Unmute so transport keeps running
  async pause() {
    if (!this.ctx) return;
    await this._fadeMasterTo(0, this.pauseFadeSec);
    this.isPaused = true; // muted
  }

  async play() {
    if (!this.ctx) return;
    this._ensureAmbientStarted();
    await this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
    this.isPaused = false; // unmuted
  }

  async toggle({ startId }) {
    if (!this.ready || !this.current) {
      await this.start(startId);
      return true;
    }
    if (this.isPaused) { await this.play(); return true; }
    else { await this.pause(); return false; }
  }

  // Switch = gain crossfade between already-running (or just-started) tracks
  async switchTo(id, { mask = true, quantizeToBar = false } = {}) {
    if (!this.ready) await this.loadAll();
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

    const next = this._ensureTrack(id);
    const cur = this._ensureTrack(this.current.id);

    // Gain-only crossfade (do NOT stop nodes)
    next.gain.gain.setValueAtTime(next.gain.gain.value, at);
    next.gain.gain.linearRampToValueAtTime(1, at + this.crossfadeSec);

    cur.gain.gain.setValueAtTime(cur.gain.gain.value, at);
    cur.gain.gain.linearRampToValueAtTime(0, at + this.crossfadeSec);

    if (mask) await this._playTransitionSfx(this.current.id, id, at);

    this.current = { id, ...next };
  }

  async _playTransitionSfx(fromId, toId, at) {
    let url = this.transitionSfx[`${fromId}->${toId}`];
    if (!url && this.defaultSfxBuffer == null && !this.defaultSfxUrl) return;

    let buf = null;
    if (url) {
      buf = this.sfxBuffers.get(url);
      if (!buf) { buf = await this._loadSfx(url); }
    } else {
      buf = this.defaultSfxBuffer;
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

    const t = Math.max(at, this.ctx.currentTime + 0.01);
    src.start(t);
  }

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

  // ---- Interlude during blackout (duck -> one-shot -> switch) ----
pendingInterlude = null; // class field (declare near other fields)

async playInterludeAndSwitch(url, nextId, {
  duckTo = 0,
  interludeGain = 1.0,
  crossfade = this.crossfadeSec,
  postDelaySec = 0,            // NEW: extra delay after SFX ends
  quantizeToBar = false        // optional: land on a bar if bpm provided
} = {}) {
  if (!this.ready) await this.loadAll();

  // make sure both tracks exist so the switch can be immediate later
  if (nextId) this._ensureTrack?.(nextId);

  const now = this.ctx.currentTime;

  // 1) Duck current loop (gain-only)
  if (this.current) {
    const g = this.current.gain.gain;
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(duckTo, now + crossfade);
  }

  // 2) Play the interlude one-shot over master (respects mute if you’re muted)
  const buf = await this._loadSfx(url);
  if (!buf) return;

  // cancel any previous interlude schedule
  if (this.pendingInterlude && this.pendingInterlude.cancel) this.pendingInterlude.cancel();

  const src = this.ctx.createBufferSource();
  src.buffer = buf;
  const g = this.ctx.createGain();
  g.gain.value = Math.max(0, interludeGain);
  src.connect(g);
  g.connect(this.master);
  const tStart = Math.max(now + 0.01, now);
  src.start(tStart);

  let cancelled = false;
  this.pendingInterlude = {
    cancel: () => { cancelled = true; try { src.stop(); } catch {} },
  };

  // 3) When it ends, crossfade to nextId and clear
  const tEnd = tStart + buf.duration;
  const onEnd = async () => {
    if (cancelled) return;
    if (nextId) {
      // If you were muted, the switch still happens under master=0
      await new Promise(r => setTimeout(r, Math.max(0, postDelaySec * 1000)));
      await this.switchTo(nextId, { mask: true, quantizeToBar });
    }
    this.pendingInterlude = null;
  };

  // Web Audio has no "ended" event on BufferSource in all browsers reliably;
  // schedule via timeout aligned with audio time:
  const ms = Math.max(0, (tEnd - this.ctx.currentTime) * 1000);
  setTimeout(onEnd, ms);
}

cancelInterlude() {
  if (this.pendingInterlude && this.pendingInterlude.cancel) this.pendingInterlude.cancel();
  this.pendingInterlude = null;
}

}

// ---------- Asset maps (all using U()) ----------
const CLIPS = {
  intro: { url: U("../Assets/First Part.mp3") },
  verse: { url: U("../Assets/Second Part.mp3") },
  drop: { url: U("../Assets/Car_Audio_V1.mp3") },
};

const DEFAULT_SFX = U("../Assets/whoosh.mp3");

const TRANSITION_SFX = {
  "intro->verse": U("../Assets/whoosh.mp3"),
  "verse->drop": U("../Assets/whoosh.mp3"),
};

const AMBIENT = {
  url: U("../Assets/Rain Background Audio.mp3"),
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
  pauseFadeSec: 0.35, // mute/unmute fade
  sfxGain: 1.0,
  bpm: null,
  beatsPerBar: 4,
  ambient: AMBIENT,
});

// ---------- GSAP Scroll bindings ----------
let _scrollBound = false;
export function bindScrollToClips() {
  if (_scrollBound) return;
  _scrollBound = true;

  // keep your existing triggers — we only change volume/gain inside
  const safe = (id) => {
    // Always select the correct clip. If muted, the crossfade happens under master=0.
    audioDir.switchTo(id, { mask: true, quantizeToBar: false });
  };

  ScrollTrigger.create({
    trigger: "#hero", start: "top top", end: "bottom top",
    onEnter: () => safe("intro"),
    onEnterBack: () => safe("intro")
  });

  ScrollTrigger.create({
    trigger: "#section-3", start: "top 60%",
    onEnter: () => safe("verse")
  });

  let dropTimer = null;
  ScrollTrigger.create({
    trigger: "#section-6", start: "top 60%",
    onEnter: () => { dropTimer = gsap.delayedCall(6.1, () => safe("drop")); },
    onEnterBack: () => { dropTimer = gsap.delayedCall(6.1, () => safe("drop")); },
    onLeave: () => { if (dropTimer) { dropTimer.kill(); dropTimer = null; } },
    onLeaveBack: () => { if (dropTimer) { dropTimer.kill(); dropTimer = null; } },
  });

  ScrollTrigger.create({
    trigger: "#section-1", start: "top 100%", once: true,
    onEnter: () => audioDir.playOneShot(U("../Assets/Vroom.mp3"), { gain: 3.9 })
  });

  window.addEventListener("load", () => setTimeout(() => ScrollTrigger.refresh(), 0));
}
