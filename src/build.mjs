// Rebuilds ../index.html from the templates, the images and the 2.5D board script in this folder.
// Run:  node src/build.mjs   (or "npm run build" inside board3d/, which first rebuilds src/board3d/board3d.js)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const d = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(d, f), 'utf8');
const head = read('tpl_head.html');
const body = read('tpl_body.html');
const assets = read('img/assets.json');
const board = read('board3d/board3d.js').replace(/<\/script/gi, '<\\/script');
const out = head + body.split('/*ASSETS*/').join('const IMG=' + assets + ';').split('/*BOARD3D*/').join(board);
writeFileSync(join(d, '..', 'index.html'), out);
console.log('index.html rebuilt');
