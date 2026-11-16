// Pure game rules and local progress, separate from drawing and network I/O.
export const WORLD = {width:420,height:640};
export function fitViewport(width,height,dpr=1) {
  const ratio=Math.max(1,Math.min(2,dpr)),scale=Math.min(width/WORLD.width,height/WORLD.height);
  return {width:Math.round(width*ratio),height:Math.round(height*ratio),dpr:ratio,scale,x:(width-WORLD.width*scale)/2,y:(height-WORLD.height*scale)/2};
}
export const rulesFor = mode => mode==='practice'
  ? {gravity:.42,flapVelocity:-7.8,speed:2,gap:200}
  : {gravity:.45,flapVelocity:-8.3,speed:2.55,gap:150};
export function circleRectCollide(cx,cy,r,x,y,width,height) {
  const dx=cx-Math.max(x,Math.min(cx,x+width)),dy=cy-Math.max(y,Math.min(cy,y+height));
  return dx*dx+dy*dy<=r*r;
}
export function fixedStepper() {
  let remainder=0;
  return {reset(){remainder=0;},advance(milliseconds,step){remainder+=Math.max(0,Math.min(100,milliseconds));let count=0;while(remainder+1e-7>=1000/60 && count<6){step(1);remainder-=1000/60;count++;}return count;}};
}
export const MILESTONES=[{score:1,name:'First fish',icon:'🐟'},{score:5,name:'Bronze whiskers',icon:'🥉'},{score:10,name:'Silver paws',icon:'🥈'},{score:25,name:'Golden cat',icon:'🥇'},{score:50,name:'Nine lives legend',icon:'💎'}];
export const medalFor = score => [...MILESTONES].reverse().find(medal=>score>=medal.score) || {score:0,name:'Every cat starts somewhere',icon:'🐾'};
export function readFlightLog(value) {
  try {
    const parsed=typeof value==='string'?JSON.parse(value):value;
    const number=n=>Number.isSafeInteger(n)&&n>=0?n:0;
    return {runs:number(parsed?.runs),treats:number(parsed?.treats),recent:(Array.isArray(parsed?.recent)?parsed.recent:[]).filter(run=>run && ['classic','daily','practice'].includes(run.mode) && Number.isSafeInteger(run.score) && run.score>=0 && typeof run.cat==='string' && typeof run.day==='string').slice(0,8)};
  } catch{return {runs:0,treats:0,recent:[]};}
}
export function recordFlight(log,run) {
  const current=readFlightLog(log);
  return {runs:current.runs+1,treats:current.treats+run.score,recent:[run,...current.recent].slice(0,8)};
}
export function resultText(run) {
  const mode=run.mode==='daily'?`Daily · ${run.day}`:run.mode==='practice'?'Practice':'Classic';
  return `Flapurr! ${medalFor(run.score).icon}\n${run.cat} · ${mode}\n${run.score} treats · ${medalFor(run.score).name}\nhttps://gitcrazygitwild.github.io/Flapurr/`;
}
