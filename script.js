/* =====================================================================
   ただ雲は流れて / WHY I FLY  —  engine
   ===================================================================== */
"use strict";

/* ---------------------------------------------------------------- DOM */
const $ = (id) => document.getElementById(id);
const bgLayers = [$('bgA'), $('bgB')];
const charaEl = $('chara');
const whyEl = $('why'), whyList = $('whyList');
const msgEl = $('msg'), whoEl = $('who'), textEl = $('text'), nextEl = $('next');
const bigEl = $('big'), bigInner = $('bigInner');
const paperEl = $('paper'), paperInner = $('paperInner');
const choicesEl = $('choices');
const titleEl = $('title'), endEl = $('endcard');

/* ---------------------------------------------------------------- 音 */
const A = {
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

  bgm(mode) {
    if (!this.ac) return;
    const ac = this.ac;
    clearInterval(this.bgmTimer); this.bgmTimer = null;
    if (mode === 'stop') {
      this.bgmGain.gain.setTargetAtTime(0.0001, ac.currentTime, 1.1);
      return;
    }
    this.bgmGain.gain.setTargetAtTime(1, ac.currentTime, 2.0);
    /* ごく短い動機。ほとんど鳴らない。 */
    const scaleA = [174.61, 196.00, 207.65, 233.08, 261.63, 293.66, 311.13];  // ヘ短調まわり
    const scaleB = [116.54, 130.81, 155.56, 174.61];
    const set = mode === 'final' ? scaleB : scaleA;
    const gap = mode === 'final' ? 6200 : 3400;
    const vol = mode === 'final' ? 0.030 : 0.038;
    const fire = () => {
      const f = set[Math.floor(Math.random() * set.length)];
      this.tone(f, mode === 'final' ? 8 : 5, vol, 0, 'sine', this.bgmGain);
      if (Math.random() < 0.45) this.tone(f * 2, 3.4, vol * 0.4, 0.7, 'sine', this.bgmGain);
    };
    fire();
    this.bgmTimer = setInterval(fire, gap);
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
let bgTop = 0, curBg = 'black';
let bufLines = [''], lastKind = null;
let started = false;

/* ------------------------------------------------------------- 背景 */
function setBg(name, opt) {
  if (name === curBg) return;
  curBg = name;
  const cur = bgLayers[bgTop], nxt = bgLayers[1 - bgTop];
  nxt.className = 'bg bg-' + name + ((opt && opt.slow) ? ' slow' : '');
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
      setBg(c.v, c);
      if (paperEl.classList.contains('on')) paperEl.classList.remove('on');
      bufLines = ['']; lastKind = null;
      return 'go';

    case 'chara':
      if (c.v) { charaEl.dataset.emo = c.e || 'calm'; charaEl.classList.add('on'); }
      else charaEl.classList.remove('on');
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
      charaEl.classList.remove('on');
      endEl.classList.add('on');
      A.bgm('stop');
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
                 'road_eve','road_dusk','road_night','barracks','mess','hq','shelter'];
  names.forEach((n, i) => setTimeout(() => {
    const img = new Image();
    img.src = 'assets/bg_' + n + '.jpg';
  }, i * 160));
}

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
