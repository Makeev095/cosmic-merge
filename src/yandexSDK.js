// Синглтон для работы с Yandex Games SDK: инициализация, сохранения, реклама, пауза/звук.
// Режимы: 'yandex' (настоящий SDK), 'dev' (SDK нет — локальная разработка, реклама имитируется),
//         'offline' (SDK подключён, но init упал — рекламы нет, игра работает).

import { CONFIG, setLang } from './config.js';

const defaultData = () => ({
  v: 1,
  coins: CONFIG.balance.startCoins,
  best: 0,
  level: 1,
  maxTier: 0,
  games: 0,
  sound: true,
  noAds: false,   // куплено «Без рекламы»
  tokens: [],     // обработанные purchaseToken (защита от двойного начисления)
  updatedAt: 0
});

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

class YandexSDKManager {
  constructor() {
    this.mode = 'none';
    this.ysdk = null;
    this.player = null;
    this.payments = null;
    this.game = null;
    this.ready = false;
    this.data = defaultData();
    this.busy = false;                 // true, пока открыта реклама
    this.lastAdAt = Date.now();        // отсчёт интервала межстраничной рекламы идёт с запуска
    this._reasons = new Set();         // причины паузы: 'ad', 'api'
    this._sleeping = false;
    this._saveTimer = null;
    this._gameplayOn = false;
    this._loadingReadySent = false;
  }

