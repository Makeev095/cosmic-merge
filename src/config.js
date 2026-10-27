// Настройки игры, баланс, локализация и конфигурация Phaser.

export const DESIGN = { W: 600, H: 1000 }; // логическое «окно» игры; камера масштабирует его под любой экран

export const CONFIG = {
  storageKey: 'cosmic_merge_save_v1',

  ads: {
    interstitialIntervalMs: 120000, // межстраничная реклама не чаще раза в 2 минуты
    saveDebounceMs: 1500,           // троттлинг облачных сохранений
    devAdDurationMs: 900            // длительность имитации рекламы в локальной разработке
  },

  // Геометрия банки (в логических координатах 600x1000)
  jar: { left: 70, right: 530, floor: 880, top: 250, dangerY: 285, dropY: 210, wall: 90 },

  // Параметры физики Matter
  physics: {
    gravityY: 1.2,
    restitution: 0.1,
    friction: 0.22,
    frictionStatic: 0.5,
    frictionAir: 0.003,
    density: 0.0015
  },

  // Внутриигровые покупки. id должны совпадать с товарами в консоли Яндекс Игр (Разработчикам → Игра → Внутриигровые покупки).
  shop: {
    products: [
      { id: 'coins_500',  type: 'coins', coins: 500 },
      { id: 'coins_2000', type: 'coins', coins: 2000, badge: 'x1.2' },
      { id: 'coins_6000', type: 'coins', coins: 6000, badge: 'x1.5' },
      { id: 'no_ads',     type: 'noads' }   // непотребляемый: отключает межстраничную рекламу
    ],
    devPrices: { coins_500: '30 Ян', coins_2000: '100 Ян', coins_6000: '250 Ян', no_ads: '150 Ян' },
    maxStoredTokens: 30
  },

  balance: {
    purgeCost: 40,            // бустер «Чистка»: убирает мелкие планеты
    purgeMaxTier: 2,
    startCoins: 50,
    dropCooldownMs: 450,
    dangerHoldMs: 2200,       // сколько планета должна торчать над линией, чтобы был проигрыш
    comboWindowMs: 1400,
    shakeCost: 25,
    freeCoinsReward: 100,
    freeCoinsCooldownMs: 20000,
    coinsPerScore: 0.04,
    winBonus: 40,             // * номер уровня
    reviveClearMargin: 120,   // при возрождении убираем всё выше dangerY + margin
    spawnWeights: [34, 28, 20, 12, 6] // вероятности выпадения планет 0..4
  }
};

// Цель уровня: достичь планеты с этим индексом (L1 -> Земля, ... L6+ -> Солнце)
export function targetTierForLevel(level) {
  return Math.min(4 + level, 10);
}

const hex = (s) => parseInt(s.slice(1), 16);

const RAW_TIERS = [
  { r: 16,  color: '#c58bff', deco: 'dust',    score: 0,   ru: 'Космопыль',      en: 'Stardust' },
  { r: 23,  color: '#9a7b6a', deco: 'craters', score: 2,   ru: 'Астероид',       en: 'Asteroid' },
  { r: 31,  color: '#cfd8dc', deco: 'craters', score: 5,   ru: 'Луна',           en: 'Moon' },
  { r: 40,  color: '#ffb74d', deco: 'bands',   score: 9,   ru: 'Венера',         en: 'Venus' },
  { r: 50,  color: '#e5533d', deco: 'craters', score: 14,  ru: 'Марс',           en: 'Mars' },
  { r: 61,  color: '#2f9bf0', deco: 'earth',   score: 20,  ru: 'Земля',          en: 'Earth' },
  { r: 73,  color: '#4f5bd5', deco: 'bands',   score: 27,  ru: 'Нептун',         en: 'Neptune' },
  { r: 86,  color: '#f2c14e', deco: 'ring',    score: 35,  ru: 'Сатурн',         en: 'Saturn' },
  { r: 100, color: '#e08a5a', deco: 'storm',   score: 44,  ru: 'Юпитер',         en: 'Jupiter' },
  { r: 115, color: '#30d5e8', deco: 'sun',     score: 54,  ru: 'Голубой гигант', en: 'Blue Giant' },
  { r: 132, color: '#ffd93b', deco: 'sun',     score: 100, ru: 'Солнце',         en: 'Sun' }
];
export const TIERS = RAW_TIERS.map((t) => ({ ...t, tint: hex(t.color) }));

