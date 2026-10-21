// Scrolling waveform from the Maestro plugin: one [seq,min,max] point per 25 ms window.
export const waveWindowMs=25,waveSpan=320,waveDelay=12;
// Snapshots overlap (each carries the last 2 s), so keep only points newer than the buffer.
export function mergeWave(buffer,points){
 if(!points.length)return buffer;
 const last=buffer.at(-1)?.[0],newest=points.at(-1)[0];
 // A plugin restart or a long gap starts a fresh strip.
 if(last===undefined||newest<last||points[0][0]-last>waveSpan)return points.slice(-waveSpan);
 const merged=buffer.concat(points.filter(point=>point[0]>last));
 return merged.length>waveSpan?merged.slice(-waveSpan):merged;
}
// Jitter buffer: the strip moves at exactly one window per 25 ms and trails the newest
// point by waveDelay windows, easing its speed by at most 5% to absorb batched arrivals.
export function createPlayout(){return {pos:null,at:0};}
export function advancePlayout(clock,newest,now){
 const target=newest-waveDelay;
 if(clock.pos===null||Math.abs(target-clock.pos)>40){clock.pos=target;clock.at=now;return clock.pos;}
 const elapsed=Math.max(0,Math.min(now-clock.at,250))/waveWindowMs;clock.at=now;
 const rate=1+Math.max(-.05,Math.min(.05,(target-clock.pos)*.01));
 clock.pos=Math.min(newest,clock.pos+elapsed*rate);
 return clock.pos;
}