  // ---------- Инициализация ----------
  async init(game) {
    this.game = game;
    if (this.ready) return;
    const isLocal = ['localhost', '127.0.0.1', '', '0.0.0.0'].includes(location.hostname) || location.protocol === 'file:';

    if (typeof YaGames === 'undefined') {
      this.mode = 'dev';
    } else {
      try {
        this.ysdk = await withTimeout(YaGames.init(), 6000); // YaGames.init() -> ysdk
        this.mode = 'yandex';
      } catch (e) {
        console.warn('[YandexSDK] init failed:', e);
        this.ysdk = null;
        this.mode = isLocal ? 'dev' : 'offline';
      }
    }

    if (this.ysdk) {
      try { setLang(this.ysdk.environment.i18n.lang); } catch (e) { setLang(navigator.language); }
      try { this.player = await withTimeout(this.ysdk.getPlayer({ scopes: false }), 4000); }
      catch (e) { console.warn('[YandexSDK] getPlayer failed, using localStorage only:', e); this.player = null; }
      try { this.payments = await withTimeout(this.ysdk.getPayments({ signed: false }), 4000); }
      catch (e) { console.warn('[YandexSDK] payments unavailable:', e && e.message ? e.message : e); this.payments = null; }
      try {
        this.ysdk.on('game_api_pause', () => this._suspend('api'));
        this.ysdk.on('game_api_resume', () => this._resume('api'));
      } catch (e) { /* события недоступны — не критично */ }
    } else {
      setLang(navigator.language);
    }

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flushCloud(); });
    this.lastAdAt = Date.now();
    this.ready = true;
  }

  // Сообщаем платформе, что игра загружена и готова к взаимодействию
  gameReady() {
    if (this._loadingReadySent) return;
    this._loadingReadySent = true;
    try { this.ysdk && this.ysdk.features.LoadingAPI && this.ysdk.features.LoadingAPI.ready(); } catch (e) { console.warn(e); }
  }
  gameplayStart() {
    if (this._gameplayOn) return;
    this._gameplayOn = true;
    try { this.ysdk && this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.start(); } catch (e) { /* ignore */ }
  }
  gameplayStop() {
    if (!this._gameplayOn) return;
    this._gameplayOn = false;
    try { this.ysdk && this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.stop(); } catch (e) { /* ignore */ }
  }

  // ---------- Сохранения: облако (ysdk.getPlayer) + откат на localStorage ----------
  _readLocal() {
    try { const raw = localStorage.getItem(CONFIG.storageKey); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  _writeLocal() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.data)); } catch (e) { /* приватный режим */ }
  }

  async loadData() {
    const local = this._readLocal();
    let cloud = null;
    if (this.player) {
      try {
        const res = await withTimeout(this.player.getData(['save']), 4000);
        cloud = res && res.save ? res.save : null;
      } catch (e) { console.warn('[YandexSDK] cloud load failed, fallback to localStorage:', e); }
    }
    // Побеждает более свежий прогресс — игрок не теряет данные ни при логине, ни при выходе
    const pick = [cloud, local].filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    this.data = Object.assign(defaultData(), pick || {});
    this.applyAudioState();
    return this.data;
  }

  save() {
    this.data.updatedAt = Date.now();
    this._writeLocal(); // локально сохраняем мгновенно
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.flushCloud(), CONFIG.ads.saveDebounceMs);
  }

  flushCloud() {
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    if (!this.player) return;
    try { this.player.setData({ save: this.data }, true).catch((e) => console.warn('[YandexSDK] cloud save failed:', e)); }
    catch (e) { console.warn('[YandexSDK] cloud save failed:', e); }
  }

  // ---------- Пауза и звук ----------
  _suspend(reason) {
    this._reasons.add(reason);
    this.applyAudioState();
  }
  _resume(reason) {
    this._reasons.delete(reason);
    this.applyAudioState();
  }

  // Единая точка управления: пока есть причины паузы — цикл спит и звук выключен
  applyAudioState() {
    const g = this.game;
    if (!g) return;
    const paused = this._reasons.size > 0;
    if (paused && !this._sleeping) { g.loop.sleep(); this._sleeping = true; }
    if (!paused && this._sleeping) { g.loop.wake(); this._sleeping = false; }
    g.sound.mute = paused || !this.data.sound;
  }

  setSound(on) {
    this.data.sound = !!on;
    this.applyAudioState();
    this.save();
  }

  // ---------- Внутриигровые покупки (ysdk.getPayments) ----------
  get paymentsAvailable() { return this.mode === 'dev' || !!this.payments; }

  // Каталог: { [id]: { price: '30 Ян', title } }. Цены берём только из каталога Яндекса.
  async getCatalog() {
    const out = {};
    if (this.mode === 'dev') {
      for (const id in CONFIG.shop.devPrices) out[id] = { price: CONFIG.shop.devPrices[id] };
      return out;
    }
    if (!this.payments) return out;
    const items = await withTimeout(this.payments.getCatalog(), 6000);
    // Название и иконка портальной валюты берутся из SDK (пункт 1.13.2), а не из кода игры
    (items || []).forEach((it) => {
      let icon = '';
      try { icon = it.getPriceCurrencyImage ? it.getPriceCurrencyImage('small') : ''; } catch (e) { icon = ''; }
      out[it.id] = {
        price: it.price || (it.priceValue + ' ' + (it.priceCurrencyCode || '')),
        priceValue: it.priceValue ? String(it.priceValue) : '',
        icon,
        title: it.title
      };
    });
    return out;
  }

  // Покупка. Возвращает true при успехе. Начисляем товар, затем гасим (consume) потребляемые покупки.
  async purchase(id) {
    if (!this.paymentsAvailable || this.busy) return false;
    this._suspend('pay');
    try {
      if (this.mode === 'dev') {
        await new Promise((r) => setTimeout(r, 500));
        await this._grant({ productID: id, purchaseToken: 'dev-' + Date.now() + '-' + Math.random() });
        return true;
      }
      const purchase = await this.payments.purchase({ id });
      await this._grant(purchase);
      return true;
    } catch (e) {
      console.warn('[YandexSDK] purchase failed:', e && e.message ? e.message : e);
      return false;
    } finally {
      this._resume('pay');
    }
  }

  // Начисление товара. Токен запоминаем до consume, чтобы при сбое не начислить дважды.
  async _grant(purchase) {
    const prod = CONFIG.shop.products.find((p) => p.id === purchase.productID);
    if (!prod) return;
    const d = this.data;
    if (prod.type === 'coins') {
      if (!d.tokens.includes(purchase.purchaseToken)) {
        d.coins += prod.coins;
        d.tokens.push(purchase.purchaseToken);
        if (d.tokens.length > CONFIG.shop.maxStoredTokens) d.tokens.shift();
        this.save();
        this.flushCloud();
      }
      if (this.payments && this.mode !== 'dev') {
        try { await this.payments.consumePurchase(purchase.purchaseToken); }
        catch (e) { console.warn('[YandexSDK] consume failed (will retry on next start):', e); }
      }
    } else if (prod.type === 'noads') {
      d.noAds = true;
      this.save();
      this.flushCloud();
    }
  }

  // При старте подбираем недообработанные покупки (сбой между оплатой и начислением)
  async restorePurchases() {
    if (!this.payments || this.mode === 'dev') return;
    try {
      const list = await withTimeout(this.payments.getPurchases(), 5000);
      for (const p of list || []) await this._grant(p);
    } catch (e) { console.warn('[YandexSDK] restorePurchases failed:', e && e.message ? e.message : e); }
  }

  // ---------- Реклама ----------
  canShowInterstitial() {
    return this.mode !== 'offline' && !this.busy && !this.data.noAds &&
      Date.now() - this.lastAdAt >= CONFIG.ads.interstitialIntervalMs;
  }
  canShowRewarded() { return this.mode !== 'offline' && !this.busy; }

  // Межстраничная реклама. Вызывать только в безопасные моменты (конец раунда / смена уровня).
  // Возвращает Promise<boolean> — была ли показана реклама.
  showInterstitial() {
    return new Promise((resolve) => {
      if (!this.canShowInterstitial()) return resolve(false);
      this.busy = true;
      let finished = false;
      let opened = false;
      const finish = (shown) => {
        if (finished) return;
        finished = true;
        if (opened) this._resume('ad');
        this.busy = false;
        if (opened) this.lastAdAt = Date.now();
        resolve(!!shown);
      };
      const callbacks = {
        onOpen: () => { opened = true; this._suspend('ad'); },
        onClose: (wasShown) => finish(wasShown),
        onError: (err) => { console.warn('[YandexSDK] interstitial error:', err); finish(false); },
        onOffline: () => finish(false)
      };
      if (this.mode === 'yandex') {
        try { this.ysdk.adv.showFullscreenAdv({ callbacks }); }
        catch (e) { callbacks.onError(e); }
      } else {
        this._devAd('INTERSTITIAL', callbacks, false);
      }
    });
  }

  // Реклама за вознаграждение. onRewarded вызывается строго из коллбека SDK onRewarded.
  // Возвращает Promise<boolean> — получил ли игрок награду.
  showRewarded(onRewarded) {
    return new Promise((resolve) => {
      if (!this.canShowRewarded()) return resolve(false);
      this.busy = true;
      let finished = false;
      let opened = false;
      let rewarded = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (opened) this._resume('ad');
        this.busy = false;
        if (opened) this.lastAdAt = Date.now();
        resolve(rewarded);
      };
      const callbacks = {
        onOpen: () => { opened = true; this._suspend('ad'); },
        onRewarded: () => {
          if (rewarded) return;
          rewarded = true;
          try { onRewarded && onRewarded(); } catch (e) { console.error(e); }
        },
        onClose: () => finish(),
        onError: (err) => { console.warn('[YandexSDK] rewarded error:', err); finish(); }
      };
      if (this.mode === 'yandex') {
        try { this.ysdk.adv.showRewardedVideo({ callbacks }); }
        catch (e) { callbacks.onError(e); }
      } else {
        this._devAd('REWARDED', callbacks, true);
      }
    });
  }

  // Имитация рекламы для локальной разработки (в Яндексе не используется)
  _devAd(label, cb, rewarded) {
    const el = document.createElement('div');
    el.textContent = 'DEV AD: ' + label;
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.88);color:#fff;font:bold 28px sans-serif;letter-spacing:2px';
    document.body.appendChild(el);
    setTimeout(() => cb.onOpen(), 30);
    setTimeout(() => {
      if (rewarded && cb.onRewarded) cb.onRewarded();
      el.remove();
      cb.onClose(true);
    }, CONFIG.ads.devAdDurationMs);
  }
}

export const YandexSDK = new YandexSDKManager();
