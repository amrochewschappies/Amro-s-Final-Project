// AudioDirector.js — ESM-safe asset URLs
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

// Resolve a file path relative to THIS module (works with Vite/ESM)
const U = (rel) => `${import.meta.env.BASE_URL}${rel}`;

class AudioDirector {
  constructor({
    clips,
    defaultSfxUrl = null,
    transitionSfx = {},
    masterGain = 0.9,
    crossfadeSec = 0.28,
    pauseFadeSec = 0.15,
    sfxGain = 1.0,
    bpm = null,
    beatsPerBar = 4,
    ambient = null,
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

    this.current = null;
    this.userMuted = true;
    this.isPaused = true;
    this.ready = false;

    this.ambientCfg = ambient;
    this.ambientBuffer = null;
    this.ambientNode = null;
    this.ambientGain = null;
    this.ambientEnabled = !!(ambient && (ambient.enabled ?? true));

    this.tracks = new Map(); // id -> { node, gain, loopStart, loopEnd, buffer }
    this.transportStartTime = null;
  }

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

  async _loadAmbient() {
    if (!this.ambientCfg || this.ambientBuffer) return;
    this.ambientBuffer = await this._decode(this.ambientCfg.url);
  }

  async loadAll() {
    await this._ensureCtx();
    const clipLoads = Object.entries(this.clips).map(([id, meta]) =>
      this._loadClip(id, meta.url)
    );
    await Promise.all(clipLoads);

    if (this.defaultSfxUrl) {
      this.defaultSfxBuffer = await this._loadSfx(this.defaultSfxUrl);
    }

    await Promise.all(
      Object.values(this.transitionSfx)
        .filter(Boolean)
        .map((url) => this._loadSfx(url))
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
    const t0 = this.transportStartTime ?? this.ctx.currentTime + 0.02;
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

  // --- PUBLIC API (gain-only crossfades, persistent nodes) ---

  async start(id) {
    if (!this.ready) await this.loadAll();
    this._ensureAmbientStarted();

    const t = this.ctx.currentTime;
    const next = this._ensureTrack(id);

    if (!this.userMuted) {
      await this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
    }

    next.gain.gain.setValueAtTime(next.gain.gain.value, t);
    next.gain.gain.linearRampToValueAtTime(1, t + this.crossfadeSec);

    for (const [otherId, tr] of this.tracks) {
      if (otherId === id) continue;
      tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
      tr.gain.gain.linearRampToValueAtTime(0, t + this.crossfadeSec);
    }

    this.current = { id, ...next };
  }

  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const { gain } of this.tracks.values()) {
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + this.crossfadeSec);
    }
    this.current = null;
  }

  async pause() {
    if (!this.ctx) return;
    this.userMuted = true;
    await this._fadeMasterTo(0, this.pauseFadeSec);
    this.isPaused = true;
  }

  async play() {
    if (!this.ctx) return;
    this._ensureAmbientStarted();
    this.userMuted = false;
    await this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
    this.isPaused = false;
  }

  async toggle({ startId }) {
    if (!this.ready || !this.current) {
      await this.start(startId);
      if (this.userMuted) await this.play();
      return true;
    }
    if (this.isPaused) {
      await this.play();
      return true;
    } else {
      await this.pause();
      return false;
    }
  }

  // Inside class AudioDirector { ... }

  // helper you can call from outside if needed
  cancelInterlude() {
    if (this.pendingInterlude?.cancel) {
      this.pendingInterlude.cancel();
    }
    this.pendingInterlude = null;
  }

  async switchTo(id, { mask = true, quantizeToBar = false } = {}) {
    if (!this.ready) await this.loadAll();

    // 🔑 cancel any scheduled interlude switch before doing anything else
    this.cancelInterlude();

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

    next.gain.gain.setValueAtTime(next.gain.gain.value, at);
    next.gain.gain.linearRampToValueAtTime(1, at + this.crossfadeSec);

    cur.gain.gain.setValueAtTime(cur.gain.gain.value, at);
    cur.gain.gain.linearRampToValueAtTime(0, at + this.crossfadeSec);

    if (mask) await this._playTransitionSfx(this.current.id, id, at);
    this.current = { id, ...next };
  }

