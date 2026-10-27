import { CONFIG, DESIGN, t } from '../config.js';
import { YandexSDK } from '../yandexSDK.js';
import { Sfx } from '../audio.js';
import { fitCamera, makeText, gradientText, makeButton, toast, floatText } from '../ui.js';

// Магазин внутриигровых покупок. Открывается поверх меню (scene.launch), меню на паузе.
export class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  init(data) { this.parentKey = (data && data.parent) || 'MenuScene'; }

  create() {
    fitCamera(this, true);
    const { W } = DESIGN;
    this.rows = [];
    this.buying = false;

    const dim = this.add.rectangle(W / 2, 500, 5000, 5000, 0x03060c, 0.78).setInteractive();
    this.add.image(W / 2, 505, 'panel').setDisplaySize(540, 780);

    const title = makeText(this, W / 2, 175, t('shop'), 54, '#ffffff', { sw: 9 });
    gradientText(title, '#fff6a8', '#ff9a1f');

    this.coinIcon = this.add.image(W / 2 - 60, 232, 'coin').setDisplaySize(36, 36);
    this.coinText = makeText(this, W / 2 - 34, 232, String(YandexSDK.data.coins), 30, '#ffe27a', { ox: 0 });

    this.info = makeText(this, W / 2, 500, t('shopLoading'), 28, '#9fb4d9', { wrap: 440 });

    this.closeBtn = makeButton(this, W / 2, 855, t('close'), 'dark', () => this.close(), { w: 300, h: 70, size: 28 });

    this.loadCatalog();
  }

  async loadCatalog() {
    if (!YandexSDK.paymentsAvailable) { this.info.setText(t('payUnavailable')); return; }
    let catalog;
    try { catalog = await YandexSDK.getCatalog(); }
    catch (e) { console.warn('[Shop] catalog failed', e); this.info.setText(t('payUnavailable')); return; }
    if (!this.scene.isActive()) return;
    if (!Object.keys(catalog).length) { this.info.setText(t('payUnavailable')); return; }
    // Иконка портальной валюты приходит из SDK — подгружаем её один раз
    const iconUrl = Object.values(catalog).map((c) => c.icon).find(Boolean);
    if (iconUrl && !this.textures.exists('curr_icon')) {
      await new Promise((resolve) => {
        const done = () => { this.load.off('complete', done); this.load.off('loaderror', done); resolve(); };
        this.load.once('complete', done);
        this.load.once('loaderror', done);
        this.load.setCORS && (this.load.crossOrigin = 'anonymous');
        this.load.image('curr_icon', iconUrl);
        this.load.start();
      });
      if (!this.scene.isActive()) return;
    }
    this.hasCurrIcon = this.textures.exists('curr_icon');
    this.info.destroy();

    let y = 330;
    for (const prod of CONFIG.shop.products) {
      const item = catalog[prod.id];
      if (!item) continue; // товар не заведён в консоли — не показываем
      this.addRow(prod, item, y);
      y += 118;
    }
  }

  addRow(prod, item, y) {
    const W = DESIGN.W;
    const card = this.add.image(W / 2, y, 'btn_dark').setDisplaySize(480, 104).setAlpha(0.9);
    const isAds = prod.type === 'noads';
    this.add.image(W / 2 - 190, y, isAds ? 'ic_noads' : 'coin').setDisplaySize(54, 54);
    makeText(this, W / 2 - 150, y - (isAds ? 20 : 14), isAds ? t('noAds') : t('coinsN', { n: prod.coins }), 28, '#ffffff', { ox: 0, oy: 0.5 });
    makeText(this, W / 2 - 150, y + (isAds ? 14 : 20), isAds ? t('noAdsDesc') : (prod.badge || ''), isAds ? 15 : 17,
      isAds ? '#9fb4d9' : '#7dff9a', { ox: 0, oy: 0.5, align: 'left', wrap: 205, sw: 2 });
    const owned = isAds && YandexSDK.data.noAds;
    // цена: число + иконка валюты из SDK; если иконка не загрузилась — "<цена> <код валюты>" как есть
    const withIcon = !owned && this.hasCurrIcon && item.priceValue;
    const btn = makeButton(this, W / 2 + 140, y, owned ? t('owned') : (withIcon ? item.priceValue : item.price), owned ? 'dark' : 'gold',
      () => this.buy(prod, btn), { w: 170, h: 70, size: 24, icon: withIcon ? 'curr_icon' : undefined });
    if (owned) btn.setEnabled(false);
    this.rows.push({ prod, btn });
  }

  async buy(prod, btn) {
    if (this.buying || YandexSDK.busy) return;
    this.buying = true;
    const ok = await YandexSDK.purchase(prod.id);
    this.buying = false;
    if (!this.scene.isActive()) return;
    this.coinText.setText(String(YandexSDK.data.coins));
    if (ok) {
      Sfx.play(this, 'coin');
      toast(this, t('purchased'));
      if (prod.type === 'noads') { btn.setLabel(t('owned')).setEnabled(false); }
      else floatText(this, DESIGN.W / 2, 232, '+' + prod.coins, '#ffe27a', 40);
    } else {
      toast(this, t('purchaseFail'));
    }
  }

  close() {
    if (this.buying) return;
    const parent = this.scene.get(this.parentKey);
    this.scene.stop();
    this.scene.resume(this.parentKey);
    if (parent && parent.onShopClosed) parent.onShopClosed();
  }
}
