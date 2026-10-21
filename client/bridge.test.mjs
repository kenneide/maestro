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

async function until(predicate){
 for(let i=0;i<100;i++){if(predicate())return;await wait(20);}
 assert.fail('Timed out waiting for UDP state');
}
const send=(socket,packet,port,host='127.0.0.1')=>new Promise((resolve,reject)=>socket.send(packet,port,host,e=>e?reject(e):resolve()));

test('passive LAN bridge logs bounded messages, unknown addresses and decode errors',{timeout:10000},async()=>{
 const sender=dgram.createSocket('udp4');
 const bridge=createBridge({receiveHost:'0.0.0.0',receivePort:0,requestHost:''});
 try{
  await until(()=>bridge.snapshot().ready);
  const {receivePort}=bridge.snapshot();
  assert.equal(bridge.snapshot().receiveHost,'0.0.0.0');
  assert.equal(bridge.snapshot().requestsEnabled,false);
  assert.equal(bridge.dump(),false);
  await send(sender,message('/custom/value',7),receivePort);
  await until(()=>bridge.snapshot().incomingPackets===1);
  assert.equal(bridge.snapshot().packets,0);
  assert.equal(bridge.snapshot().status,'waiting');
  assert.equal(bridge.snapshot().recentMessages[0].address,'/custom/value');
  assert.deepEqual(bridge.snapshot().recentMessages[0].args,[7]);
  await send(sender,Buffer.from('bad'),receivePort);
  await until(()=>bridge.snapshot().malformed===1);
  assert.match(bridge.snapshot().recentMessages.at(-1).error,/Invalid OSC/);
  assert.equal(bridge.snapshot().recentMessages.at(-1).hex,'626164');
  const packet=Buffer.concat([str('/custom/title'),str(',s'),str('x'.repeat(1000))]);
  await send(sender,packet,receivePort);
  await until(()=>bridge.snapshot().incomingPackets===3);
  assert.ok(bridge.snapshot().recentMessages.at(-1).args[0].length<=65);
  for(let i=0;i<105;i++){
   await send(sender,message('/djay/turntable1/playback/time',i),receivePort);
   await until(()=>bridge.snapshot().incomingPackets===i+4);
  }
  const state=bridge.snapshot();
  assert.equal(state.recentMessages.length,100);
  assert.equal(state.decks[0].values.time,104);
  assert.ok(state.lastRecognized>0);
  assert.equal(state.lastSender.port,sender.address().port);
  assert.equal(state.lastSender.address,'127.0.0.1');
 }finally{bridge.close();sender.close();}
});

test('LAN interface packets update stage data and requests use the configured host',{timeout:10000},async t=>{
 const {networkInterfaces}=await import('node:os');
 const address=Object.values(networkInterfaces()).flat().find(info=>info.family==='IPv4'&&!info.internal)?.address;
 if(!address){t.skip('No IPv4 LAN interface available');return;}
 const receiver=dgram.createSocket('udp4'),sender=dgram.createSocket('udp4');let bridge;
 try{
  await new Promise((resolve,reject)=>{receiver.once('error',reject);receiver.bind(0,address,resolve);});
  const request=new Promise(resolve=>receiver.once('message',data=>resolve(decodePacket(data))));
  bridge=createBridge({receiveHost:'0.0.0.0',receivePort:0,requestHost:address,requestPort:receiver.address().port});
  await until(()=>bridge.snapshot().ready);
  const result=await Promise.race([request,wait(2000).then(()=>{throw Error('Missing remote dump request');})]);
  assert.equal(result[0].address,'/djay/request/dumpAll');
  assert.equal(bridge.snapshot().requestHost,address);
  assert.ok(bridge.snapshot().destinations.includes(address));
  await send(sender,message('/djay/turntable1/song/loaded',1),bridge.snapshot().receivePort,address);
  await send(sender,message('/djay/turntable1/playback/time',42),bridge.snapshot().receivePort,address);
  await until(()=>bridge.snapshot().decks[0].values.time===42);
  assert.equal(bridge.snapshot().lastSender.address,address);
 }finally{bridge?.close();receiver.close();sender.close();}
});

