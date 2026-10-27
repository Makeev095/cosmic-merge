import { CONFIG, DESIGN, TIERS, t, tierName, targetTierForLevel } from '../config.js';
import { YandexSDK } from '../yandexSDK.js';
import { Sfx } from '../audio.js';
import {
  fitCamera, addBackground, makeText, gradientText, makeButton, makeRoundButton,
  burst, shock, floatText, toast
} from '../ui.js';

const J = CONFIG.jar;
const B = CONFIG.balance;
const P = CONFIG.physics;

export class PlayScene extends Phaser.Scene {
  constructor() { super('PlayScene'); }

  init(data) {
    this.startLevel = (data && data.level) || (YandexSDK.data && YandexSDK.data.level) || 1;
  }

  create() {
    // Геймплей не стартует, пока SDK не инициализирован
    if (!YandexSDK.ready) { this.scene.start('BootScene'); return; }

    fitCamera(this);
    addBackground(this);
    this.cameras.main.fadeIn(300, 11, 15, 18);

    this.level = this.startLevel;
    this.target = targetTierForLevel(this.level);
    this.state = 'play'; // play | over | win
    this.planets = [];
    this.mergeQueue = [];
    this.held = null;
    this.score = 0;
    this.combo = 0;
    this.lastMergeAt = -99999;
    this.dangerTime = 0;
    this.invulnUntil = 0;
    this.roundMax = 0;
    this.merges = 0;
    this.revived = false;
    this.doubled = false;
    this.leaving = false;
    this.earned = 0;
    this.aimX = DESIGN.W / 2;
    this.panel = null;
    this.comboText = null;
    this.MBody = this.matter.body || Phaser.Physics.Matter.Matter.Body;

    this.buildJar();
    this.buildHud();

    this.matter.world.on('collisionstart', this.onCollide, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.nextTier = this.pickTier();
    this.spawnHeld();
    YandexSDK.gameplayStart();
  }

  onShutdown() {
    if (this.matter && this.matter.world) this.matter.world.off('collisionstart', this.onCollide, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerMove, this);
    this.input.off('pointerup', this.onPointerUp, this);
    YandexSDK.gameplayStop();
  }

  // ------------------------------------------------------------------ построение сцены
  buildJar() {
    const L = J.left, R = J.right, wt = J.wall;
    const wallOpts = { isStatic: true, friction: 0.3, restitution: 0.05, label: 'wall' };
    const topY = -400;
    const midY = (topY + J.floor + wt) / 2, hh = J.floor + wt - topY;
    this.matter.add.rectangle(L - wt / 2, midY, wt, hh, wallOpts);
    this.matter.add.rectangle(R + wt / 2, midY, wt, hh, wallOpts);
    this.matter.add.rectangle(DESIGN.W / 2, J.floor + wt / 2, R - L + wt * 2, wt, wallOpts);

    const g = this.add.graphics().setDepth(0);
    const x0 = L - 6, x1 = R + 6, y0 = J.top, y1 = J.floor + 8, rad = 34;
    g.fillStyle(0x0a1530, 0.55);
    g.fillRoundedRect(x0, y0, x1 - x0, y1 - y0, { tl: 0, tr: 0, bl: rad, br: rad });
    const path = () => {
      g.beginPath();
      g.moveTo(x0, y0); g.lineTo(x0, y1 - rad);
      g.arc(x0 + rad, y1 - rad, rad, Math.PI, Math.PI / 2, true);
      g.lineTo(x1 - rad, y1);
      g.arc(x1 - rad, y1 - rad, rad, Math.PI / 2, 0, true);
      g.lineTo(x1, y0);
      g.strokePath();
    };
    g.lineStyle(18, 0x5ee7ff, 0.12); path();
    g.lineStyle(5, 0x5ee7ff, 0.8); path();

    // линия опасности (пунктир)
    this.dangerLine = this.add.graphics().setDepth(1);
    this.dangerLine.lineStyle(4, 0xff5a5a, 1);
    for (let x = J.left + 8; x < J.right - 20; x += 28) this.dangerLine.lineBetween(x, J.dangerY, x + 15, J.dangerY);
    this.dangerLine.setAlpha(0.22);

    this.guide = this.add.graphics().setDepth(1);

    this.hint = makeText(this, DESIGN.W / 2, 400, t('hint'), 26, '#cfe0ff', { wrap: 380 }).setDepth(10);
    this.tweens.add({ targets: this.hint, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });
  }

  buildHud() {
    const W = DESIGN.W;
    const d = YandexSDK.data;

    this.add.image(40, 46, 'coin').setDisplaySize(40, 40).setDepth(10);
    this.coinText = makeText(this, 68, 46, String(d.coins), 30, '#ffe27a', { ox: 0 }).setDepth(10);

    makeText(this, W / 2, 24, t('score'), 18, '#8fb4ff').setDepth(10);
    this.scoreText = makeText(this, W / 2, 68, '0', 58).setDepth(10);

    this.soundBtn = makeRoundButton(this, 556, 46, d.sound ? 'ic_snd_on' : 'ic_snd_off', () => {
      YandexSDK.setSound(!YandexSDK.data.sound);
      this.soundBtn.setIcon(YandexSDK.data.sound ? 'ic_snd_on' : 'ic_snd_off');
    }, 62).setDepth(10);
    makeRoundButton(this, 488, 46, 'ic_home', () => {
      if (YandexSDK.busy) return;
      this.scene.start('MenuScene');
    }, 62).setDepth(10);

    const lv = makeText(this, W / 2, 124, `${t('level')} ${this.level}`, 26, '#ffd54f').setDepth(10);
    gradientText(lv, '#fff2a8', '#ffb300');
    makeText(this, W / 2, 154, `${t('best')}: ${d.best}`, 20, '#9fb0d0').setDepth(10);

    // цель уровня
    makeText(this, 28, 112, t('goal'), 18, '#8fb4ff', { ox: 0 }).setDepth(10);
    this.add.image(60, 158, 'p' + this.target).setDisplaySize(52, 52).setDepth(10);
    makeText(this, 94, 158, tierName(this.target), 21, '#ffffff', { ox: 0, wrap: 120 }).setDepth(10);

    // следующая планета
    makeText(this, W - 28, 112, t('next'), 18, '#8fb4ff', { ox: 1 }).setDepth(10);
    this.nextImg = this.add.image(W - 56, 160, 'p0').setDepth(10);

    // цепочка эволюции
    this.chain = [];
    for (let i = 0; i < TIERS.length; i++) {
      const img = this.add.image(45 + i * 51, 925, 'p' + i).setDisplaySize(34, 34).setDepth(10);
      img.setTint(0x3a3f55).setAlpha(0.55);
      this.chain.push(img);
    }
    this.markReached(0, true);
    const tr = this.add.image(45 + this.target * 51, 925, 'ring').setTint(0xffd54f)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(50, 50).setDepth(11);
    this.tweens.add({ targets: tr, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });

    // бустер
    this.shakeBtn = makeButton(this, 180, 972, `${t('shake')} ${B.shakeCost}`, 'blue', () => this.useShake(),
      { w: 250, h: 54, size: 20, icon: 'coin' }).setDepth(10);
    this.purgeBtn = makeButton(this, 420, 972, `${t('purge')} ${B.purgeCost}`, 'red', () => this.usePurge(),
      { w: 250, h: 54, size: 20, icon: 'coin' }).setDepth(10);
  }

  // ------------------------------------------------------------------ вспомогательное
  pickTier() {
    const w = B.spawnWeights;
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }

  setNextPreview(tier) {
    this.nextImg.setTexture('p' + tier);
    const s = Math.min(TIERS[tier].r * 2, 56);
    this.nextImg.setDisplaySize(s, s);
  }

  refreshCoins() { this.coinText.setText(String(YandexSDK.data.coins)); }

  markReached(tier, silent) {
    for (let i = 0; i <= tier && i < this.chain.length; i++) {
      const img = this.chain[i];
      if (img.isTinted || img.alpha < 1) {
        img.clearTint().setAlpha(1);
        if (!silent) {
          const s = img.scaleX;
          this.tweens.add({ targets: img, scaleX: s * 1.5, scaleY: s * 1.5, duration: 160, yoyo: true, ease: 'Sine.Out' });
        }
      }
    }
  }

  makeView(tier, x, y) {
    const T = TIERS[tier], d = T.r * 2;
    const glow = this.add.image(x, y, 'spark').setTint(T.tint).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(d * 1.9, d * 1.9).setAlpha(0.32).setDepth(2);
    const sprite = this.add.image(x, y, 'p' + tier).setDisplaySize(d, d).setDepth(3);
    const gloss = this.add.image(x, y, 'spark').setDisplaySize(d * 0.42, d * 0.3).setAlpha(0.55).setDepth(4).setAngle(-35);
    return { glow, sprite, gloss, r: T.r };
  }

  placeView(v, x, y, rot) {
    v.sprite.setPosition(x, y);
    if (rot !== undefined) v.sprite.rotation = rot;
    v.glow.setPosition(x, y);
    v.gloss.setPosition(x - v.r * 0.32, y - v.r * 0.38);
  }

  destroyView(v) { v.glow.destroy(); v.sprite.destroy(); v.gloss.destroy(); }

  popIn(v) {
    [v.sprite, v.glow, v.gloss].forEach((o) => {
      const s = o.scaleX;
      o.setScale(s * 0.35);
      this.tweens.add({ targets: o, scaleX: s, scaleY: s, duration: 280, ease: 'Back.Out' });
    });
  }

  addPlanet(tier, x, y, pop) {
    const T = TIERS[tier];
    const body = this.matter.add.circle(x, y, T.r, {
      label: 'planet',
      restitution: P.restitution,
      friction: P.friction,
      frictionStatic: P.frictionStatic,
      frictionAir: P.frictionAir,
      density: P.density,
      slop: 0.04
    }, 28);
    const view = this.makeView(tier, x, y);
    const planet = { tier, body, view, bornAt: this.time.now, merging: false };
    body.planet = planet;
    this.planets.push(planet);
    if (pop) this.popIn(view);
    return planet;
  }

  removePlanet(p) {
    const i = this.planets.indexOf(p);
    if (i >= 0) this.planets.splice(i, 1);
    this.matter.world.remove(p.body);
    this.destroyView(p.view);
  }

  // ------------------------------------------------------------------ ввод и бросок
  onPointerMove(p) { this.aimX = p.worldX; }

  onPointerUp(p, over) {
    if (over && over.length) return;           // нажали на кнопку/панель
    if (p.worldY > J.floor + 10) return;       // ниже банки — нижняя панель
    this.aimX = p.worldX;
    this.dropHeld();
  }

  spawnHeld() {
    if (this.state !== 'play') return;
    const tier = this.nextTier;
    this.nextTier = this.pickTier();
    this.setNextPreview(this.nextTier);
    const r = TIERS[tier].r;
    const x = Phaser.Math.Clamp(this.aimX, J.left + r + 2, J.right - r - 2);
    const view = this.makeView(tier, x, J.dropY);
    this.popIn(view);
    this.held = { tier, view, x };
  }

  dropHeld() {
    if (this.state !== 'play' || !this.held) return;
    const h = this.held;
    this.held = null;
    this.guide.clear();
    const p = this.addPlanet(h.tier, h.x, J.dropY);
    p.bornAt = this.time.now;
    this.destroyView(h.view);
    Sfx.play(this, 'drop', { volume: 0.7 });
    if (this.hint) { this.hint.destroy(); this.hint = null; }
    this.time.delayedCall(B.dropCooldownMs, () => this.spawnHeld());
  }

  // ------------------------------------------------------------------ слияния
  onCollide(event) {
    for (const pair of event.pairs) {
      const a = pair.bodyA.planet, b = pair.bodyB.planet;
      if (!a || !b || a === b) continue;
      if (a.tier !== b.tier || a.tier >= TIERS.length - 1) continue;
      if (a.merging || b.merging) continue;
      a.merging = true; b.merging = true;
      this.mergeQueue.push([a, b]);
    }
  }

  processMerges(time) {
    while (this.mergeQueue.length) {
      const [a, b] = this.mergeQueue.shift();
      if (!this.planets.includes(a) || !this.planets.includes(b)) continue;
      const pa = a.body.position, pb = b.body.position;
      const x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2;
      const tier = a.tier + 1;
      this.removePlanet(a);
      this.removePlanet(b);
      this.addPlanet(tier, x, y, true);
      this.merges++;

      this.combo = (time - this.lastMergeAt <= B.comboWindowMs) ? this.combo + 1 : 1;
      this.lastMergeAt = time;
      const gain = Math.round(TIERS[tier].score * (1 + 0.5 * (this.combo - 1)));
      this.addScore(gain);

      const T = TIERS[tier];
      burst(this, x, y, T.tint, 12 + tier * 4, { speed: 200 + tier * 25, scale: 0.5 + tier * 0.05 });
      shock(this, x, y, T.tint, T.r * 2.6);
      floatText(this, x, y - T.r * 0.5, '+' + gain, '#ffffff', 26 + Math.min(tier * 2, 18));
      Sfx.play(this, 'm' + tier, { volume: 0.65 });
      if (tier >= 6) this.cameras.main.shake(110, 0.0035);

      if (this.combo >= 2) {
        if (this.comboText) { this.tweens.killTweensOf(this.comboText); this.comboText.destroy(); } // без наложения старых надписей
        const c = makeText(this, DESIGN.W / 2, 330, `${t('combo')} x${this.combo}`, 46 + Math.min(this.combo * 3, 24), '#ffe27a', { sw: 9 }).setDepth(70);
        this.comboText = c;
        this.tweens.add({ targets: c, scale: { from: 0.5, to: 1.15 }, duration: 220, ease: 'Back.Out' });
        this.tweens.add({ targets: c, alpha: 0, y: 270, delay: 500, duration: 450, onComplete: () => { c.destroy(); if (this.comboText === c) this.comboText = null; } });
      }

      if (tier > this.roundMax) { this.roundMax = tier; this.markReached(tier); }
      if (tier >= this.target) { this.win(); return; }
    }
  }

  addScore(n) {
    this.score += n;
    this.scoreText.setText(String(this.score));
    this.tweens.add({ targets: this.scoreText, scale: { from: 1.25, to: 1 }, duration: 200, ease: 'Sine.Out' });
  }

  // ------------------------------------------------------------------ бустер
  useShake() {
    if (this.state !== 'play' || YandexSDK.busy) return;
    const d = YandexSDK.data;
    if (d.coins < B.shakeCost) { toast(this, t('noCoins')); return; }
    d.coins -= B.shakeCost;
    YandexSDK.save();
    this.refreshCoins();
    for (const p of this.planets) {
      this.MBody.setVelocity(p.body, { x: (Math.random() - 0.5) * 9, y: -(4 + Math.random() * 7) });
    }
    Sfx.play(this, 'shake');
    this.cameras.main.shake(260, 0.006);
  }

  // Чистка: убирает мелкие планеты (до purgeMaxTier включительно)
  usePurge() {
    if (this.state !== 'play' || YandexSDK.busy) return;
    const d = YandexSDK.data;
    const doomed = this.planets.filter((p) => p.tier <= B.purgeMaxTier);
    if (!doomed.length) return;
    if (d.coins < B.purgeCost) { toast(this, t('noCoins')); return; }
    d.coins -= B.purgeCost;
    YandexSDK.save();
    this.refreshCoins();
    doomed.forEach((p) => {
      const pos = p.body.position;
      burst(this, pos.x, pos.y, TIERS[p.tier].tint, 14);
      this.removePlanet(p);
    });
    this.mergeQueue.length = 0;
    this.planets.forEach((p) => { p.merging = false; });
    Sfx.play(this, 'revive');
    this.cameras.main.shake(200, 0.004);
  }

  // ------------------------------------------------------------------ цикл
  update(time, delta) {
    if (!this.planets) return;
    for (const p of this.planets) this.placeView(p.view, p.body.position.x, p.body.position.y, p.body.angle);

    if (this.held) {
      const h = this.held, r = TIERS[h.tier].r;
      const tx = Phaser.Math.Clamp(this.aimX, J.left + r + 2, J.right - r - 2);
      h.x += (tx - h.x) * Math.min(1, delta * 0.03);
      this.placeView(h.view, h.x, J.dropY, 0);
      this.guide.clear();
      this.guide.lineStyle(2, 0xffffff, 0.16);
      for (let y = J.dropY + r + 6; y < J.floor; y += 22) this.guide.lineBetween(h.x, y, h.x, y + 9);
    }

    if (this.state !== 'play') {
      if (this.mergeQueue.length) {
        this.mergeQueue.forEach(([a, b]) => { a.merging = false; b.merging = false; });
        this.mergeQueue.length = 0;
      }
      return;
    }

    this.processMerges(time);
    if (this.state !== 'play') return;

    if (this.combo > 0 && time - this.lastMergeAt > B.comboWindowMs) this.combo = 0;

    // проигрыш: планета выше линии дольше dangerHoldMs
    if (time > this.invulnUntil) {
      let danger = false;
      for (const p of this.planets) {
        if (time - p.bornAt > 900 && p.body.position.y - TIERS[p.tier].r < J.dangerY) { danger = true; break; }
      }
      this.dangerTime = danger ? this.dangerTime + delta : Math.max(0, this.dangerTime - delta * 2);
      this.dangerLine.setAlpha(danger ? 0.55 + 0.45 * Math.sin(time / 70) : 0.22);
      if (this.dangerTime >= B.dangerHoldMs) this.gameOver();
    } else {
      this.dangerLine.setAlpha(0.22);
    }
  }

  // ------------------------------------------------------------------ победа / проигрыш
  clearHeld() {
    if (this.held) { this.destroyView(this.held.view); this.held = null; }
    this.guide.clear();
  }

  win() {
    this.state = 'win';
    this.clearHeld();
    this.dangerLine.setAlpha(0.1);
    YandexSDK.gameplayStop();
    Sfx.play(this, 'win');
    this.cameras.main.flash(400, 255, 240, 160);
    const T = TIERS[this.target];
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 180, () => {
        const x = Phaser.Math.Between(J.left + 40, J.right - 40), y = Phaser.Math.Between(400, 700);
        burst(this, x, y, i % 2 ? T.tint : 0xffffff, 40, { speed: 380, scale: 0.8 });
        shock(this, x, y, T.tint, 260);
      });
    }
    this.time.delayedCall(1500, () => this.showResults(true));
  }

  gameOver() {
    this.state = 'over';
    this.clearHeld();
    YandexSDK.gameplayStop();
    Sfx.play(this, 'lose');
    this.cameras.main.shake(350, 0.01);
    this.dangerLine.setAlpha(1);
    this.time.delayedCall(800, () => {
      if (!this.revived && YandexSDK.canShowRewarded()) this.showRevive();
      else this.showResults(false);
    });
  }

  // ------------------------------------------------------------------ панели
  buildPanel(w, h, cy) {
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(DESIGN.W / 2, DESIGN.H / 2, 5000, 5000, 0x050810, 0.74).setInteractive();
    const img = this.add.image(DESIGN.W / 2, cy, 'panel').setDisplaySize(w, h);
    c.add([dim, img]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 220 });
    this.panel = c;
    return c;
  }

  closePanel() {
    if (this.panel) { this.panel.destroy(true); this.panel = null; }
  }

  showRevive() {
    const W = DESIGN.W;
    const c = this.buildPanel(520, 560, 500);
    const title = makeText(this, W / 2, 285, t('reviveTitle'), 38, '#ff6b6b', { sw: 7, wrap: 460 });
    const icon = this.add.image(W / 2, 395, 'p' + Math.max(this.roundMax, 1)).setDisplaySize(110, 110);
    this.tweens.add({ targets: icon, angle: 360, duration: 9000, repeat: -1 });
    const txt = makeText(this, W / 2, 490, t('reviveText'), 24, '#cfe0ff', { wrap: 430 });
    const yes = makeButton(this, W / 2, 590, t('revive'), 'green', () => this.onRevive(), { w: 380, h: 92, size: 38, icon: 'ic_video', pulse: true });
    const no = makeButton(this, W / 2, 690, t('noThanks'), 'dark', () => { this.closePanel(); this.showResults(false); }, { w: 260, h: 60, size: 24 });
    c.add([title, icon, txt, yes, no]);
  }

  // Возрождение: награда (очистка верха банки) применяется внутри onRewarded
  async onRevive() {
    if (YandexSDK.busy) return;
    const ok = await YandexSDK.showRewarded(() => {
      const limit = J.dangerY + B.reviveClearMargin;
      const doomed = this.planets.filter((p) => p.body.position.y - TIERS[p.tier].r < limit);
      this.reviveCleared = doomed.map((p) => ({ x: p.body.position.x, y: p.body.position.y, tint: TIERS[p.tier].tint }));
      doomed.forEach((p) => this.removePlanet(p));
      this.mergeQueue.length = 0;
      this.revived = true;
      this.dangerTime = 0;
      this.invulnUntil = this.time.now + 2500;
      this.state = 'play';
    });
    if (!this.scene.isActive()) return;
    if (ok) {
      this.closePanel();
      (this.reviveCleared || []).forEach((c) => burst(this, c.x, c.y, c.tint, 16));
      Sfx.play(this, 'revive');
      this.spawnHeld();
      YandexSDK.gameplayStart();
    } else {
      toast(this, t('adFail'));
    }
  }

  showResults(win) {
    this.closePanel();
    const W = DESIGN.W;
    const d = YandexSDK.data;
    const isRecord = this.score > d.best;
    this.earned = Math.floor(this.score * B.coinsPerScore) + (win ? B.winBonus * this.level : 0);
    d.coins += this.earned;
    if (isRecord) d.best = this.score;
    d.games += 1;
    d.maxTier = Math.max(d.maxTier, this.roundMax);
    if (win) d.level = Math.max(d.level, this.level + 1);
    YandexSDK.save();
    this.refreshCoins();

    const c = this.buildPanel(540, 720, 520);
    const title = makeText(this, W / 2, 222, win ? t('victory') : t('gameOver'), 56, win ? '#ffd54f' : '#ff6b6b', { sw: 9 });
    gradientText(title, win ? '#fff6a8' : '#ffb0b0', win ? '#ff9a1f' : '#ff3b3b');
    const icon = this.add.image(W / 2, 330, 'p' + this.roundMax).setDisplaySize(Math.min(TIERS[this.roundMax].r * 2, 110), Math.min(TIERS[this.roundMax].r * 2, 110));
    this.tweens.add({ targets: icon, angle: 360, duration: 12000, repeat: -1 });
    const nm = makeText(this, W / 2, 400, tierName(this.roundMax), 24, '#9fb4d9');

    const lbl = makeText(this, W / 2, 440, t('score'), 18, '#8fb4ff');
    const scoreTx = makeText(this, W / 2, 487, '0', 60);
    this.tweens.addCounter({ from: 0, to: this.score, duration: 900, ease: 'Cubic.Out', onUpdate: (tw) => scoreTx.setText(String(Math.round(tw.getValue()))) });
    const rec = isRecord
      ? makeText(this, W / 2, 538, t('newRecord'), 26, '#7dff9a')
      : makeText(this, W / 2, 538, `${t('best')}: ${d.best}`, 22, '#9fb0d0');
    if (isRecord) this.tweens.add({ targets: rec, scale: 1.15, duration: 450, yoyo: true, repeat: -1 });

    const coin = this.add.image(W / 2 - 80, 590, 'coin').setDisplaySize(46, 46);
    this.earnedTx = makeText(this, W / 2 - 46, 590, '+0', 42, '#ffe27a', { ox: 0 });
    this.countEarned(0, this.earned);

    this.doubleBtn = makeButton(this, W / 2, 665, t('double'), 'gold', () => this.onDouble(), { w: 380, h: 80, size: 34, icon: 'ic_video' });
    if (!YandexSDK.canShowRewarded() || this.earned <= 0) this.doubleBtn.setEnabled(false);
    const primary = makeButton(this, W / 2, 760, win ? t('nextLevel') : t('retry'), 'green',
      () => this.leave(() => this.scene.restart({ level: win ? d.level : this.level })), { w: 420, h: 88, size: win ? 30 : 40, pulse: true });
    const menu = makeButton(this, W / 2, 840, t('menu'), 'dark', () => this.leave(() => this.scene.start('MenuScene')), { w: 240, h: 56, size: 24 });
    c.add([title, icon, nm, lbl, scoreTx, rec, coin, this.earnedTx, this.doubleBtn, primary, menu]);
    if (win) Sfx.play(this, 'coin');
  }

  countEarned(from, to) {
    this.tweens.addCounter({
      from, to, duration: 800, ease: 'Cubic.Out',
      onUpdate: (tw) => this.earnedTx && this.earnedTx.active && this.earnedTx.setText('+' + Math.round(tw.getValue()))
    });
  }

  // x2 монет: начисление строго внутри onRewarded
  async onDouble() {
    if (YandexSDK.busy || this.doubled) return;
    const ok = await YandexSDK.showRewarded(() => {
      YandexSDK.data.coins += this.earned;
      this.doubled = true;
      YandexSDK.save();
    });
    if (!this.scene.isActive()) return;
    if (ok) {
      this.doubleBtn.setEnabled(false);
      this.countEarned(this.earned, this.earned * 2);
      this.refreshCoins();
      Sfx.play(this, 'coin');
      floatText(this, DESIGN.W / 2, 600, 'x2!', '#ffe27a', 54);
    } else {
      toast(this, t('adFail'));
    }
  }

  // Выход с экрана результатов — безопасный момент для межстраничной рекламы
  async leave(next) {
    if (this.leaving || YandexSDK.busy) return;
    this.leaving = true;
    await YandexSDK.showInterstitial();
    if (!this.scene.isActive()) return;
    next();
  }
}