// ---------- Локализация ----------
const I18N = {
  ru: {
    loading: 'Загрузка',
    title1: 'КОСМИЧЕСКИЙ', title2: 'СИНТЕЗ',
    play: 'ИГРАТЬ', freeCoins: '+{n} МОНЕТ', wait: 'ЖДИТЕ {n}с',
    best: 'Рекорд', level: 'Уровень', goal: 'ЦЕЛЬ', next: 'ДАЛЕЕ', score: 'СЧЁТ',
    shake: 'ВСТРЯХНУТЬ', purge: 'ЧИСТКА', combo: 'КОМБО',
    shop: 'МАГАЗИН', coinsN: '{n} монет', noAds: 'Без рекламы', noAdsDesc: 'Без видео между раундами',
    owned: 'КУПЛЕНО', close: 'ЗАКРЫТЬ', payUnavailable: 'Покупки сейчас недоступны', purchased: 'Спасибо за покупку!',
    purchaseFail: 'Покупка не удалась', shopLoading: 'Загрузка товаров…', buy: 'КУПИТЬ',
    hint: 'Двигай и отпусти, чтобы бросить',
    reviveTitle: 'ОРБИТА ПЕРЕПОЛНЕНА!', reviveText: 'Посмотри видео — и мы расчистим верх банки',
    revive: 'ВОЗРОЖДЕНИЕ', noThanks: 'Нет, спасибо',
    victory: 'ПОБЕДА!', gameOver: 'КОНЕЦ ИГРЫ', newRecord: 'НОВЫЙ РЕКОРД!',
    earned: 'Монеты', double: 'x2 МОНЕТЫ', retry: 'ЗАНОВО', nextLevel: 'СЛЕДУЮЩИЙ УРОВЕНЬ', menu: 'В МЕНЮ',
    noCoins: 'Не хватает монет', adFail: 'Видео сейчас недоступно', reached: 'Достигнуто'
  },
  en: {
    loading: 'Loading',
    title1: 'COSMIC', title2: 'MERGE',
    play: 'PLAY', freeCoins: '+{n} COINS', wait: 'WAIT {n}s',
    best: 'Best', level: 'Level', goal: 'GOAL', next: 'NEXT', score: 'SCORE',
    shake: 'SHAKE', purge: 'CLEAR', combo: 'COMBO',
    shop: 'SHOP', coinsN: '{n} coins', noAds: 'No ads', noAdsDesc: 'No videos between rounds',
    owned: 'OWNED', close: 'CLOSE', payUnavailable: 'Purchases are unavailable right now', purchased: 'Thank you!',
    purchaseFail: 'Purchase failed', shopLoading: 'Loading products…', buy: 'BUY',
    hint: 'Move and release to drop',
    reviveTitle: 'ORBIT OVERFLOW!', reviveText: 'Watch a video and we will clear the top of the jar',
    revive: 'REVIVE', noThanks: 'No, thanks',
    victory: 'VICTORY!', gameOver: 'GAME OVER', newRecord: 'NEW BEST!',
    earned: 'Coins', double: 'x2 COINS', retry: 'RETRY', nextLevel: 'NEXT LEVEL', menu: 'MENU',
    noCoins: 'Not enough coins', adFail: 'Video unavailable right now', reached: 'Reached'
  }
};

let currentLang = 'ru';
export function setLang(code) {
  code = String(code || 'ru').toLowerCase().slice(0, 2);
  currentLang = ['ru', 'be', 'kk', 'uk', 'uz', 'hy', 'az', 'ka', 'tg', 'ky', 'tk'].includes(code) ? 'ru' : 'en';
}
export function getLang() { return currentLang; }
export function t(key, vars) {
  let s = (I18N[currentLang] && I18N[currentLang][key]) || I18N.ru[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
export function tierName(i) { return TIERS[i][currentLang === 'ru' ? 'ru' : 'en']; }

// ---------- Конфигурация Phaser ----------
export function createGameConfig(scenes) {
  return {
    type: Phaser.AUTO, // WebGL, при его отсутствии — Canvas
    parent: 'game-container',
    backgroundColor: '#0B0F12',
    scale: {
      mode: Phaser.Scale.RESIZE, // мгновенная адаптация под любой экран и ориентацию
      width: '100%',
      height: '100%'
    },
    render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: CONFIG.physics.gravityY },
        debug: false,
        setBounds: false,
        enableSleeping: false,
        positionIterations: 8,
        velocityIterations: 6
      }
    },
    input: { activePointers: 2 },
    disableContextMenu: true,
    banner: false,
    scene: scenes
  };
}
