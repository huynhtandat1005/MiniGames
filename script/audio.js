const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Kích hoạt Audio Context bằng tương tác đầu tiên của client (Anti-block chính sách trình duyệt)
['click', 'keydown', 'touchstart'].forEach(e => 
  document.addEventListener(e, () => getCtx(), { once: true })
);

function playTone({ freq = 440, type = 'sine', duration = .15, gain = .3, decay = .1, delay = 0 } = {}) {
  try {
    const c = getCtx(), osc = c.createOscillator(), gn = c.createGain();
    osc.connect(gn);
    gn.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    gn.gain.setValueAtTime(gain, c.currentTime + delay);
    gn.gain.exponentialRampToValueAtTime(.001, c.currentTime + delay + duration + decay);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + decay + .05);
  } catch (e) {}
}

function playNoise(duration = .1, gain = .15) {
  try {
    const c = getCtx(), buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), gn = c.createGain(), flt = c.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 800;
    src.buffer = buf;
    src.connect(flt);
    flt.connect(gn);
    gn.connect(c.destination);
    gn.gain.setValueAtTime(gain, c.currentTime);
    gn.gain.exponentialRampToValueAtTime(.001, c.currentTime + duration);
    src.start();
    src.stop(c.currentTime + duration + .05);
  } catch (e) {}
}

// Bản đồ hiệu ứng âm thanh SFX trong trò chơi
const SFX = {
  countdown3: () => playTone({ freq: 523, type: 'triangle', duration: .15, gain: .35, decay: .15 }),
  countdown2: () => playTone({ freq: 659, type: 'triangle', duration: .15, gain: .35, decay: .15 }),
  countdown1: () => playTone({ freq: 784, type: 'triangle', duration: .15, gain: .4,  decay: .2 }),
  go: () => {
    playTone({ freq: 1047, type: 'square', duration: .08, gain: .25, decay: .05, delay: 0 });
    playTone({ freq: 1319, type: 'square', duration: .12, gain: .3,  decay: .1,  delay: .09 });
  },
  tick: () => playTone({ freq: 300, type: 'sine', duration: .04, gain: .12, decay: .03 }),
  suspense: (r) => {
    const b = 180 + (6 - r) * 44;
    playTone({ freq: b,      type: 'sine', duration: .07, gain: .35, decay: .05, delay: 0 });
    playTone({ freq: b * .5,  type: 'sine', duration: .09, gain: .2,  decay: .06, delay: .01 });
    playTone({ freq: b * 1.15,type: 'sine', duration: .06, gain: .28, decay: .04, delay: .14 });
    playTone({ freq: b * .55, type: 'sine', duration: .08, gain: .15, decay: .05, delay: .15 });
    playNoise(.03, .08);
  },
  choose: () => {
    playNoise(.05, .12);
    playTone({ freq: 660, type: 'sine', duration: .08, gain: .2, decay: .1, delay: .04 });
  },
  oppChose: () => playTone({ freq: 880, type: 'sine', duration: .07, gain: .15, decay: .08 }),
  timeout: () => {
    playTone({ freq: 400, type: 'sawtooth', duration: .15, gain: .25, decay: .1,  delay: 0 });
    playTone({ freq: 300, type: 'sawtooth', duration: .2,  gain: .2,  decay: .15, delay: .2 });
    playTone({ freq: 200, type: 'sawtooth', duration: .3,  gain: .15, decay: .2,  delay: .45 });
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => playTone({ freq: f, type: 'square', duration: .12, gain: .2, decay: .1, delay: i * .1 })),
  lose: () => [400, 320, 260, 200].forEach((f, i) => playTone({ freq: f, type: 'sawtooth', duration: .18, gain: .2, decay: .1, delay: i * .12 })),
  draw: () => {
    playTone({ freq: 523, type: 'sine', duration: .2, gain: .2, decay: .15, delay: 0 });
    playTone({ freq: 523, type: 'sine', duration: .2, gain: .2, decay: .15, delay: .25 });
  },
  fanfare: () => [[523, .0], [659, .15], [784, .3], [1047, .45], [784, .6], [1047, .75]].forEach(([f, d]) => playTone({ freq: f, type: 'square', duration: .12, gain: .18, decay: .08, delay: d })),
  click: () => playTone({ freq: 800, type: 'sine', duration: .05, gain: .1, decay: .05 }),
  join: () => {
    playTone({ freq: 440, type: 'sine', duration: .1, gain: .2, decay: .1, delay: 0 });
    playTone({ freq: 660, type: 'sine', duration: .1, gain: .2, decay: .1, delay: .12 });
  },
  popupOpen: () => playTone({ freq: 600, type: 'sine', duration: .08, gain: .15, decay: .08 }),
  popupClose: () => playTone({ freq: 400, type: 'sine', duration: .07, gain: .12, decay: .06 }),
  error: () => {
    playTone({ freq: 300, type: 'square', duration: .08, gain: .2, decay: .05, delay: 0 });
    playTone({ freq: 240, type: 'square', duration: .1,  gain: .2, decay: .08, delay: .1 });
  },
  charSelect: () => playTone({ freq: 720, type: 'sine', duration: .07, gain: .18, decay: .08 }),
};