  stop() {
    if (!this.ctx) return;
    // also cancel when stopping everything
    this.cancelInterlude();

    const t = this.ctx.currentTime;
    for (const { gain } of this.tracks.values()) {
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + this.crossfadeSec);
    }
    this.current = null;
  }


  async _playTransitionSfx(fromId, toId, at) {
    let url = this.transitionSfx[`${fromId}->${toId}`];
    if (!url && this.defaultSfxBuffer == null && !this.defaultSfxUrl) return;

    let buf = null;
    if (url) {
      buf = this.sfxBuffers.get(url);
      if (!buf) buf = await this._loadSfx(url);
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
    await new Promise((r) => setTimeout(r, dur * 1000));
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

  _restartTrackAt(id, at, offset = null) {
    const buffer = this.buffers.get(id);
    if (!buffer) return null;
    const meta = this.clips[id] || {};
    const loopStart = meta.loopStart ?? 0;
    const loopEnd = meta.loopEnd ?? buffer.duration;

    let tr = this.tracks.get(id);
    if (!tr) {
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      tr = { gain: g, loopStart, loopEnd, buffer };
    } else {
      try { tr.node.stop(at); } catch { }
      try { tr.node.disconnect(); } catch { }
      tr.loopStart = loopStart;
      tr.loopEnd = loopEnd;
      tr.buffer = buffer;
    }

    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.loopStart = loopStart;
    node.loopEnd = loopEnd;
    node.connect(tr.gain);

    const startOffset = offset ?? loopStart;
    node.start(at, startOffset);

    tr.node = node;
    this.tracks.set(id, tr);
    return tr;
  }

  // ---- Interlude during blackout (duck -> one-shot -> switch) ----
  pendingInterlude = null;

  async playInterludeAndSwitch(
    url,
    nextId,
    {
      duckTo = 0,
      interludeGain = 1.0,
      crossfade = this.crossfadeSec,
      postDelaySec = 0,
      quantizeToBar = false,
      freshNext = true,
    } = {}
  ) {
    if (!this.ready) await this.loadAll();

    const now = this.ctx.currentTime;

    // 1) Duck current
    if (this.current) {
      const g = this.current.gain.gain;
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(duckTo, now + crossfade);
    }

    // 2) Load interlude
    const buf = await this._loadSfx(url);
    if (!buf) return;

    // optionally prewarm next track
    if (!freshNext && nextId) this._ensureTrack?.(nextId);

    // cancel previous interlude
    if (this.pendingInterlude?.cancel) this.pendingInterlude.cancel();

    // 3) Start flicker (one-shot)
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const sG = this.ctx.createGain();
    sG.gain.value = Math.max(0, interludeGain);
    src.connect(sG);
    sG.connect(this.master);

    const tStart = Math.max(now + 0.01, now);
    src.start(tStart);

    let cancelled = false;

    // 4) Compute exact switch time
    const nominalEnd = tStart + buf.duration;
    let scheduleAt = nominalEnd + postDelaySec;

    if (quantizeToBar && this.bpm) {
      const spb = 60 / this.bpm;
      const bar = spb * this.beatsPerBar;
      const bars = Math.ceil(scheduleAt / bar);
      scheduleAt = Math.max(scheduleAt, bars * bar);
    }

    scheduleAt = Math.max(scheduleAt, this.ctx.currentTime + 0.02);

    // 5) Fire the switch exactly at scheduleAt
    const fire = async () => {
      if (cancelled || !nextId) return;

      // SAME-ID restart (e.g., back to "drop" again)
      if (this.current?.id === nextId) {
        const restarted = this._restartTrackAt(nextId, scheduleAt);

        const g = restarted.gain.gain;
        g.setValueAtTime(g.value, scheduleAt);
        g.linearRampToValueAtTime(1, scheduleAt + crossfade);

        if (!this.userMuted) {
          this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
        }

        await this._playTransitionSfx(nextId, nextId, scheduleAt);
        this.current = { id: nextId, ...restarted };
        this.pendingInterlude = null;
        return;
      }

      // Different track: normal crossfade
      const nextTrack = freshNext
        ? this._restartTrackAt(nextId, scheduleAt)
        : this._ensureTrack(nextId);

      const gNext = nextTrack.gain.gain;
      gNext.setValueAtTime(gNext.value, scheduleAt);
      gNext.linearRampToValueAtTime(1, scheduleAt + crossfade);

      if (this.current) {
        const gCur = this.current.gain.gain;
        gCur.setValueAtTime(gCur.value, scheduleAt);
        gCur.linearRampToValueAtTime(0, scheduleAt + crossfade);
      }

      if (!this.userMuted) {
        this._fadeMasterTo(this.masterGainLevel, this.pauseFadeSec);
      }

      await this._playTransitionSfx(this.current?.id, nextId, scheduleAt);
      this.current = { id: nextId, ...nextTrack };
      this.pendingInterlude = null;
    };

    // schedule the switch
    const ms = Math.max(0, (scheduleAt - this.ctx.currentTime) * 1000);
    const timer = setTimeout(fire, ms);

    // upgrade cancel() to clear timer & stop the one-shot
    this.pendingInterlude = {
      cancel: () => {
        cancelled = true;
        try { src.stop(); } catch { }
        try { clearTimeout(timer); } catch { }
      },
    };
  }
}

// ---------- Asset maps ----------
const CLIPS = {
  intro: { url: U("audio/FirstPart.mp3") },
  verse: { url: U("audio/SecondPart.mp3") },
  drop: { url: U("audio/CarAudio.mp3") },
  project: { url: U("audio/ProjectsAudio.mp3") }
};

const DEFAULT_SFX = U("audio/whoosh.mp3");

const TRANSITION_SFX = {
  "intro->verse": U("audio/whoosh.mp3"),
  "verse->drop": U("audio/whoosh.mp3"),
  "drop->project": U("audio/whoosh.mp3"),

};

const AMBIENT = {
  url: U("audio/RainBackgroundAudio.mp3"),
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
  ambient: AMBIENT,
});

