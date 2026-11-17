import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HATS, readFish, availableHat, nextHat, unlockedBetween, fishSpawn, fishCaught, FISH_CHANCE } from '../wardrobe.js';
import { postStyle, makeRng, skyArt, SKY_ART } from '../scenery.js';

test('golden fish unlock hats, and bad saved values fall back safely', () => {
  assert.equal(readFish('12'), 12); assert.equal(readFish('-3'), 0); assert.equal(readFish('banana'), 0); assert.equal(readFish(null), 0);
  assert.equal(availableHat('crown', 39).id, 'none'); assert.equal(availableHat('crown', 40).id, 'crown'); assert.equal(availableHat('made-up', 99).id, 'none');
  assert.equal(nextHat(0).id, 'bow'); assert.equal(nextHat(15).id, 'wizard'); assert.equal(nextHat(40), null);
  assert.deepEqual(unlockedBetween(2, 9).map(hat => hat.id), ['bow', 'party']); assert.deepEqual(unlockedBetween(9, 9), []);
  assert.deepEqual(HATS.map(hat => hat.fish), [...HATS.map(hat => hat.fish)].sort((a, b) => a - b), 'hats unlock in order');
});

test('golden fish float between posts inside the playfield and are caught by touch', () => {
  const field = { postWidth:70, spacing:210, top:70, bottom:484 };
  assert.equal(fishSpawn(FISH_CHANCE, 0.5, 300, field), null);
  assert.deepEqual(fishSpawn(0, 0.5, 300, field), { dx:140, y:300, taken:false });
  assert.equal(fishSpawn(0, 0, 90, field).y, 70); assert.equal(fishSpawn(0, 1, 470, field).y, 484);
  assert.equal(fishCaught(100, 300, 18, 130, 300), true); assert.equal(fishCaught(100, 300, 18, 140, 300), false);
});

test('fish never touch the score: the game scores posts only, and fish use the cosmetic RNG', async () => {
  const game = await readFile(new URL('../game.js', import.meta.url), 'utf8');
  const catchBlock = game.slice(game.indexOf('// golden fish: cosmetic'), game.indexOf('renderHats();', game.indexOf('// golden fish: cosmetic')));
  assert.doesNotMatch(catchBlock, /score\s*[+-]=|score\+\+/);
  assert.match(game, /fish: fishSpawn\(rand\(\), rand\(\)/); // rand() is the cosmetic stream; the course uses nextCourse()
});

test('each post keeps the same look every frame, and every sky has artwork', () => {
  assert.deepEqual(postStyle(1234), postStyle(1234));
  const a = makeRng(7), b = makeRng(7); assert.equal(a(), b());
  for (const id of ['midnight', 'sunset', 'aurora']) assert.ok(SKY_ART[id].feature);
  assert.equal(skyArt({ id:'unknown' }), SKY_ART.midnight);
});

test('installable and offline: manifest icons exist and the service worker caches the game files', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  for (const icon of manifest.icons) assert.ok((await readFile(new URL(`../${icon.src}`, import.meta.url))).length > 100, icon.src);
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const file of ['game.js', 'scenery.js', 'wardrobe.js', 'ads.js', 'index.html']) assert.match(sw, new RegExp(`'${file.replace('.', '\\.')}'`));
  assert.match(sw, /origin !== self\.location\.origin\) return/, 'Firebase and ad requests bypass the cache');
});
