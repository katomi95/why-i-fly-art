/* =====================================================================
   ただ雲は流れて / WHY I FLY  —  engine
   ===================================================================== */
"use strict";

/* ---------------------------------------------------------------- DOM */
const $ = (id) => document.getElementById(id);
const bgLayers = [$('bgA'), $('bgB')];
const whyEl = $('why'), whyList = $('whyList');
const msgEl = $('msg'), whoEl = $('who'), textEl = $('text'), nextEl = $('next');
const bigEl = $('big'), bigInner = $('bigInner');
const paperEl = $('paper'), paperInner = $('paperInner');
const choicesEl = $('choices');
const titleEl = $('title'), endEl = $('endcard');

/* 素の背景 → イリスが描き込まれた一枚絵 */
const IRIS_BG = {
  road_eve:   'road_eve_iris',
  road_dusk:  'road_dusk_iris',
  road_night: 'road_night_iris'
};

/* ----------------------------------------------------------- 音楽素材 */
/* ヘ短調（自然的短音階）。主和音は F-Ab-C */
const PITCH = {
  F1: 43.65, Ab1: 51.91, C2: 65.41, F2: 87.31, Gb2: 92.50, Ab2: 103.83,
  C4: 261.63, Eb4: 311.13, F4: 349.23, Ab4: 415.30, Bb4: 466.16, C5: 523.25
};

/* 主題：下降する6音。m=旋律声部 / t=それに添える主和音の構成音（tintinnabuli）
   「調性はあるのに、どこへも進まない」響きをつくる */
const THEME = [
  { m: 'C5',  t: 'Ab4', at: 0.0,  len: 5.5 },
  { m: 'Bb4', t: 'Ab4', at: 2.4,  len: 5.0 },
  { m: 'Ab4', t: 'F4',  at: 4.6,  len: 5.5 },
  { m: 'F4',  t: 'C4',  at: 7.4,  len: 6.5 },
  { m: 'Eb4', t: 'C4',  at: 10.6, len: 6.0 },
  { m: 'F4',  t: 'C4',  at: 13.4, len: 9.0 }
];

/* 場面別。rate は主題の間延び率、themeVol 0 で主題を鳴らさない */
const BGM_MODES = {
  quiet:    { drone: ['F1', 'C2'],       droneVol: .040, themeVol: .055, rate: 1.0,  gap: 46000 },
  grief:    { drone: ['F1', 'Ab1', 'C2'],droneVol: .050, themeVol: .036, rate: 1.3,  gap: 72000 },
  betrayal: { drone: ['F2', 'Gb2'],      droneVol: .030, themeVol: 0,    rate: 1.0,  gap: 0 },
  final:    { drone: ['F1', 'C2'],       droneVol: .044, themeVol: .046, rate: 1.9,  gap: 80000 },
  end:      { drone: ['F1', 'C2'],       droneVol: .030, themeVol: .060, rate: 1.35, gap: 0, once: true }
};

/* 楽曲版（CC0 / Musopen の Chopin 録音）。生成音と切り替えて使う */
const TRACKS = {
  quiet:    'assets/music/quiet.mp3',     /* 夜想曲 Op.55-1 ヘ短調 */
  grief:    'assets/music/grief.mp3',     /* 夜想曲 Op.27-1 嬰ハ短調 */
  betrayal: 'assets/music/betrayal.mp3',  /* 前奏曲 Op.28-6 ロ短調 */
  final:    'assets/music/final.mp3',     /* 夜想曲 Op.9-1 変ロ短調 */
  end:      'assets/music/end.mp3'        /* 夜想曲 嬰ハ短調 遺作 Lento con gran espressione */
};
const TRACK_VOL = 0.34;   /* ナレーションの下に敷く音量 */

