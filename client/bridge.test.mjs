import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {createBridge} from './bridge.mjs';
import {decodePacket} from './osc.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const str=s=>{const b=Buffer.from(s+'\0'),out=Buffer.alloc(Math.ceil(b.length/4)*4);b.copy(out);return out;};
const message=(path,value)=>{const b=Buffer.alloc(4);b.writeFloatBE(value);return Buffer.concat([str(path),str(',f'),b]);};
test('isolated UDP bridge receives state, throttles requests and becomes stale',{timeout:10000},async()=>{
 const receiver=dgram.createSocket('udp4'),sender=dgram.createSocket('udp4');let bridge,requests=0;
 try{
  await new Promise((resolve,reject)=>{receiver.once('error',reject);receiver.bind(19011,'127.0.0.1',resolve);});
  receiver.on('message',data=>{assert.equal(decodePacket(data)[0].address,'/djay/request/dumpAll');requests++;});
  bridge=createBridge({receivePort:19010,requestPort:19011});
  for(let i=0;i<20&&!bridge.snapshot().ready;i++)await wait(20);
  assert.equal(bridge.snapshot().ready,true);assert.equal(bridge.dump(),false);
  for(const [path,value] of [['song/loaded',1],['playback/playing',1],['playback/time',12.5],['loop/active',1]])await new Promise((resolve,reject)=>sender.send(message('/djay/turntable1/'+path,value),19010,'127.0.0.1',e=>e?reject(e):resolve()));
  await wait(50);const first=bridge.snapshot();assert.equal(first.status,'receiving');assert.equal(first.decks[0].values.time,12.5);assert.equal(first.decks[0].values.loop,1);assert.equal(first.malformed,0);assert.equal(requests,1);
  await wait(1150);assert.equal(bridge.dump(),true);assert.equal(bridge.dump(),false);
  await wait(1500);assert.equal(bridge.snapshot().status,'stale');
  sender.send(Buffer.from('bad'),19010,'127.0.0.1');await wait(30);assert.equal(bridge.snapshot().malformed,1);
 }finally{bridge?.close();receiver.close();sender.close();}
});
