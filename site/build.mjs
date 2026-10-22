// Assembles the static site into site/_site, copying shared design and client files
// so the website always uses the same tokens, mark and music logic as the apps.
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const site = dirname(fileURLToPath(import.meta.url));
const root = join(site, '..');
const out = join(site, '_site');

const pages = ['index.html', 'styles.css', 'main.js', 'demo.js', 'present.html', 'present.css', 'present.js', 'judges.html'];
const shared = {
  'tokens.css': 'design/generated/tokens.css',
  'mark.svg': 'design/mark.svg',
  'favicon.svg': 'design/favicon.svg',
  'icon-180.png': 'design/generated/icon-180.png',
  'icon-512.png': 'design/generated/icon-512.png',
  'theme.js': 'client/theme.js',
  'music.js': 'client/music.js',
  'cover.png': 'docs/cover/out/maestro-cover-stage-light.png',
};

await rm(out, {recursive: true, force: true});
await mkdir(join(out, 'shared'), {recursive: true});
for (const file of pages) await cp(join(site, file), join(out, file));
await cp(join(site, 'assets'), join(out, 'assets'), {recursive: true});
for (const [name, source] of Object.entries(shared)) await cp(join(root, source), join(out, 'shared', name));
// GitHub Pages would otherwise run Jekyll over the output.
await writeFile(join(out, '.nojekyll'), '');
console.log(`Built ${out}`);