/* ---------------------------------------------------------------- 音 */
const A = {
  musicMode: 'piano',   /* 'piano' = 楽曲版 / 'synth' = 生成音 */
  cur: null, els: null,
  ac: null, master: null, bed: null, muted: false,
  bgmGain: null, bgmTimer: null, bgmOsc: [], noiseBuf: null, sfx: [],

  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return; }
    const ac = this.ac;
    this.master = ac.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ac.destination);

    /* 2秒ぶんのブラウンノイズ */
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;

    /* 常時の風 */
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
    const g = ac.createGain(); g.gain.value = 0.035;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ac.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); lfo.start();
    this.bed = g;

    this.bgmGain = ac.createGain();
    this.bgmGain.gain.value = 0.0;
    this.bgmGain.connect(this.master);

    /* ドローン用のバス：ゆっくり開閉するローパスで呼吸させる */
    this.droneBus = ac.createGain();
    this.droneBus.gain.value = 1;
    const dlp = ac.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 520; dlp.Q.value = 0.3;
    const dlfo = ac.createOscillator(); dlfo.frequency.value = 0.035;
    const dlg = ac.createGain(); dlg.gain.value = 190;
    dlfo.connect(dlg); dlg.connect(dlp.frequency);
    this.droneBus.connect(dlp); dlp.connect(this.bgmGain);
    dlfo.start();
    this.droneNodes = [];
  },

  mute(on) {
    this.muted = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0 : 0.9, this.ac.currentTime, 0.15);
  },

  noise(dur, freq, vol, delay, type, q) {
    if (!this.ac) return null;
    const ac = this.ac, t0 = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass';
    f.frequency.value = freq; f.Q.value = q || 0.6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(1.4, dur * 0.25));
    g.gain.setValueAtTime(vol, t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t0); s.stop(t0 + dur + 0.1);
    return { s, f, g, t0 };
  },

  tone(freq, dur, vol, delay, type, dest) {
    if (!this.ac) return;
    const ac = this.ac, t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },

  play(name) {
    if (!this.ac) return;
    const ac = this.ac;
    switch (name) {
      case 'wind':
        this.bed && this.bed.gain.setTargetAtTime(0.055, ac.currentTime, 1.2);
        setTimeout(() => this.bed && this.bed.gain.setTargetAtTime(0.035, ac.currentTime, 3), 6000);
        break;
      case 'engine_far':
        this.noise(9, 150, 0.05, 0, 'lowpass');
        this.tone(52, 9, 0.03, 0, 'sine');
        break;
      case 'engine_start':
        for (let i = 0; i < 5; i++) this.noise(0.16, 300, 0.10, i * 0.26, 'bandpass', 2);
        this.noise(7, 190, 0.09, 1.2, 'lowpass');
        this.tone(58, 7, 0.05, 1.2, 'sine');
        break;
      case 'taxi':
        this.noise(6, 240, 0.08, 0, 'lowpass');
        this.tone(64, 6, 0.045, 0, 'sine');
        break;
      case 'takeoff': {
        const n = this.noise(13, 260, 0.13, 0, 'lowpass');
        if (n) n.f.frequency.setTargetAtTime(90, n.t0 + 4, 4);
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(70, ac.currentTime);
        o.frequency.exponentialRampToValueAtTime(96, ac.currentTime + 3);
        o.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 13);
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.07, ac.currentTime + 2.2);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 13);
        o.connect(g); g.connect(this.master); o.start(); o.stop(ac.currentTime + 13.2);
        break;
      }
      case 'siren_far': {
        const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
        o.type = 'sine'; o.frequency.value = 466;
        l.frequency.value = 0.16; lg.gain.value = 60;
        l.connect(lg); lg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.016, ac.currentTime + 2);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 11);
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(); l.start(); o.stop(ac.currentTime + 11.2); l.stop(ac.currentTime + 11.2);
        break;
      }
      case 'grab':
        this.noise(0.3, 180, 0.10, 0, 'lowpass');
        break;
    }
  },

  /* 減衰する撥弦・鍵盤的な音。倍音を重ねてサンプルなしで質感を出す */
  piano(freq, dur, vol, delay) {
    if (!this.ac) return;
    const ac = this.ac, t0 = ac.currentTime + (delay || 0);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    [[1, 1], [2, .24], [3, .09], [4.02, .04]].forEach(([mul, amp]) => {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.value = freq * mul;
      const og = ac.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(t0); o.stop(t0 + dur + 0.05);
    });
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.connect(lp); lp.connect(this.bgmGain);
  },

  startDrone(names, vol) {
    const ac = this.ac, t0 = ac.currentTime;
    names.forEach((n, i) => {
      [-6, 6].forEach(det => {
        const o = ac.createOscillator(); o.type = 'sine';
        o.frequency.value = PITCH[n]; o.detune.value = det;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol / (i + 1.5), t0 + 7);
        o.connect(g); g.connect(this.droneBus);
        o.start(t0);
        this.droneNodes.push({ o, g });
      });
    });
  },

  stopDrone(fade) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    this.droneNodes.forEach(({ o, g }) => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      try { o.stop(t + fade + 0.2); } catch (e) {}
    });
    this.droneNodes = [];
  },

  /* 主題を一度ぶん鳴らす。各音に主和音の構成音を一つだけ添える */
  phrase(vol, rate) {
    THEME.forEach(n => {
      this.piano(PITCH[n.m], n.len * rate, vol, n.at * rate);
      this.piano(PITCH[n.t], n.len * rate * .9, vol * .42, n.at * rate + 0.09);
    });
  },

  /* ---- 楽曲版 ---- */
  /* 1曲ずつ遅延読み込みする。曲の切れ目はゲイン操作で柔らかくつなぐ */
  trackFor(mode) {
    if (!this.els) this.els = {};
    if (this.els[mode]) return this.els[mode];
    const src = TRACKS[mode];
    if (!src) return null;
    const el = new Audio();
    el.src = src; el.loop = true; el.preload = 'none'; el.crossOrigin = 'anonymous';
    const g = this.ac.createGain();
    g.gain.value = 0.0001;
    try {
      this.ac.createMediaElementSource(el).connect(g);
      g.connect(this.master);
    } catch (e) { return null; }
    /* ループの継ぎ目：終わりで絞り、頭で戻す */
    el.addEventListener('timeupdate', () => {
      if (!el.duration || this.cur !== mode) return;
      const left = el.duration - el.currentTime;
      const want = (left < 2.5) ? TRACK_VOL * Math.max(left / 2.5, 0.0001)
                 : (el.currentTime < 2.5 ? TRACK_VOL * Math.max(el.currentTime / 2.5, 0.0001)
                 : TRACK_VOL);
      g.gain.setTargetAtTime(want, this.ac.currentTime, 0.4);
    });
    this.els[mode] = { el, g };
    return this.els[mode];
  },

  fadeTrack(mode, to, sec) {
    const t = this.els && this.els[mode];
    if (!t) return;
    const now = this.ac.currentTime;
    t.g.gain.cancelScheduledValues(now);
    t.g.gain.setValueAtTime(Math.max(t.g.gain.value, 0.0001), now);
    /* setTarget のほうが前半が無音にならず、立ち上がりが自然になる */
    t.g.gain.setTargetAtTime(Math.max(to, 0.00001), now, sec / 3.2);
    if (to <= 0.0001) setTimeout(() => { try { t.el.pause(); } catch (e) {} }, sec * 1000 + 400);
  },

  playTrack(mode) {
    if (this.cur && this.cur !== mode) this.fadeTrack(this.cur, 0, 2.6);
    this.cur = mode || null;
    if (!mode) return;
    const t = this.trackFor(mode);
    if (!t) return;
    t.el.play().catch(() => {});
    this.fadeTrack(mode, TRACK_VOL, 3.0);
  },

  bgm(mode) {
    if (!this.ac) return;
    const ac = this.ac;
    if (this.musicMode === 'piano') {
      clearInterval(this.bgmTimer); this.bgmTimer = null;
      clearTimeout(this.bgmKick); this.bgmKick = null;
      this.stopDrone(2.0);
      this.playTrack(mode === 'stop' ? null : mode);
      return;
    }
    this.playTrack(null);
    clearInterval(this.bgmTimer); this.bgmTimer = null;
    clearTimeout(this.bgmKick); this.bgmKick = null;

    if (mode === 'stop') {
      this.stopDrone(3.4);
      this.bgmGain.gain.setTargetAtTime(0.0001, ac.currentTime, 1.2);
      return;
    }
    const m = BGM_MODES[mode];
    if (!m) return;

    this.stopDrone(2.6);
    this.bgmGain.gain.setTargetAtTime(1, ac.currentTime, 2.0);
    this.startDrone(m.drone, m.droneVol);

    if (m.themeVol > 0) {
      const play = () => this.phrase(m.themeVol, m.rate);
      this.bgmKick = setTimeout(play, m.once ? 1400 : 6000);
      if (!m.once && m.gap) this.bgmTimer = setInterval(play, m.gap);
    }
  }
};

