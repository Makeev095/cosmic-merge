import { DESIGN, t } from '../config.js';
import { YandexSDK } from '../yandexSDK.js';
import { Sfx } from '../audio.js';
import { fitCamera, makeText, buildTextureJobs, gradientText } from '../ui.js';

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

// Прелоадер: инициализирует Yandex SDK, загружает сохранения, процедурно рисует графику и звук.
export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    fitCamera(this);
    const { W } = DESIGN;

    this.target = 0;
    this.shown = 0;
    this.finished = false;
    this.leaving = false;

    this.add.rectangle(W / 2, 500, 5000, 5000, 0x0b0f12);
    this.logo = this.add.graphics();
    this.bar = this.add.graphics();

    this.title = makeText(this, W / 2, 230, 'COSMIC MERGE', 54, '#ffffff', { sw: 8 });
    gradientText(this.title, '#fff6a8', '#ff9a3c');
    this.status = makeText(this, W / 2, 640, t('loading') + '…', 26, '#9fb4d9');
    this.percent = makeText(this, W / 2, 595, '0%', 30, '#ffffff');

    this.bootstrap().catch((e) => {
      console.error('[Boot] failed', e);
      this.status.setText('Error: ' + (e && e.message ? e.message : e));
    });
  }

  async bootstrap() {
    const jobs = buildTextureJobs(this);
    // вес: SDK=3, сохранения=2, каждая текстура=1, аудио=3
    const total = 3 + 2 + jobs.length + 3;
    let done = 0;
    const step = (w) => { done += w; this.target = Math.min(1, done / total); };

    await YandexSDK.init(this.game);
    this.status.setText(t('loading') + '…');
    step(3);

    await YandexSDK.loadData();
    await YandexSDK.restorePurchases(); // подхватываем недообработанные покупки
    step(2);

    for (const job of jobs) {
      job();
      step(1);
      await nextFrame();
    }

    Sfx.init(this.game);
    YandexSDK.applyAudioState();
    step(3);

    this.finished = true;
  }

  update(time, delta) {
    this.shown += (this.target - this.shown) * Math.min(1, delta * 0.008);
    this.drawLogo(time);
    this.drawBar(time);
    this.percent.setText(Math.round(this.shown * 100) + '%');

    if (this.finished && this.shown > 0.985 && !this.leaving) {
      this.leaving = true;
      this.cameras.main.fadeOut(250, 11, 15, 18);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    }
  }

  drawLogo(time) {
    const g = this.logo;
    const cx = DESIGN.W / 2, cy = 400;
    g.clear();
    g.lineStyle(2, 0x2c3b5c, 0.9);
    g.strokeEllipse(cx, cy, 240, 90);
    g.fillStyle(0xffd93b, 1); g.fillCircle(cx, cy, 34 + Math.sin(time / 250) * 2);
    g.fillStyle(0xffd93b, 0.18); g.fillCircle(cx, cy, 58 + Math.sin(time / 250) * 4);
    const cols = [0x2f9bf0, 0xe5533d, 0xc58bff];
    cols.forEach((c, i) => {
      const a = time / 700 + (i * Math.PI * 2) / 3;
      const px = cx + Math.cos(a) * 120, py = cy + Math.sin(a) * 45;
      g.fillStyle(c, 1); g.fillCircle(px, py, 14 + Math.sin(a) * 2);
      g.fillStyle(0xffffff, 0.45); g.fillCircle(px - 4, py - 4, 4);
    });
  }

  drawBar() {
    const g = this.bar;
    const w = 420, h = 28, x = DESIGN.W / 2 - w / 2, y = 530;
    g.clear();
    g.fillStyle(0x161f33, 1); g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(3, 0x3a4c73, 1); g.strokeRoundedRect(x, y, w, h, 14);
    const fw = Math.max(h, w * this.shown);
    g.fillStyle(0x1a8cff, 1); g.fillRoundedRect(x, y, fw, h, 14);
    g.fillStyle(0x6df3ff, 0.55); g.fillRoundedRect(x + 5, y + 4, Math.max(4, fw - 10), 8, 4);
    g.fillStyle(0x6df3ff, 0.35); g.fillCircle(x + fw - 6, y + h / 2, 16);
  }
}
