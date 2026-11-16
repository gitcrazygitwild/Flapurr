import test from 'node:test';
import assert from 'node:assert/strict';
import {fitViewport,rulesFor,circleRectCollide,fixedStepper,medalFor,readFlightLog,recordFlight,resultText} from '../game-core.js';
test('portrait, wide and high-DPI canvases fit the same playfield with bounded backing pixels',()=>{
  for(const [width,height,dpr] of [[520,640,1],[1440,900,2],[390,760,3],[320,480,1]]) {
    const fit=fitViewport(width,height,dpr);assert.ok(fit.x>=0 && fit.y>=0);assert.ok(420*fit.scale<=width+.001);assert.ok(640*fit.scale<=height+.001);assert.ok(fit.width<=width*2 && fit.height<=height*2);
  }
});
test('fixed physics produce the same flight at 30, 60 and 144 Hz, with no catch-up leap after a pause',()=>{
  const flight=hz=>{const stepper=fixedStepper();let y=0,velocity=-8.3;for(let frame=0;frame<hz;frame++)stepper.advance(1000/hz,()=>{velocity+=.45;y+=velocity;});return {y,velocity};};
  assert.deepEqual(flight(30),flight(60));assert.deepEqual(flight(144),flight(60));
  const stepper=fixedStepper();let steps=0;stepper.advance(20000,()=>steps++);assert.equal(steps,6);stepper.reset();assert.equal(stepper.advance(1,()=>steps++),0);
  assert.deepEqual(rulesFor('daily'),rulesFor('classic'));assert.ok(rulesFor('practice').gap>rulesFor('classic').gap);assert.ok(rulesFor('practice').speed<rulesFor('classic').speed);
  assert.equal(circleRectCollide(10,10,2,12,0,4,20),true);assert.equal(circleRectCollide(10,10,2,13,0,4,20),false);
});
test('flight log tolerates broken storage, bounds history and labels Practice results',()=>{
  let log=readFlightLog('not JSON');assert.equal(log.runs,0);
  for(let i=0;i<12;i++)log=recordFlight(log,{score:i,mode:'practice',cat:'Mia',day:'2026-11-16'});
  assert.equal(log.runs,12);assert.equal(log.treats,66);assert.equal(log.recent.length,8);assert.equal(log.recent[0].score,11);
  assert.equal(readFlightLog('{"runs":-9,"recent":[null]}').runs,0);
  assert.match(resultText(log.recent[0]),/Mia · Practice/);assert.equal(medalFor(25).name,'Golden cat');assert.equal(medalFor(0).score,0);
});