/* ---------------------------------------------------- WHY I FIGHT 構築 */
WHY_ITEMS.forEach(it => {
  const li = document.createElement('li');
  li.dataset.key = it.key;
  li.textContent = it.label;
  const bar = document.createElement('span');
  bar.className = 'bar';
  li.appendChild(bar);
  whyList.appendChild(li);
});
const whyLi = (key) => whyList.querySelector('li[data-key="' + key + '"]');

/* ---------------------------------------------------------------- 状態 */
let idx = 0;
let typing = false, typeTimer = null, pending = null;
let awaitInput = false, blocked = false, choosing = false;
let bgTop = 0, curBg = 'black', baseBg = 'black';
let bufLines = [''], lastKind = null;
let started = false;

/* ------------------------------------------------------------- カメラ */
/* 縦長画面では寄り引きを控えめにする（横移動は切る） */
const portrait = matchMedia('(max-aspect-ratio: 1/1)');
const CAM_BASE = { s: 1.04, x: 0, y: 0 };

function camTransform(c) {
  if (portrait.matches) {
    return 'scale(' + (1 + (c.s - 1) * 0.45) + ') translate(0%, ' + (c.y * 0.45) + '%)';
  }
  return 'scale(' + c.s + ') translate(' + c.x + '%, ' + c.y + '%)';
}

