import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
await mkdir('dist/assets', { recursive: true });
if (existsSync('src/assets')) await cp('src/assets', 'dist/assets/assets', { recursive: true });
const css = await readFile('src/styles.css','utf8');
await writeFile('dist/assets/styles.css', css.replace(/\.\/assets\//g,'./assets/'));
await writeFile('dist/index.html', '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Therafam</title><link rel="stylesheet" href="/assets/styles.css"></head><body><div id="root"></div><script type="module" src="/assets/main.js"></script></body></html>');
console.log('Built production frontend in dist/');
