import { createGameConfig } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { PlayScene } from './scenes/PlayScene.js';
import { ShopScene } from './scenes/ShopScene.js';

const game = new Phaser.Game(createGameConfig([BootScene, MenuScene, PlayScene, ShopScene]));
if (location.search.includes('debug')) window.__game = game; // только для отладки: index.html?debug