/* 背景切替時、入ってくる層のカメラを基準位置へ瞬時に戻す */
function resetCam(layer) {
  const cam = layer.querySelector('.cam');
  cam.style.transition = 'none';
  cam.style.transform = camTransform(CAM_BASE);
  void cam.offsetWidth;
  cam.style.transition = '';
}

function moveCam(c) {
  const cam = bgLayers[bgTop].querySelector('.cam');
  if (c.d === 0) {
    cam.style.transition = 'none';
    cam.style.transform = camTransform(c);
    void cam.offsetWidth;
    cam.style.transition = '';
  } else {
    cam.style.transitionDuration = (c.d || 6) + 's';
    cam.style.transform = camTransform(c);
  }
}

/* ------------------------------------------------------------- 背景 */
function setBg(name, opt) {
  if (name === curBg) return;
  curBg = name;
  const cur = bgLayers[bgTop], nxt = bgLayers[1 - bgTop];
  nxt.className = 'bg bg-' + name + ((opt && opt.slow) ? ' slow' : '');
  resetCam(nxt);
  cur.classList.toggle('slow', !!(opt && opt.slow));
  void nxt.offsetWidth;
  if (opt && opt.instant) {
    nxt.style.transition = 'none';
    nxt.classList.add('on');
    void nxt.offsetWidth;
    nxt.style.transition = '';
  } else {
    nxt.classList.add('on');
  }
  cur.classList.remove('on');
  bgTop = 1 - bgTop;
}

/* ------------------------------------------------------------- 文字送り */
const PUNCT = { '。': 260, '、': 160, '…': 130, '？': 260, '！': 240, '「': 60 };

function showText(c) {
  const isN = (c.k === 'n');
  if (isN && lastKind === 'n' && bufLines.length < 3) bufLines.push('');
  else bufLines = [''];
  lastKind = c.k;

  whoEl.textContent = isN ? '' : c.w;
  textEl.className = isN ? 'narr' : 'line';
  msgEl.classList.add('on');
  nextEl.classList.remove('on');

  const prefix = bufLines.length > 1 ? bufLines.slice(0, -1).join('\n') + '\n' : '';
  const body = c.t;
  const speed = c.slow ? 78 : 30;

  typing = true;
  let i = 0;
  const tick = () => {
    if (!typing) return;
    i++;
    textEl.textContent = prefix + body.slice(0, i);
    if (i >= body.length) { finishType(c, prefix, body); return; }
    const ch = body[i - 1];
    typeTimer = setTimeout(tick, speed + (PUNCT[ch] || 0));
  };
  textEl.textContent = prefix;
  typeTimer = setTimeout(tick, speed);
}

