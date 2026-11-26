// 404: a closed block.
import { $ } from './util.js';
import { shell } from './shell.js';
import { led } from './led.js';
shell();
const b = led($('#lostLed'), { text: ' 404 ', glow: 16, start: 0 }); b.reveal(1100);
setInterval(() => b.flicker(500), 4200);