// ---------- Scroll bindings ----------
let _scrollBound = false;
export function bindScrollToClips() {
  if (_scrollBound) return;
  _scrollBound = true;

  const safe = (id) => {
    // Select the clip; if userMuted, crossfade happens under master=0
    audioDir.switchTo(id, { mask: true, quantizeToBar: false });
  };

  ScrollTrigger.create({
    trigger: "#hero",
    start: "top top",
    end: "bottom top",
    onEnter: () => safe("intro"),
    onEnterBack: () => safe("intro"),
  });

  ScrollTrigger.create({
    trigger: ".about-overlay",
    start: "top top",
    end: "bottom top",
    onEnter: () => safe("project"),
    onEnterBack: () => safe("project"),
  });

  ScrollTrigger.create({
    trigger: "#section-3",
    start: "top 60%",
    onEnter: () => safe("verse"),
    onEnterBack: () => safe("verse"),
  });

  ScrollTrigger.create({
    trigger: "#section-4",
    start: "top 60%",
    onEnterBack: () => safe("verse"),
  });

  ScrollTrigger.create({
    trigger: "#projects-section",
    start: "top 100%",
    once: true,
    onEnter: () => safe("project"),
    onEnterBack: () => safe("project"),
  });

  let dropTimer = null;
  ScrollTrigger.create({
    trigger: "#section-6",
    start: "top 60%",
    onEnter: () => {
      // play flicker, then hard-restart drop at loopStart when flicker ends
      audioDir.playInterludeAndSwitch(U("audio/Flicker.mp3"), "drop", {
        duckTo: 0,
        interludeGain: 1.0,
        crossfade: 2.28,
        postDelaySec: 0,
        quantizeToBar: false,
        freshNext: true,
      }
      );
    },
    onEnterBack: () => {
      audioDir.playInterludeAndSwitch(U("audio/Flicker.mp3"), "drop", {
        duckTo: 0,
        interludeGain: 1.0,
        crossfade: 0.28,
        postDelaySec: -1.9,
        quantizeToBar: false,
        freshNext: true,
      });
    },
    onLeave: () => { if (dropTimer) { dropTimer.kill(); dropTimer = null; audioDir.cancelInterlude() } },
    onLeaveBack: () => { if (dropTimer) { dropTimer.kill(); dropTimer = null; audioDir.cancelInterlude() } },
  });
  
  // Put this near your other ScrollTriggers
  let vroomReady = true;

  const fireVroom = () => {
    if (!vroomReady) return;
    vroomReady = false;
    audioDir.playOneShot(U("audio/Vroom.mp3"), { gain: 3.9 });
  };

  ScrollTrigger.create({
    trigger: "#section-1",
    start: "top 100%",
    // IMPORTANT: remove once:true so it can run again later
    onEnter: (self) => {
      // only when scrolling DOWN into the trigger
      if (self.direction === 1) fireVroom();
    },
    // when you scroll back above the trigger, re-arm it
    onLeaveBack: () => { vroomReady = true; },
  });


  window.addEventListener("load", () =>
    setTimeout(() => ScrollTrigger.refresh(), 0)
  );
}
