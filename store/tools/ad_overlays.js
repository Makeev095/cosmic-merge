const puppeteer = require('puppeteer-core');
const fs = require('fs');
const icon = 'data:image/png;base64,' + fs.readFileSync('/Users/makey/Desktop/Проекты/telegram-ai-miniapp/cosmic-merge/store/icon-512x512.png').toString('base64');
const SEG = [
  'Сливай одинаковые<br>планеты',
  'Бустеры спасут<br>от переполнения',
  'Цепная<br>реакция!',
  'Вырасти<br>Солнце!'
];
const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent;font-family:"Arial Black","Helvetica Neue",Arial,sans-serif;color:#fff}
.t{font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;line-height:1.05;text-shadow:0 5px 0 rgba(0,0,0,.6),0 0 30px rgba(0,0,0,.7)}
.t b{background:linear-gradient(#fff6a8,#ff8a2b);-webkit-background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 5px 0 rgba(0,0,0,.6))}
`;
const card = (w, h, vertical) => `<style>${css}
body{width:${w}px;height:${h}px;background:radial-gradient(circle at 50% 45%,#1d2f6b 0%,#0b1233 55%,#05070f 100%);display:flex;flex-direction:${vertical ? 'column' : 'row'};align-items:center;justify-content:center;gap:${vertical ? 50 : 90}px;overflow:hidden;position:relative}
.glow{position:absolute;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,60,.35),transparent 65%);left:50%;top:${vertical ? '38%' : '50%'};transform:translate(-50%,-50%)}
img{width:${vertical ? 520 : 420}px;height:${vertical ? 520 : 420}px;border-radius:110px;box-shadow:0 0 80px rgba(255,190,60,.55);position:relative}
.s{font-weight:800;color:#ffe9a8;text-shadow:0 3px 0 rgba(0,0,0,.6);text-align:center;font-size:${vertical ? 52 : 46}px;line-height:1.25;position:relative}
.badge{display:inline-block;margin-top:26px;padding:14px 34px;border-radius:60px;background:linear-gradient(#4de27a,#1fa84a);color:#fff;font-weight:900;font-size:${vertical ? 56 : 48}px;text-shadow:0 3px 0 rgba(0,0,0,.35);box-shadow:0 8px 0 #146f31}
</style><div class="glow"></div>
<img src="${icon}">
<div style="position:relative"><div class="t" style="font-size:${vertical ? 96 : 84}px"><b>Космический<br>синтез</b></div>
<div class="s" style="margin-top:28px">Головоломка с физикой<br>Играй бесплатно в Яндекс Играх</div>
<div style="text-align:center"><span class="badge">ИГРАТЬ</span></div></div>`;
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const page = await browser.newPage();
  for (let i = 0; i < SEG.length; i++) {
    await page.setViewport({ width: 1080, height: 1920 });
    await page.setContent(`<style>${css}</style><div style="position:absolute;left:0;top:800px;width:1080px;height:260px;display:flex;align-items:center;justify-content:center"><div class="t" style="font-size:84px"><b>${SEG[i]}</b></div></div>`);
    await page.screenshot({ path: `ad_ov_v_${i}.png`, omitBackground: true });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(`<style>${css}</style>
      <div style="position:absolute;left:40px;top:0;width:600px;height:1080px;display:flex;align-items:center;justify-content:center"><div class="t" style="font-size:68px"><b>${SEG[i]}</b></div></div>
      <div style="position:absolute;left:1280px;top:0;width:600px;height:1080px;display:flex;align-items:center;justify-content:center"><div class="t" style="font-size:44px;line-height:1.25"><b>Космический<br>синтез</b></div></div>`);
    await page.screenshot({ path: `ad_ov_h_${i}.png`, omitBackground: true });
  }
  await page.setViewport({ width: 1080, height: 1920 });
  await page.setContent(card(1080, 1920, true));
  await page.screenshot({ path: 'ec_v.png' });
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setContent(card(1920, 1080, false));
  await page.screenshot({ path: 'ec_h.png' });
  await browser.close();
})();
