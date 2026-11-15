import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeDay,daySeed,courseRandom,dailyBestKey,HOUSE_CATS} from '../challenge.js';
test('daily courses repeat across retries and devices without depending on cosmetic randomness',()=>{
 const course=()=>{const random=courseRandom(daySeed('2026-11-15'));return Array.from({length:100},()=>random());};
 const first=course();for(let i=0;i<100;i++)Math.random();assert.deepEqual(course(),first);
 const next=courseRandom(daySeed('2026-11-16'));assert.notEqual(first[0],next());assert.ok(first.every(n=>n>=0&&n<1));
});
test('challenge resets at Eastern midnight and keeps personal best separate from Classic',()=>{
 assert.equal(challengeDay(new Date('2026-11-16T04:59:59Z')),'2026-11-15');
 assert.equal(challengeDay(new Date('2026-11-16T05:00:00Z')),'2026-11-16');
 assert.notEqual(dailyBestKey('2026-11-15'),'flapurr_best');assert.notEqual(dailyBestKey('2026-11-15'),dailyBestKey('2026-11-16'));
 assert.deepEqual(HOUSE_CATS.map(cat=>cat.name),['Hubert','Mack','Mia']);
});
