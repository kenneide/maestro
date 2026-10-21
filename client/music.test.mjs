import test from 'node:test';
import assert from 'node:assert/strict';
import {writtenKey} from './music.js';

test('instrument keys transpose every concert key in major and minor',()=>{
 for(const mode of ['major','minor'])for(const [instrument,offset] of Object.entries({C:0,Bb:2,Eb:9,F:7})){
  for(let key=0;key<12;key++)assert.equal(writtenKey(key,instrument,mode),writtenKey((key+offset)%12,'C',mode));
  assert.equal(writtenKey(null,instrument,mode),'—');
 }
 assert.equal(writtenKey(0,'F','major'),'G');
 assert.equal(writtenKey(0,'Bb','major'),'D');
 assert.equal(writtenKey(0,'Eb','minor'),'A');
});