function finishType(c, prefix, body) {
  clearTimeout(typeTimer);
  typing = false;
  textEl.textContent = prefix + body;
  bufLines[bufLines.length - 1] = body;
  if (c.auto) {
    blocked = !!c.lock;
    awaitInput = false;
    setTimeout(() => { blocked = false; advance(); }, c.auto);
  } else {
    awaitInput = true;
    nextEl.classList.add('on');
  }
}

function skipType() {
  if (!typing || !pending) return;
  typing = false;
  clearTimeout(typeTimer);
  const c = pending;
  const prefix = bufLines.length > 1 ? bufLines.slice(0, -1).join('\n') + '\n' : '';
  finishType(c, prefix, c.t);
}

/* ------------------------------------------------------------- 大文字 */
function showBig(c) {
  bigInner.textContent = c.t;
  bigInner.className = /[぀-ヿ一-鿿]/.test(c.t) ? 'jp' : '';
  bigEl.classList.toggle('quiet', !!c.quiet);
  bigEl.classList.add('on');
  msgEl.classList.remove('on');
  blocked = true;
  setTimeout(() => {
    bigEl.classList.remove('on');
    blocked = false;
    setTimeout(advance, 900);
  }, c.ms);
}

/* ------------------------------------------------------------- 紙 */
function showPaper(c) {
  paperInner.className = c.paper === 'note' ? 'note' : '';
  paperInner.innerHTML = '';
  c.lines.forEach((l, i) => {
    const p = document.createElement('p');
    p.textContent = l;
    p.style.animationDelay = (0.35 + i * 0.55) + 's';
    paperInner.appendChild(p);
  });
  paperEl.classList.remove('ready');
  paperEl.classList.add('on');
  msgEl.classList.remove('on');
  blocked = true;
  const total = 900 + c.lines.length * 550;
  setTimeout(() => {
    blocked = false;
    awaitInput = true;
    paperEl.classList.add('ready');
  }, total);
  pending = { k: 'paper' };
}

/* ------------------------------------------------------------- 選択肢 */
function showChoice(c) {
  choosing = true;
  msgEl.classList.remove('on');
  choicesEl.innerHTML = '';
  c.opts.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.label;
    b.addEventListener('click', ev => { ev.stopPropagation(); pick(); });
    choicesEl.appendChild(b);
  });
  const bar = document.createElement('div');
  bar.id = 'choiceBar';
  const i = document.createElement('i');
  i.style.width = '100%';
  i.style.transition = 'width ' + c.ms + 'ms linear';
  bar.appendChild(i);
  choicesEl.appendChild(bar);
  choicesEl.classList.add('on');
  requestAnimationFrame(() => { i.style.width = '0%'; });

  let done = false;
  const to = setTimeout(() => pick(), c.ms);
  function pick() {
    if (done) return;
    done = true;
    clearTimeout(to);
    choicesEl.classList.remove('on');
    choosing = false;
    setTimeout(advance, 700);
  }
}

