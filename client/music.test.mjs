import test from 'node:test';
import assert from 'node:assert/strict';
import {writtenKey,deckMusic} from './music.js';

test('instrument keys transpose every concert key in major and minor',()=>{
 for(const mode of ['major','minor'])for(const [instrument,offset] of Object.entries({C:0,Bb:2,Eb:9,F:7})){
  for(let key=0;key<12;key++)assert.equal(writtenKey(key,instrument,mode),writtenKey((key+offset)%12,'C',mode));
  assert.equal(writtenKey(null,instrument,mode),'—');
 }
 assert.equal(writtenKey(0,'F','major'),'G');
 assert.equal(writtenKey(0,'Bb','major'),'D');
 assert.equal(writtenKey(0,'Eb','minor'),'A');
});

test('both deck displays share key decoding, playback-key preference and tempo formatting',()=>{
 assert.deepEqual(deckMusic({loaded:1,songKey:0,bpm:123.456}),{key:0,mode:'major',bpm:123.5});
 assert.deepEqual(deckMusic({loaded:1,songKey:0,playbackKey:1,bpm:124}),{key:9,mode:'minor',bpm:124});
 for(const encoded of [-1,24,null,undefined])assert.equal(deckMusic({songKey:encoded}).key,null);
 assert.equal(deckMusic({songKey:0,playbackKey:24}).key,null);
 for(const bpm of [0,-1,null,undefined,Infinity])assert.equal(deckMusic({bpm}).bpm,null);
 assert.deepEqual(deckMusic({loaded:0,songKey:0,playbackKey:1,bpm:124}),{key:null,mode:'major',bpm:null});
});
