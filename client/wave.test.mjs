import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeWave,createPlayout,advancePlayout,waveSpan,waveDelay,waveWindowMs} from './wave.js';

const points=(from,to)=>Array.from({length:to-from+1},(_,i)=>[from+i,-.1,.1]);

test('overlapping snapshots merge into one bounded strip and restarts begin a new one',()=>{
 let buffer=mergeWave([],points(0,79));
 buffer=mergeWave(buffer,points(4,83));
 assert.deepEqual(buffer.map(p=>p[0]),points(0,83).map(p=>p[0]));
 assert.equal(mergeWave(buffer,[]),buffer);
 buffer=mergeWave(buffer,points(84,500));
 assert.equal(buffer.length,waveSpan);assert.equal(buffer[0][0],500-waveSpan+1);
 assert.deepEqual(mergeWave(buffer,points(0,3)).map(p=>p[0]),[0,1,2,3],'seq restart');
 assert.equal(mergeWave(buffer,points(2000,2001))[0][0],2000,'long gap');
});

test('playout scrolls at a steady rate behind the newest point and absorbs batching',()=>{
 const clock=createPlayout();
 assert.equal(advancePlayout(clock,100,0),100-waveDelay);
 let newest=100,positions=[];
 // Points arrive four at a time every 100 ms; the strip is drawn every 16 ms.
 for(let now=16;now<=4000;now+=16){
  if(now%100<16)newest+=4;
  positions.push(advancePlayout(clock,newest,now));
 }
 const steps=positions.slice(1).map((p,i)=>p-positions[i]);
 for(const step of steps){assert.ok(step>0,'never moves backwards');assert.ok(Math.abs(step-16/waveWindowMs)<=.05*16/waveWindowMs+1e-9,'speed within 5%');}
 assert.ok(Math.abs(newest-waveDelay-positions.at(-1))<6,'tracks the delayed target');
 assert.equal(advancePlayout(clock,5000,4016),5000-waveDelay,'snaps when far behind');
 const held=advancePlayout(clock,5000,9000);
 assert.ok(held<=5000,'never runs past the newest point');
});