/* ------------------------------------------------------------- 実行 */
function exec(c) {
  switch (c.k) {
    case 'bg':
      baseBg = c.v;
      setBg(c.v, c);
      if (paperEl.classList.contains('on')) paperEl.classList.remove('on');
      bufLines = ['']; lastKind = null;
      return 'go';

    case 'chara':
      /* 立ち絵は持たず、人物が描き込まれた一枚絵に差し替える */
      if (c.v) setBg(c.e === 'cry_close' ? 'cry_close' : (IRIS_BG[baseBg] || baseBg));
      else setBg(baseBg);
      return 'go';

    case 'panel':
      if (c.v === 'show') {
        whyEl.classList.add('on');
        whyEl.setAttribute('aria-hidden', 'false');
        [...whyList.children].forEach((li, i) => setTimeout(() => li.classList.add('in'), 400 + i * 380));
      } else {
        whyEl.classList.remove('on');
      }
      return 'go';

    case 'crack': {
      const li = whyLi(c.key); if (li) li.classList.add('cracked');
      A.tone(150, 1.6, 0.05, 0, 'sine');
      return 'go';
    }
    case 'strike': {
      const li = whyLi(c.key);
      if (li) { li.classList.remove('cracked'); li.classList.add('struck'); }
      A.tone(110, 2.4, 0.055, 0, 'sine');
      return 'go';
    }

    case 'cam': moveCam(c); return 'go';

    case 'sfx': A.play(c.v); return 'go';
    case 'bgm': A.bgm(c.v); return 'go';

    case 'wait':
      blocked = true;
      setTimeout(() => { blocked = false; advance(); }, c.ms);
      return 'pause';

    case 'n':
    case 'd':
      if (paperEl.classList.contains('on')) paperEl.classList.remove('on');
      pending = c;
      showText(c);
      return 'pause';

    case 'big':
      bufLines = ['']; lastKind = null;
      showBig(c);
      return 'pause';

    case 'note':
      bufLines = ['']; lastKind = null;
      showPaper(c);
      return 'pause';

    case 'choice':
      bufLines = ['']; lastKind = null;
      showChoice(c);
      return 'pause';

    case 'title_end':
      msgEl.classList.remove('on');
      whyEl.classList.remove('on');
      endEl.classList.add('on');
      return 'pause';

    case 'end':
      return 'pause';
  }
  return 'go';
}

function advance() {
  if (choosing) return;
  while (idx < STORY.length) {
    const c = STORY[idx++];
    if (exec(c) === 'pause') return;
  }
}

/* ------------------------------------------------------------- 入力 */
function onTap() {
  if (!started || blocked || choosing) return;
  if (typing) { skipType(); return; }
  if (awaitInput) {
    awaitInput = false;
    nextEl.classList.remove('on');
    advance();
  }
}

$('game').addEventListener('click', onTap);
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
    e.preventDefault(); onTap();
  }
});

/* ------------------------------------------------------------- 起動 */
/* 背景画像を先読みしておく（場面転換での出遅れ防止） */
function preloadBackgrounds() {
  const names = ['night_field','runway_dusk','morning_base','apron','base_dusk',
                 'road_eve','road_dusk','road_night','barracks','mess','hq','shelter',
                 'road_eve_iris','road_dusk_iris','road_night_iris','cry_close'];
  names.forEach((n, i) => setTimeout(() => {
    const img = new Image();
    img.src = 'assets/bg_' + n + '.jpg';
  }, i * 160));
}

/* タイトル画面の音楽切り替え */
document.querySelectorAll('#musicPick button').forEach(b => {
  b.addEventListener('click', ev => {
    ev.stopPropagation();
    A.musicMode = b.dataset.m;
    document.querySelectorAll('#musicPick button')
      .forEach(x => x.classList.toggle('on', x === b));
    try { localStorage.setItem('wif_music', A.musicMode); } catch (e) {}
  });
});
try {
  const saved = localStorage.getItem('wif_music');
  if (saved === 'synth' || saved === 'piano') {
    A.musicMode = saved;
    document.querySelectorAll('#musicPick button')
      .forEach(x => x.classList.toggle('on', x.dataset.m === saved));
  }
} catch (e) {}

$('startBtn').addEventListener('click', ev => {
  ev.stopPropagation();
  A.init();
  preloadBackgrounds();
  titleEl.classList.add('off');
  setTimeout(() => { titleEl.style.display = 'none'; }, 1500);
  started = true;
  setTimeout(advance, 900);
});

$('replayBtn').addEventListener('click', ev => {
  ev.stopPropagation();
  location.reload();
});

$('sndBtn').addEventListener('click', ev => {
  ev.stopPropagation();
  A.init();
  const off = !A.muted;
  A.mute(off);
  $('sndBtn').classList.toggle('off', off);
});

/* 初期背景 */
bgLayers[0].className = 'bg bg-black on';
bgLayers[1].className = 'bg bg-black';
