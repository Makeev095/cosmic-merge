// Процедурный звук: все эффекты и музыка синтезируются в AudioBuffer и кладутся в кэш Phaser.
// Благодаря этому не нужно загружать файлы, а `game.sound.mute` работает для всего звука.

const TAU = Math.PI * 2;
const RATE = 22050;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // пентатоника для звуков слияния
const semis = (base, s) => base * Math.pow(2, s / 12);

function synth(dur, fn, rate = RATE) {
  const n = Math.floor(dur * rate);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = fn(i / rate, i);
  return d;
}

export const Sfx = {
  ready: false,
  music: null,

  init(game) {
    const ctx = game.sound && game.sound.context;
    if (!ctx) return; // NoAudio — просто работаем без звука
    const add = (key, data, rate = RATE) => {
      const b = ctx.createBuffer(1, data.length, rate);
      b.getChannelData(0).set(data);
      game.cache.audio.add(key, b);
    };

    // бросок
    let ph = 0;
    add('drop', synth(0.14, (t) => {
      ph += TAU * (170 * Math.exp(-t * 8) + 70) / RATE;
      return Math.sin(ph) * Math.exp(-t * 22) * 0.8 + (t < 0.006 ? (Math.random() - 0.5) * 0.4 : 0);
    }));

    // слияние: нота растёт с номером планеты
    for (let i = 0; i < SCALE.length; i++) {
      const f = semis(261.63, SCALE[i]);
      add('m' + i, synth(0.45, (t) => {
        const a = Math.exp(-t * 7) * Math.min(1, t * 400) * 0.5;
        return (Math.sin(TAU * f * t * (1 + 0.02 * Math.exp(-t * 30))) +
          0.4 * Math.sin(TAU * 2 * f * t) + 0.2 * Math.sin(TAU * 3 * f * t)) * a;
      }));
    }

    add('click', synth(0.07, (t) => Math.sin(TAU * 880 * t) * Math.exp(-t * 40) * 0.5));

    add('coin', synth(0.3, (t) => {
      const f = t < 0.09 ? 988 : 1319;
      const lt = t < 0.09 ? t : t - 0.09;
      return Math.sin(TAU * f * lt) * Math.exp(-lt * 16) * 0.5;
    }));

    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    add('win', synth(1.4, (t) => {
      let s = 0;
      for (let k = 0; k < arp.length; k++) {
        const tt = t - k * 0.11;
        if (tt > 0) s += Math.sin(TAU * arp[k] * tt) * Math.exp(-tt * 3.5) * 0.28;
      }
      return s;
    }));

    let lp = 0;
    add('lose', synth(0.9, (t) => {
      lp += TAU * 330 * Math.exp(-t * 1.2) / RATE;
      return (2 / Math.PI) * Math.asin(Math.sin(lp)) * Math.exp(-t * 3) * 0.5;
    }));

    let y = 0;
    add('shake', synth(0.35, (t) => {
      y += ((Math.random() * 2 - 1) - y) * 0.25;
      return y * Math.exp(-t * 9) * 0.9;
    }));

    let rp = 0;
    add('revive', synth(0.55, (t) => {
      rp += TAU * (300 + 900 * t) / RATE;
      return Math.sin(rp) * Math.sin(Math.PI * Math.min(1, t / 0.55)) * 0.4;
    }));

    // Фоновая музыка: 12 секунд, зацикленная, мягкий пэд + арпеджио
    const MR = 16000;
    const chords = [
      [110, 164.81, 220, 261.63],   // Am
      [87.31, 130.81, 174.61, 220], // F
      [130.81, 196, 261.63, 329.63],// C
      [98, 146.83, 196, 246.94]     // G
    ];
    const total = 12 * MR;
    const m = new Float32Array(total);
    for (let c = 0; c < 4; c++) {
      const start = c * 3 * MR;
      const len = 5 * MR;
      for (let i = 0; i < len; i++) {
        const env = Math.pow(Math.sin(Math.PI * i / len), 2);
        const tt = i / MR;
        let s = 0;
        for (const f of chords[c]) s += Math.sin(TAU * f * tt) + 0.5 * Math.sin(TAU * f * 1.004 * tt);
        m[(start + i) % total] += s * env * 0.04;
      }
      for (let k = 0; k < 8; k++) {
        const f = chords[c][(k * 2 + 1) % 4] * 2;
        const st = start + Math.floor(k * 0.375 * MR);
        const plen = Math.floor(0.5 * MR);
        for (let i = 0; i < plen; i++) {
          const tt = i / MR;
          m[(st + i) % total] += Math.sin(TAU * f * tt) * Math.exp(-tt * 7) * 0.05;
        }
      }
    }
    add('music', m, MR);
    this.ready = true;
  },

  play(scene, key, cfg) {
    if (!scene.cache.audio.exists(key)) return;
    scene.sound.play(key, cfg);
  },

  startMusic(game) {
    if (this.music || !game.cache.audio.exists('music')) return;
    this.music = game.sound.add('music', { loop: true, volume: 0.85 });
    this.music.play();
  }
};