test('performer cue from the Maestro plugin is tracked without counting as djay data',{timeout:10000},async()=>{
 const sender=dgram.createSocket('udp4');
 const bridge=createBridge({receivePort:0,requestHost:''});
 const cue=(...values)=>Buffer.concat([str('/maestro/cue'),values.every(v=>typeof v==='string')?Buffer.concat([str(','+'s'.repeat(values.length)),...values.map(str)]):Buffer.concat([str(',i'),Buffer.alloc(4)])]);
 try{
  await until(()=>bridge.snapshot().ready);
  const {receivePort}=bridge.snapshot();
  assert.equal(bridge.snapshot().cue,null);
  await send(sender,cue('green'),receivePort);
  await until(()=>bridge.snapshot().cue?.state==='green');
  await send(sender,cue('red'),receivePort);
  await until(()=>bridge.snapshot().cue?.state==='red');
  await send(sender,cue('amber','green'),receivePort);
  await until(()=>bridge.snapshot().cue?.state==='amber');
  assert.equal(bridge.snapshot().cue.next,'green');
  await send(sender,cue('amber','red'),receivePort);
  await until(()=>bridge.snapshot().cue?.next==='red');
  await send(sender,cue('red'),receivePort);
  await until(()=>bridge.snapshot().cue?.state==='red');
  assert.equal('next' in bridge.snapshot().cue,false);
  await send(sender,cue('blue'),receivePort);
  await send(sender,cue(1),receivePort);
  await send(sender,cue('amber'),receivePort);
  await send(sender,cue('amber','blue'),receivePort);
  await send(sender,cue('green','red'),receivePort);
  await until(()=>bridge.snapshot().incomingPackets===10);
  const state=bridge.snapshot();
  assert.equal(state.cue.state,'red');
  assert.equal(state.packets,0);
  assert.equal(state.status,'waiting');
 }finally{bridge.close();sender.close();}
});

test('waveform bundles from the Maestro plugin fill an 8 second strip without flooding the message log',{timeout:10000},async()=>{
 const sender=dgram.createSocket('udp4');
 const bridge=createBridge({receivePort:0,requestHost:''});
 const point=(seq,min,max)=>{const b=Buffer.alloc(12);b.writeInt32BE(seq);b.writeFloatBE(min,4);b.writeFloatBE(max,8);return Buffer.concat([str('/maestro/wave'),str(',iff'),b]);};
 const bundle=(...messages)=>Buffer.concat([str('#bundle'),Buffer.alloc(8),...messages.flatMap(m=>{const size=Buffer.alloc(4);size.writeInt32BE(m.length);return [size,m];})]);
 try{
  await until(()=>bridge.snapshot().ready);
  const {receivePort}=bridge.snapshot();
  await send(sender,bundle(point(10,-.5,.25),point(11,-2,2)),receivePort);
  await until(()=>bridge.snapshot().wave.points.length===2);
  assert.deepEqual(bridge.snapshot().wave.points,[[10,-.5,.25],[11,-1,1]]);
  await send(sender,Buffer.concat([str('/maestro/wave'),str(',sff'),str('x'),Buffer.alloc(8)]),receivePort);
  for(let seq=12;seq<12+400;seq+=50)await send(sender,bundle(...Array.from({length:50},(_,i)=>point(seq+i,0,0))),receivePort);
  await until(()=>bridge.snapshot().waveMessages===403);
  const state=bridge.snapshot();
  assert.equal(state.wave.points.length,80,'regular updates carry the last 2 s');
  assert.equal(state.wave.points.at(-1)[0],411);
  assert.equal(bridge.snapshot({waveSeconds:8}).wave.points.length,320);
  assert.equal(state.recentMessages.length,0);
  assert.equal(state.packets,0);
  await send(sender,point(3,0,.1),receivePort);
  await until(()=>bridge.snapshot().wave.points.length===1);
  assert.equal(bridge.snapshot().wave.points[0][0],3,'seq restart begins a fresh strip');
 }finally{bridge.close();sender.close();}
});
