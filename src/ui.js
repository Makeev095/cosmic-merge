// Общие UI-хелперы: процедурные текстуры, текст, кнопки, фон, частицы, адаптивная камера.

import { DESIGN, TIERS } from './config.js';
import { Sfx } from './audio.js';

export const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';

// ---------- Адаптивность ----------
// Весь игровой мир живёт в координатах 600x1000. Камера масштабирует и центрирует его
// при любом размере окна (portrait / landscape) — без перезагрузки и пересборки физики.
export function fitCamera(scene, transparent = false) {
  const apply = () => {
    const cam = scene.cameras.main;
    const w = scene.scale.width;
    const h = scene.scale.height;
    cam.setSize(w, h);
    cam.setZoom(Math.min(w / DESIGN.W, h / DESIGN.H));
    cam.centerOn(DESIGN.W / 2, DESIGN.H / 2);
  };
  scene.cameras.main.setBackgroundColor(transparent ? 'rgba(0,0,0,0)' : '#0B0F12');
  apply();
  scene.scale.on('resize', apply);
  scene.events.once('shutdown', () => scene.scale.off('resize', apply));
}

// ---------- Цвета ----------
function rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h, amt, alpha = 1) {
  const [r, g, b] = rgb(h);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const m = (v) => Math.round((target - v) * p + v);
  return `rgba(${m(r)},${m(g)},${m(b)},${alpha})`;
}

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Рисование планет ----------
const SS = 2; // supersampling: текстура вдвое больше, чем на экране

