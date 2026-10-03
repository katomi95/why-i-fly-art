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
  road_eve:  { calm: 'road_eve_iris',  cry: 'road_eve_iris' },
  road_dusk: { calm: 'road_dusk_iris', cry: 'road_dusk_iris' },
  /* 最後の対面〜見送り。同じ夕方の道で、立っている絵と残される絵を出し分ける */
  road_set:  { calm: 'road_eve_block', cry: 'road_eve_alone' }
};

/* BGM（CC0 / Musopen のショパン録音）
   vol  … 曲ごとの音量差をならして出力 RMS を約 0.034 に揃えた実測値
   skip … 録音の頭に入っている無音。ここまで飛ばしてから鳴らす */
const TRACKS = {
  quiet:    { src: 'assets/music/quiet.mp3',    vol: 0.93, skip: 2.3 }, /* 夜想曲 Op.55-1 ヘ短調 */
  grief:    { src: 'assets/music/grief.mp3',    vol: 1.40, skip: 1.4 }, /* 夜想曲 Op.27-1 嬰ハ短調 */
  betrayal: { src: 'assets/music/betrayal.mp3', vol: 0.74, skip: 1.0 }, /* 前奏曲 Op.28-6 ロ短調 */
  final:    { src: 'assets/music/final.mp3',    vol: 0.68, skip: 0.5 }, /* 夜想曲 Op.9-1 変ロ短調 */
  end:      { src: 'assets/music/end.mp3',      vol: 0.51, skip: 0.6 }  /* 夜想曲 嬰ハ短調 遺作 */
};

/* ---------------------------------------------------------------- 音 */
const A = {
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

  /* ---- 曲の再生 ---- */
  /* 1曲ずつ遅延読み込みする。頭の無音を飛ばし、曲ごとの音量差をならす */
  trackFor(mode) {
    if (!this.els) this.els = {};
    if (this.els[mode]) return this.els[mode];
    const def = TRACKS[mode];
    if (!def) return null;
    const el = new Audio();
    el.src = def.src; el.loop = false; el.preload = 'none'; el.crossOrigin = 'anonymous';
    const g = this.ac.createGain();
    g.gain.value = 0.0001;
    try {
      this.ac.createMediaElementSource(el).connect(g);
      g.connect(this.master);
    } catch (e) { return null; }

    const t = { el, g, vol: def.vol, skip: def.skip };

    /* 頭の無音を飛ばす */
    const seek = () => { try { if (el.currentTime < def.skip) el.currentTime = def.skip; } catch (e) {} };
    el.addEventListener('loadedmetadata', seek);

    /* 終わりまで来たら頭の無音を飛ばして鳴らし直す */
    el.addEventListener('ended', () => {
      if (this.cur !== mode) return;
      try { el.currentTime = def.skip; el.play().catch(() => {}); } catch (e) {}
      this.fadeTrack(mode, def.vol, 1.8);   /* 終わりぎわに絞った音量を戻す */
    });

    /* 曲の終わりぎわだけ少し絞って、継ぎ目を柔らげる */
    el.addEventListener('timeupdate', () => {
      if (!el.duration || this.cur !== mode) return;
      const left = el.duration - el.currentTime;
      if (left < 2.5) g.gain.setTargetAtTime(def.vol * Math.max(left / 2.5, 0.0001), this.ac.currentTime, 0.4);
    });

    this.els[mode] = t;
    return t;
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
    try { if (t.el.readyState >= 1 && t.el.currentTime < t.skip) t.el.currentTime = t.skip; } catch (e) {}
    t.el.play().catch(() => {});
    this.fadeTrack(mode, t.vol, 2.4);
  },

  bgm(mode) {
    if (!this.ac) return;
    this.playTrack(mode === 'stop' ? null : mode);
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
      if (!c.v) { setBg(baseBg); return 'go'; }
      if (c.e === 'cry_close') { setBg('cry_close'); return 'go'; }
      const map = IRIS_BG[baseBg];
      setBg((map && map[c.e || 'calm']) || baseBg);
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
/* 曲は1曲あたり数MBあるので、開始後に順に取りにいって場面に間に合わせる */
function preloadMusic() {
  const order = ['grief', 'betrayal', 'final', 'end'];
  order.forEach((k, i) => setTimeout(() => {
    fetch(TRACKS[k].src, { cache: 'force-cache' }).catch(() => {});
  }, 6000 + i * 9000));
}

function preloadBackgrounds() {
  const names = ['night_field','runway_dusk','morning_base','apron','base_dusk',
                 'road_eve','road_dusk','barracks','mess','hq','shelter',
                 'road_eve_iris','road_dusk_iris','road_eve_block','road_eve_alone','cry_close'];
  names.forEach((n, i) => setTimeout(() => {
    const img = new Image();
    img.src = 'assets/bg_' + n + '.jpg';
  }, i * 160));
}

$('startBtn').addEventListener('click', ev => {
  ev.stopPropagation();
  A.init();
  preloadBackgrounds();
  preloadMusic();
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
