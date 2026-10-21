import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePacket,encodeMessage,applyMessage,newDeck} from './osc.mjs';
function str(s){const b=Buffer.from(s+'\0'),r=Buffer.alloc(Math.ceil(b.length/4)*4);b.copy(r);return r;}
function message(address,type,value){let data;if(type==='s')data=str(value);else {data=Buffer.alloc(4);if(type==='i')data.writeInt32BE(value);else data.writeFloatBE(value);}return Buffer.concat([str(address),str(','+type),data]);}
function bundle(...messages){return Buffer.concat([str('#bundle'),Buffer.alloc(8),...messages.flatMap(m=>{const size=Buffer.alloc(4);size.writeInt32BE(m.length);return [size,m];})]);}
test('OSC request, messages and nested bundles decode',()=>{
 assert.deepEqual(decodePacket(encodeMessage('/djay/request/dumpAll')),[{address:'/djay/request/dumpAll',args:[]}]);
 const packet=bundle(message('/djay/turntable1/song/title','s','Test track'),bundle(message('/djay/turntable1/playback/time','f',12.5)));
 assert.deepEqual(decodePacket(packet).map(m=>m.args[0]),['Test track',12.5]);
});
test('truncated packets, malformed bundles and unsupported types fail closed',()=>{
 const p=message('/a','i',5);assert.throws(()=>decodePacket(p.subarray(0,p.length-1)));
 assert.throws(()=>decodePacket(Buffer.concat([str('/a'),str(',x')])));
 const b=bundle(p);b.writeInt32BE(-1,16);assert.throws(()=>decodePacket(b));
});
test('track changes and unload clear stale key and timing',()=>{
 const decks=Array.from({length:4},(_,i)=>newDeck(i+1));
 const put=(field,value)=>applyMessage(decks,{address:'/djay/turntable1/'+field,args:[value]},100);
 put('song/title','Track A');put('song/key',15);put('playback/time',10);put('song/title','Track B');
 assert.equal(decks[0].generation,1);assert.equal(decks[0].values.songKey,undefined);assert.equal(decks[0].values.time,undefined);
 put('song/key',5);put('song/key',-1);assert.equal(decks[0].values.songKey,null);
 put('playback/time',30);put('song/loaded',0);assert.equal(decks[0].values.time,undefined);assert.equal(decks[0].values.loaded,0);
 assert.equal(put('playback/time',NaN),false);assert.equal(put('playback/playing',2),false);
});
test('live playback and loop values remain per deck',()=>{
 const decks=Array.from({length:4},(_,i)=>newDeck(i+1));
 for(const packet of [message('/djay/turntable2/playback/key','i',15),message('/djay/turntable2/loop/active','i',1)])for(const m of decodePacket(packet))applyMessage(decks,m,100);
 assert.equal(decks[1].values.playbackKey,15);assert.equal(decks[1].values.loop,1);assert.equal(decks[0].values.playbackKey,undefined);
});