function drawPlanet(ctx, size, T, idx) {
  const c = size / 2;
  const R = c - 2;
  let seed = idx * 977 + 13;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const circle = (cx, cy, r) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); };
  const TAU = Math.PI * 2;

  const sphere = (cx, cy, r, col) => {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.08, cx, cy, r);
    g.addColorStop(0, shade(col, 0.5));
    g.addColorStop(0.5, col);
    g.addColorStop(1, shade(col, -0.5));
    ctx.fillStyle = g;
    circle(cx, cy, r); ctx.fill();
  };

  const withClip = (cx, cy, r, fn) => { ctx.save(); circle(cx, cy, r); ctx.clip(); fn(); ctx.restore(); };

  const bands = (cx, cy, r, col, count, alpha) => withClip(cx, cy, r, () => {
    ctx.translate(cx, cy);
    ctx.rotate(-0.25);
    for (let i = -count; i <= count; i++) {
      ctx.fillStyle = i % 2 ? shade(col, 0.35, alpha) : shade(col, -0.35, alpha);
      const h = (r * 2) / (count * 1.6);
      ctx.fillRect(-r * 1.2, i * h * 0.9, r * 2.4, h * (0.5 + rnd() * 0.5));
    }
  });

  const shading = (cx, cy, r) => withClip(cx, cy, r, () => {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  });

  const rim = (cx, cy, r) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1.5, r * 0.035);
    circle(cx, cy, r - 1); ctx.stroke();
  };

  switch (T.deco) {
    case 'ring': {
      const ringPath = (rx, ry, a0, a1) => { ctx.beginPath(); ctx.ellipse(c, c, rx, ry, -0.4, a0, a1); ctx.stroke(); };
      const drawRing = (a0, a1) => {
        ctx.strokeStyle = shade('#ffe08a', 0, 0.95); ctx.lineWidth = R * 0.14; ringPath(R * 0.97, R * 0.3, a0, a1);
        ctx.strokeStyle = shade('#b07a2a', 0, 0.8); ctx.lineWidth = R * 0.05; ringPath(R * 0.8, R * 0.24, a0, a1);
      };
      drawRing(Math.PI, TAU);
      sphere(c, c, R * 0.66, T.color);
      bands(c, c, R * 0.66, T.color, 5, 0.35);
      shading(c, c, R * 0.66);
      drawRing(0, Math.PI);
      break;
    }
    case 'sun': {
      const g = ctx.createRadialGradient(c, c, 0, c, c, R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, shade(T.color, 0.65));
      g.addColorStop(0.75, T.color);
      g.addColorStop(1, shade(T.color, -0.3));
      ctx.fillStyle = g; circle(c, c, R); ctx.fill();
      withClip(c, c, R, () => {
        for (let i = 0; i < 9; i++) {
          const a = rnd() * TAU, d = R * (0.25 + rnd() * 0.6);
          ctx.strokeStyle = shade(T.color, 0.7, 0.35);
          ctx.lineWidth = R * 0.05;
          ctx.beginPath(); ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.1 + rnd() * 0.15), rnd() * TAU, rnd() * TAU + 2); ctx.stroke();
        }
        for (let i = 0; i < 4; i++) {
          const a = rnd() * TAU, d = R * (0.3 + rnd() * 0.5);
          ctx.fillStyle = shade(T.color, -0.55, 0.45);
          circle(c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.04 + rnd() * 0.05)); ctx.fill();
        }
      });
      break;
    }
    default: {
      sphere(c, c, R, T.color);
      if (T.deco === 'craters') {
        withClip(c, c, R, () => {
          for (let i = 0; i < 7; i++) {
            const a = rnd() * TAU, d = R * rnd() * 0.8, r = R * (0.08 + rnd() * 0.14);
            const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
            ctx.fillStyle = shade(T.color, -0.45, 0.45); circle(x, y, r); ctx.fill();
            ctx.strokeStyle = shade(T.color, 0.5, 0.45); ctx.lineWidth = r * 0.25; circle(x - r * 0.1, y - r * 0.1, r); ctx.stroke();
          }
        });
      } else if (T.deco === 'bands') {
        bands(c, c, R, T.color, 6, 0.38);
      } else if (T.deco === 'storm') {
        bands(c, c, R, T.color, 7, 0.5);
        withClip(c, c, R, () => {
          ctx.fillStyle = 'rgba(190,50,35,0.85)';
          ctx.beginPath(); ctx.ellipse(c + R * 0.25, c + R * 0.25, R * 0.2, R * 0.12, -0.2, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,220,200,0.6)'; ctx.lineWidth = R * 0.03; ctx.stroke();
        });
      } else if (T.deco === 'earth') {
        withClip(c, c, R, () => {
          ctx.fillStyle = '#58c25f';
          for (let i = 0; i < 6; i++) {
            const a = rnd() * TAU, d = R * rnd() * 0.65;
            ctx.beginPath();
            ctx.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.16 + rnd() * 0.2), R * (0.1 + rnd() * 0.15), rnd() * 3, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.ellipse(c + (rnd() - 0.5) * R * 1.4, c + (rnd() - 0.5) * R * 1.4, R * (0.15 + rnd() * 0.2), R * 0.06, rnd() * 3, 0, TAU);
            ctx.fill();
          }
        });
      } else if (T.deco === 'dust') {
        withClip(c, c, R, () => {
          for (let i = 0; i < 14; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.5})`;
            circle(c + (rnd() - 0.5) * R * 1.6, c + (rnd() - 0.5) * R * 1.6, R * (0.03 + rnd() * 0.06)); ctx.fill();
          }
        });
      }
      shading(c, c, R);
    }
  }
  rim(c, c, R);
}

// ---------- Генерация всех текстур (списком задач — для прогресс-бара) ----------
export function buildTextureJobs(scene) {
  const jobs = [];
  const put = (key, cv) => { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, cv); };

  // Свечение / частица
  jobs.push(() => {
    const [cv, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    put('spark', cv);
  });

  // Ударная волна
  jobs.push(() => {
    const [cv, ctx] = canvas(256, 256);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.shadowColor = '#fff'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(128, 128, 100, 0, Math.PI * 2); ctx.stroke();
    put('ring', cv);
  });

  // Фон туманности
  jobs.push(() => {
    const [cv, ctx] = canvas(512, 512);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#0d1738'); g.addColorStop(0.5, '#0a0f24'); g.addColorStop(1, '#05070f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    const blob = (x, y, r, col) => {
      const b = ctx.createRadialGradient(x, y, 0, x, y, r);
      b.addColorStop(0, col); b.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = b; ctx.fillRect(0, 0, 512, 512);
    };
    blob(150, 120, 220, 'rgba(120,60,200,0.32)');
    blob(400, 300, 240, 'rgba(30,150,220,0.26)');
    blob(200, 460, 200, 'rgba(220,60,140,0.16)');
    put('bg', cv);
  });

  // Монета
  jobs.push(() => {
    const [cv, ctx] = canvas(96, 96);
    const g = ctx.createRadialGradient(36, 32, 4, 48, 48, 46);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.6, '#ffc72c'); g.addColorStop(1, '#c77a00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(48, 48, 45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5200'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(48, 48, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#b86f00';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 9 : 22;
      ctx.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    put('coin', cv);
  });

  // Кнопки
  const btnKinds = {
    green: ['#8dff7a', '#16a34a', '#0b5d28'],
    blue: ['#7fd4ff', '#1a73e8', '#0b3d91'],
    gold: ['#ffe58a', '#f5a100', '#a15c00'],
    red: ['#ff9a9a', '#e5383b', '#8a1114'],
    dark: ['#51627f', '#26324a', '#121a2b']
  };
  Object.keys(btnKinds).forEach((k) => jobs.push(() => {
    const [top, bot, edge] = btnKinds[k];
    const W = 640, H = 168;
    const [cv, ctx] = canvas(W, H);
    rr(ctx, 6, 22, W - 12, H - 28, 64); ctx.fillStyle = edge; ctx.fill();
    rr(ctx, 6, 6, W - 12, H - 36, 64);
    const g = ctx.createLinearGradient(0, 6, 0, H - 30);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); rr(ctx, 6, 6, W - 12, H - 36, 64); ctx.clip();
    const gl = ctx.createLinearGradient(0, 6, 0, 80);
    gl.addColorStop(0, 'rgba(255,255,255,0.5)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 6, W, 74);
    ctx.restore();
    rr(ctx, 6, 6, W - 12, H - 36, 64); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4; ctx.stroke();
    put('btn_' + k, cv);
  }));

  // Круглая кнопка + иконки
  jobs.push(() => {
    const [cv, ctx] = canvas(160, 160);
    const g = ctx.createLinearGradient(0, 0, 0, 160);
    g.addColorStop(0, '#4b5f86'); g.addColorStop(1, '#1b2640');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(80, 80, 74, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,220,255,0.7)'; ctx.lineWidth = 6; ctx.stroke();
    put('rbtn', cv);
  });
  const icon = (key, draw) => jobs.push(() => {
    const [cv, ctx] = canvas(128, 128);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    draw(ctx);
    put(key, cv);
  });
  const speaker = (ctx) => {
    ctx.beginPath(); ctx.moveTo(18, 48); ctx.lineTo(42, 48); ctx.lineTo(70, 24); ctx.lineTo(70, 104); ctx.lineTo(42, 80); ctx.lineTo(18, 80); ctx.closePath(); ctx.fill();
  };
  icon('ic_snd_on', (ctx) => {
    speaker(ctx);
    ctx.beginPath(); ctx.arc(70, 64, 22, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(70, 64, 40, -0.9, 0.9); ctx.stroke();
  });
  icon('ic_snd_off', (ctx) => {
    speaker(ctx);
    ctx.strokeStyle = '#ff6b6b';
    ctx.beginPath(); ctx.moveTo(86, 46); ctx.lineTo(116, 82); ctx.moveTo(116, 46); ctx.lineTo(86, 82); ctx.stroke();
  });
  icon('ic_home', (ctx) => {
    ctx.beginPath(); ctx.moveTo(64, 20); ctx.lineTo(112, 64); ctx.lineTo(98, 64); ctx.lineTo(98, 108); ctx.lineTo(30, 108); ctx.lineTo(30, 64); ctx.lineTo(16, 64); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#26324a'; ctx.fillRect(54, 74, 20, 34);
  });
  icon('ic_video', (ctx) => {
    ctx.beginPath(); ctx.moveTo(34, 20); ctx.lineTo(104, 64); ctx.lineTo(34, 108); ctx.closePath(); ctx.fill(); ctx.stroke();
  });

  icon('ic_noads', (ctx) => {
    ctx.beginPath(); ctx.moveTo(34, 24); ctx.lineTo(100, 64); ctx.lineTo(34, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.moveTo(26, 26); ctx.lineTo(102, 102); ctx.stroke();
  });

  // Панель результатов
  jobs.push(() => {
    const [cv, ctx] = canvas(600, 760);
    rr(ctx, 8, 8, 584, 744, 64);
    const g = ctx.createLinearGradient(0, 0, 0, 760);
    g.addColorStop(0, '#1d2e55'); g.addColorStop(1, '#0c1226');
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = '#5ee7ff'; ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(94,231,255,0.8)'; ctx.lineWidth = 5; ctx.stroke();
    put('panel', cv);
  });

  // Планеты
  TIERS.forEach((T, i) => jobs.push(() => {
    const size = Math.ceil(T.r * 2 * SS);
    const [cv, ctx] = canvas(size, size);
    drawPlanet(ctx, size, T, i);
    put('p' + i, cv);
  }));

  return jobs;
}

// ---------- Текст ----------
export function makeText(scene, x, y, str, size, color = '#ffffff', o = {}) {
  const tx = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: size + 'px',
    fontStyle: 'bold',
    color,
    stroke: o.stroke || '#0a1022',
    strokeThickness: o.sw !== undefined ? o.sw : Math.max(3, Math.round(size / 8)),
    align: o.align || 'center',
    wordWrap: o.wrap ? { width: o.wrap } : undefined
  });
  tx.setOrigin(o.ox !== undefined ? o.ox : 0.5, o.oy !== undefined ? o.oy : 0.5);
  tx.setResolution(2);
  if (o.shadow !== false) tx.setShadow(0, 3, '#000000', 6, false, true);
  return tx;
}

export function gradientText(tx, top, bottom) {
  const g = tx.context.createLinearGradient(0, 0, 0, tx.height);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  tx.setFill(g);
  return tx;
}

// ---------- Кнопки ----------
export function makeButton(scene, x, y, label, kind, onClick, o = {}) {
  const w = o.w || 340, h = o.h || 88, size = o.size || 34;
  const c = scene.add.container(x, y);
  const body = scene.add.container(0, 0);
  const img = scene.add.image(0, 0, 'btn_' + kind).setDisplaySize(w, h);
  const tx = makeText(scene, o.icon ? h * 0.3 : 0, -h * 0.05, label, size);
  body.add([img, tx]);
  if (o.icon) body.add(scene.add.image(-w / 2 + h * 0.72, -h * 0.05, o.icon).setDisplaySize(h * 0.5, h * 0.5));
  c.add(body);

  const fit = () => {
    tx.setScale(1);
    const max = w - (o.icon ? h * 1.15 : 36);
    if (tx.width > max) tx.setScale(max / tx.width);
  };
  fit();

  c.setSize(w, h).setInteractive({ useHandCursor: true });
  let enabled = true, pressed = false;
  const release = () => scene.tweens.add({ targets: c, scale: 1, duration: 90, ease: 'Back.Out' });
  c.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    scene.tweens.add({ targets: c, scale: 0.93, duration: 70 });
  });
  c.on('pointerup', () => {
    if (!pressed) return;
    pressed = false; release();
    if (enabled) { Sfx.play(scene, 'click', { volume: 0.6 }); onClick(); }
  });
  c.on('pointerout', () => { if (pressed) { pressed = false; release(); } });

  if (o.pulse) scene.tweens.add({ targets: body, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

  c.setLabel = (s) => { tx.setText(s); fit(); return c; };
  c.setEnabled = (v) => { enabled = v; body.setAlpha(v ? 1 : 0.5); return c; };
  return c;
}

export function makeRoundButton(scene, x, y, iconKey, onClick, size = 72) {
  const c = scene.add.container(x, y);
  const base = scene.add.image(0, 0, 'rbtn').setDisplaySize(size, size);
  const ic = scene.add.image(0, 0, iconKey).setDisplaySize(size * 0.52, size * 0.52);
  c.add([base, ic]);
  c.setSize(size, size).setInteractive({ useHandCursor: true });
  let pressed = false;
  c.on('pointerdown', () => { pressed = true; scene.tweens.add({ targets: c, scale: 0.9, duration: 70 }); });
  c.on('pointerup', () => {
    if (!pressed) return;
    pressed = false; scene.tweens.add({ targets: c, scale: 1, duration: 90, ease: 'Back.Out' });
    Sfx.play(scene, 'click', { volume: 0.6 }); onClick();
  });
  c.on('pointerout', () => { pressed = false; c.setScale(1); });
  c.setIcon = (k) => { ic.setTexture(k); return c; };
  return c;
}

// ---------- Эффекты ----------
export function burst(scene, x, y, tint, count = 18, o = {}) {
  const em = scene.add.particles(x, y, 'spark', {
    speed: { min: 60, max: o.speed || 280 },
    angle: { min: 0, max: 360 },
    lifespan: { min: 350, max: 750 },
    scale: { start: o.scale || 0.55, end: 0 },
    alpha: { start: 1, end: 0 },
    gravityY: 220,
    tint,
    blendMode: 'ADD',
    emitting: false
  }).setDepth(30);
  em.explode(count);
  scene.time.delayedCall(950, () => em.destroy());
}

export function shock(scene, x, y, tint, size) {
  const r = scene.add.image(x, y, 'ring').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(29).setDisplaySize(size * 0.3, size * 0.3);
  scene.tweens.add({
    targets: r, displayWidth: size * 1.6, displayHeight: size * 1.6, alpha: 0,
    duration: 420, ease: 'Cubic.Out', onComplete: () => r.destroy()
  });
}

export function floatText(scene, x, y, str, color = '#ffffff', size = 34) {
  const tx = makeText(scene, x, y, str, size, color).setDepth(60);
  scene.tweens.add({
    targets: tx, y: y - 90, alpha: 0, scale: 1.25, duration: 900, ease: 'Cubic.Out',
    onComplete: () => tx.destroy()
  });
  return tx;
}

export function toast(scene, str) {
  const tx = makeText(scene, DESIGN.W / 2, 540, str, 30, '#ffffff', { wrap: 500 }).setDepth(300);
  scene.tweens.add({
    targets: tx, alpha: 0, y: 490, delay: 1000, duration: 500,
    onComplete: () => tx.destroy()
  });
}

// ---------- Фон ----------
export function addBackground(scene) {
  scene.add.image(DESIGN.W / 2, DESIGN.H / 2, 'bg').setDisplaySize(5000, 5000).setDepth(-20);
  scene.add.particles(0, 0, 'spark', {
    x: { min: -1300, max: 1900 },
    y: { min: -900, max: 1900 },
    lifespan: { min: 2500, max: 5500 },
    frequency: 35,
    quantity: 1,
    scale: { min: 0.05, max: 0.22 },
    alpha: { values: [0, 0.9, 0] },
    tint: [0xffffff, 0xaad4ff, 0xffe9b0],
    blendMode: 'ADD'
  }).setDepth(-19);
}
