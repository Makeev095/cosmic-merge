// Usage: node shoot.js <W> <H> <mode: video|shots> <outDir> [seconds]
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const [W, H, MODE, OUT, SECS] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4], process.argv[5], Number(process.argv[6] || 27)];
const VENDOR = fs.readFileSync('/Users/makey/Desktop/Проекты/telegram-ai-miniapp/cosmic-merge/vendor/phaser.min.js');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }
  });
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.text(); if (/error|fail/i.test(t)) console.log('[page]', t); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('yandex.ru/games/sdk')) return req.abort();
    if (u.includes('phaser.min.js') && u.startsWith('http') && !u.includes('127.0.0.1')) return req.respond({ status: 200, contentType: 'application/javascript', body: VENDOR });
    req.continue();
  });

  await page.evaluateOnNewDocument((l) => { window.__LEVEL = l; }, Number(process.env.LEVEL || 2));
  await page.goto('http://127.0.0.1:8780/index.html?debug', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('MenuScene'), { timeout: 30000 });

  await page.evaluate(async () => {
    const game = window.__game;
    const { YandexSDK } = await import('/src/yandexSDK.js');
    const { Sfx } = await import('/src/audio.js');
    const { TIERS, CONFIG } = await import('/src/config.js');
    window.__sdk = YandexSDK;
    YandexSDK.data.coins = 320; YandexSDK.data.level = Number(window.__LEVEL || 2); YandexSDK.data.best = 1840;
    window.__log = []; window.__t = 0;
    const orig = Sfx.play.bind(Sfx);
    Sfx.play = (scene, key, cfg) => { window.__log.push([window.__vt !== undefined ? window.__vt : window.__t, key, (cfg && cfg.volume) || 1]); return orig(scene, key, cfg); };
    game.scene.getScene('MenuScene').scene.restart();
    game.loop.sleep();
    window.__now = performance.now();
    window.__step = () => { window.__now += 1000 / 60; window.__t += 1000 / 60; game.loop.step(window.__now); };
    const J = CONFIG.jar;
    window.__shots = {};
    window.__ai = () => {
      if (window.__noai) return;
      const s = game.scene.getScene('PlayScene');
      if (!s || !s.scene.isActive() || s.state !== 'play' || !s.held || !s.planets) return;
      const h = s.held;
      if (h.readyAt === undefined) h.readyAt = window.__t + 40 + Math.random() * 80;
      if (window.__t < h.readyAt) return;
      if (h.aimed === undefined) {
        const r = TIERS[h.tier].r;
        let best = -1e9, bx = 300;
        for (let x = J.left + r + 4; x <= J.right - r - 4; x += 12) {
          let landY = J.floor - r, contact = null;
          for (const p of s.planets) {
            const pr = TIERS[p.tier].r, dx = Math.abs(p.body.position.x - x);
            if (dx < pr + r) {
              const y = p.body.position.y - Math.sqrt((pr + r) ** 2 - dx * dx);
              if (y < landY) { landY = y; contact = p; }
            }
          }
          let sc = landY;
          if (contact) {
            if (contact.tier === h.tier) sc += 260;
            else if (contact.tier < h.tier) sc -= 120;
            else sc += 10;
          }
          // держим слева крупные, справа мелкие: лёгкое предпочтение краёв для крупных
          sc += (h.tier >= 4 ? -Math.abs(x - 180) * 0.25 : -Math.abs(x - 420) * 0.08);
          sc += Math.random() * 25;
          if (sc > best) { best = sc; bx = x; }
        }
        h.aimed = bx;
        s.aimX = bx;
      }
      if (Math.abs(h.x - h.aimed) < 6) s.dropHeld();
    };
    window.__info = () => {
      const s = game.scene.getScene('PlayScene');
      const act = game.scene.getScenes(true).map((x) => x.scene.key);
      if (!s || !s.scene.isActive()) return { act };
      return { act, state: s.state, combo: s.combo, roundMax: s.roundMax, n: s.planets ? s.planets.length : 0, merges: s.merges, score: s.score, target: s.target };
    };
    window.__audio = async (dur) => {
      const SR = 44100;
      const ctx = new OfflineAudioContext(1, Math.ceil(SR * dur), SR);
      const mus = game.cache.audio.get('music');
      if (mus) {
        const src = ctx.createBufferSource(); src.buffer = mus; src.loop = true;
        const g = ctx.createGain(); g.gain.value = 0.45; src.connect(g); g.connect(ctx.destination); src.start(0);
      }
      for (const [t, key, vol] of window.__log) {
        const b = game.cache.audio.get(key);
        if (!b || t / 1000 >= dur) continue;
        const src = ctx.createBufferSource(); src.buffer = b;
        const g = ctx.createGain(); g.gain.value = Math.min(1, vol) * 0.9; src.connect(g); g.connect(ctx.destination);
        src.start(t / 1000);
      }
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      const out = new DataView(new ArrayBuffer(44 + d.length * 2));
      const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true);
      out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, SR, true); out.setUint32(28, SR * 2, true);
      out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, d.length * 2, true);
      for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      let bin = ''; const u8 = new Uint8Array(out.buffer);
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(bin);
    };
  });

  const stepN = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) { window.__ai(); window.__step(); } }, n);
  const snap = async (name) => {
    await page.screenshot({ path: path.join(OUT, name + '.png'), type: 'png' });
    console.log('shot', name, JSON.stringify(await page.evaluate(() => window.__info())));
  };


  if (MODE === 'ad') {
    const FPS = 30, END = 15.2, total = Math.round(END * FPS);
    let started = false, shook = false, restarted = false, c = 0, d = 0, cc = 0, dd = 0;
    const add = (tier, x, y) => page.evaluate((tier, x, y) => { const s = window.__game.scene.getScene('PlayScene'); s.addPlanet(tier, x, y, true); }, tier, x, y);
    const t0 = Date.now();
    for (let frame = 0; frame < total; frame++) {
      const t = frame / FPS;
      if (!started && t >= 2.2) { await page.evaluate(() => window.__game.scene.getScene('MenuScene').startGame()); started = true; }
      if (started && !shook && t >= 8.2) { shook = true; await page.evaluate(() => window.__game.scene.getScene('PlayScene').useShake()); }
      if (!restarted && t >= 10.6) {
        restarted = true;
        await page.evaluate(() => { window.__noai = true; window.__game.scene.getScene('PlayScene').scene.restart({ level: 6 }); });
      }
      if (restarted && !c && t >= 11.2) { c = 1; await page.evaluate(() => { const s = window.__game.scene.getScene('PlayScene'); if (s.hint) { s.hint.destroy(); s.hint = null; } }); await add(7, 160, 780); await add(7, 330, 780); }
      if (restarted && !cc && t >= 12.3) { cc = 1; await add(8, 400, 420); }
      if (restarted && !d && t >= 13.4) { d = 1; await add(9, 290, 250); }
      await page.evaluate((v) => { window.__vt = v * 1000; }, t);
      const fast = t >= 2.5 && t < 10.4;
      await stepN(fast ? 4 : 2);
      await page.screenshot({ path: path.join(OUT, 'f' + String(frame).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
      if (frame % 60 === 0) console.log('frame', frame, '/', total, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(await page.evaluate(() => window.__info())));
    }
    // звук считаем с учётом синтеза: игровая часть + финальная заставка
    const b64 = await page.evaluate((dur) => window.__audio(dur), 19.8);
    fs.writeFileSync(path.join(OUT, 'audio.wav'), Buffer.from(b64, 'base64'));
    console.log('audio ok');
  } else if (MODE === 'video') {
    const FPS = 30, total = Math.round(SECS * FPS);
    let frame = 0, started = false, winT = -1, restarted = false;
    const t0 = Date.now();
    while (frame < total) {
      const t = frame / FPS;
      if (!started && t >= 2.4) {
        await page.evaluate(() => window.__game.scene.getScene('MenuScene').startGame());
        started = true;
      }
      if (started && frame % 5 === 0) {
        const info = await page.evaluate(() => window.__info());
        if (info.state === 'win' && winT < 0) { winT = t; console.log('WINT', t.toFixed(1)); }
        if (info.state === 'over') console.log('OVER', t.toFixed(1));
        if (winT >= 0 && !restarted && t >= winT + 3.8) {
          restarted = true;
          await page.evaluate(() => { const s = window.__game.scene.getScene('PlayScene'); s.scene.restart({ level: window.__sdk.data.level }); });
          console.log('restarted at', t.toFixed(1));
        }
      }
      await stepN(2);
      await page.screenshot({ path: path.join(OUT, 'f' + String(frame).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
      frame++;
      if (frame % 60 === 0) console.log('frame', frame, '/', total, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(await page.evaluate(() => window.__info())));
    }
    const b64 = await page.evaluate((d) => window.__audio(d), SECS);
    fs.writeFileSync(path.join(OUT, 'audio.wav'), Buffer.from(b64, 'base64'));
    console.log('audio ok');
  } else {
    // ---- shots ----
    await stepN(110); await snap('01_menu');
    await page.evaluate(() => window.__game.scene.getScene('MenuScene').startGame());
    await stepN(40);
    const got = {};
    let guard = 0, afterWin = -1;
    while (guard++ < 6000) {
      await stepN(3);
      const i = await page.evaluate(() => window.__info());
      if (i.state === 'play') {
        if (!got.early && i.merges >= 2 && i.n >= 5) { got.early = 1; await snap('02_early'); }
        if (!got.combo && i.combo >= 2) { await stepN(8); got.combo = 1; await snap('03_combo'); }
        if (!got.mid && i.roundMax >= 4 && i.n >= 13) { got.mid = 1; await snap('04_mid'); }
        if (!got.late && i.roundMax >= 6 && i.n >= 11) { got.late = 1; await snap('05_late'); }
      }
      if (i.state === 'win' || i.state === 'over') {
        if (afterWin < 0) afterWin = guard;
        if (guard - afterWin > 150) { await snap('06_result'); break; }
      }
    }
    console.log('got', JSON.stringify(got));
    // shop
    await page.evaluate(() => { const g = window.__game; g.scene.stop('PlayScene'); g.scene.start('MenuScene'); });
    await stepN(120);
    await page.evaluate(() => { window.__sdk.data.coins = 320; window.__game.scene.getScene('MenuScene').coinText.setText('320'); window.__game.scene.getScene('MenuScene').openShop(); });
    await new Promise((r) => setTimeout(r, 1500));
    await stepN(80);
    await new Promise((r) => setTimeout(r, 300));
    await stepN(20);
    await snap('07_shop');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
