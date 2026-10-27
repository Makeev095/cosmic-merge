const puppeteer = require('puppeteer-core');
const fs = require('fs');
const VENDOR = fs.readFileSync('/Users/makey/Desktop/Проекты/telegram-ai-miniapp/cosmic-merge/vendor/phaser.min.js');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 600, height: 1000 } });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => { const u = req.url();
    if (u.includes('yandex.ru/games/sdk')) return req.abort();
    if (u.includes('phaser.min.js') && !u.includes('127.0.0.1')) return req.respond({ status: 200, contentType: 'application/javascript', body: VENDOR });
    req.continue(); });
  await page.goto('http://127.0.0.1:8780/index.html?debug');
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('MenuScene'), { timeout: 30000 });
  const out = await page.evaluate(() => {
    const g = window.__game, img = (k) => g.textures.get(k).getSourceImage();
    const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      const bg = x.createRadialGradient(128, 110, 10, 128, 128, 190); bg.addColorStop(0, '#2b4a9a'); bg.addColorStop(1, '#0b1233');
      x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, 256, 256, 52); x.fill();
      const gl = x.createRadialGradient(128, 128, 5, 128, 128, 120); gl.addColorStop(0, 'rgba(255,200,60,.45)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
      x.fillStyle = gl; x.fillRect(0, 0, 256, 256); draw(x); return c.toDataURL('image/png'); };
    const coin = img('coin'), noads = img('ic_noads');
    const put = (x, im, cx, cy, s) => x.drawImage(im, cx - s / 2, cy - s / 2, s, s);
    return {
      coins_500: mk((x) => { put(x, coin, 128, 128, 150); }),
      coins_2000: mk((x) => { put(x, coin, 92, 150, 105); put(x, coin, 168, 150, 105); put(x, coin, 130, 92, 115); }),
      coins_6000: mk((x) => { [[70, 170], [128, 180], [186, 170], [98, 120], [158, 120], [128, 66]].forEach(([a, b]) => put(x, coin, a, b, 92)); }),
      no_ads: mk((x) => { put(x, noads, 128, 128, 170); }),
      default: mk((x) => { put(x, coin, 128, 128, 150); })
    };
  });
  fs.mkdirSync('/Users/makey/Desktop/Проекты/telegram-ai-miniapp/cosmic-merge/store/iap-icons', { recursive: true });
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(`/Users/makey/Desktop/Проекты/telegram-ai-miniapp/cosmic-merge/store/iap-icons/${k === 'default' ? 'default_icon' : k}.png`, Buffer.from(v.split(',')[1], 'base64'));
  await browser.close();
})();
