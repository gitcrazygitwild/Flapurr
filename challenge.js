export function challengeDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-');
}
export function daySeed(day) {
  let seed = 2166136261;
  for (const char of `flapurr-course-v1:${day}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return seed >>> 0;
}
export function courseRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export const HOUSE_CATS = [
  {name:'Hubert',body:'#896448',ear:'#654b3d',stripe:'#513b30',eyes:'#edc752'},
  {name:'Mack',body:'#ad8660',ear:'#947051',stripe:'#6b4b35',eyes:'#9fc66d'},
  {name:'Mia',body:'#dfcfb7',ear:'#8f7d70',stripe:'#a48d78',eyes:'#8abde0'}
];
export const dailyBestKey = day => `flapurr_daily_v1_${day}`;
