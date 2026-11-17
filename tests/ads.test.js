import test from 'node:test';
import assert from 'node:assert/strict';
import { adsenseProvider, createAdProvider, AD_CONFIG } from '../ads.js';
import { continueAllowed, reviveShift } from '../game-core.js';

test('one continue per Classic run, after the first treat', () => {
  assert.equal(continueAllowed({mode:'classic', used:false, score:3}), true);
  assert.equal(continueAllowed({mode:'classic', used:true, score:3}), false);
  assert.equal(continueAllowed({mode:'classic', used:false, score:0}), false);
  assert.equal(continueAllowed({mode:'daily', used:false, score:9}), false);
  assert.equal(continueAllowed({mode:'practice', used:false, score:9}), false);
});

test('a revive slides the course so the next post is a safe distance ahead', () => {
  // cat at x=110 (r=18), posts 70 wide: the post at 100 is in the way; the one at -100 is behind.
  assert.equal(reviveShift([-100, 100, 320], 110, 18, 70), 180); // 110 + 170 - 100
  assert.equal(reviveShift([400, 620], 110, 18, 70), 0); // already clear
  assert.equal(reviveShift([], 110, 18, 70), 0);
});

test('the provider can be chosen, and testing overrides work', () => {
  assert.equal(AD_CONFIG.provider, 'placeholder');
  assert.equal(createAdProvider({provider:'none'}).name, 'none');
  assert.equal(createAdProvider({provider:'placeholder', placeholderSeconds:5}, '?ads=none').name, 'none');
  // AdSense without a valid publisher ID quietly turns the offer off.
  assert.equal(createAdProvider({provider:'adsense', adsenseClient:''}).name, 'none');
});

function fakeGoogle(behavior) {
  const pushed = [], head = [];
  const doc = {head:{append:el => head.push(el)}, createElement:() => ({dataset:{}})};
  const win = {};
  const provider = adsenseProvider({client:'ca-pub-1234567890123456', testMode:true, win, doc, waitMs:50});
  win.adsbygoogle.push = options => { pushed.push(options); if (options.type === 'reward') behavior(options); };
  return {provider, pushed, head};
}
test('AdSense: Continue appears only when Google has an ad ready, and the result is reported', async () => {
  const ready = fakeGoogle(options => options.beforeReward(() => { options.adViewed(); options.adBreakDone({breakStatus:'viewed'}); }));
  assert.match(ready.head[0].src, /adsbygoogle\.js\?client=ca-pub-1234567890123456/); assert.equal(ready.head[0].dataset.adbreakTest, 'on');
  const show = await ready.provider.offer(); assert.equal(typeof show, 'function');
  assert.equal(await show(), 'rewarded');
  const skipped = fakeGoogle(options => options.beforeReward(() => { options.adDismissed(); options.adBreakDone({breakStatus:'dismissed'}); }));
  assert.equal(await (await skipped.provider.offer())(), 'dismissed');
  const none = fakeGoogle(options => options.adBreakDone({breakStatus:'frequencyCapped'}));
  assert.equal(await none.provider.offer(), null);
  const silent = fakeGoogle(() => {});
  assert.equal(await silent.provider.offer(), null); // times out quietly
});
