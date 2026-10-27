const puppeteer = require('puppeteer-core');
const SEG = [
  ['Новая головоломка<br>с физикой', 'Сливай планеты — вырасти Солнце!'],
  ['Бросай планеты<br>в банку', 'Две одинаковые сливаются в большую'],
  ['Достигай цели<br>уровня', 'Открывай новые планеты и награды'],
  ['Собирай<br>комбо-цепочки', 'Больше слияний — больше очков'],
  ['Космический<br>синтез', 'Играй бесплатно в Яндекс Играх']
];
const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent;font-family:"Arial Black","Helvetica Neue",Arial,sans-serif;color:#fff}
.t{font-weight:900;text-transform:uppercase;letter-spacing:1px;text-shadow:0 4px 0 rgba(0,0,0,.55),0 0 24px rgba(0,0,0,.6);line-height:1.05}
.t b{background:linear-gradient(#fff6a8,#ff8a2b);-webkit-background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 4px 0 rgba(0,0,0,.55))}
.f{font-weight:800;text-shadow:0 3px 0 rgba(0,0,0,.6);color:#ffe9a8}
`;
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const page = await browser.newPage();
  for (let i = 0; i < SEG.length; i++) {
    const [h, f] = SEG[i];
    // вертикальное 1080x1920: шапка 150px и подвал 150px
    await page.setViewport({ width: 1080, height: 1920 });
    await page.setContent(`<style>${css}</style>
      <div style="position:absolute;left:0;top:0;width:1080px;height:150px;display:flex;align-items:center;justify-content:center;text-align:center">
        <div class="t" style="font-size:${h.includes('<br>') ? 50 : 56}px"><b>${h}</b></div></div>
      <div style="position:absolute;left:0;top:1770px;width:1080px;height:150px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 40px">
        <div class="f" style="font-size:42px">${f}</div></div>`);
    await page.screenshot({ path: `ov_v_${i}.png`, omitBackground: true });
    // горизонтальное 1920x1080: слева заголовок, справа подпись
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(`<style>${css}</style>
      <div style="position:absolute;left:40px;top:0;width:560px;height:1080px;display:flex;align-items:center;justify-content:center;text-align:center">
        <div class="t" style="font-size:58px"><b>${h}</b></div></div>
      <div style="position:absolute;left:1320px;top:0;width:560px;height:1080px;display:flex;align-items:center;justify-content:center;text-align:center">
        <div class="f" style="font-size:46px;line-height:1.25">${f}</div></div>`);
    await page.screenshot({ path: `ov_h_${i}.png`, omitBackground: true });
  }
  await browser.close();
})();
