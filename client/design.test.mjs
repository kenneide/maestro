import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadPreferences} from './preferences.js';
const tokens=JSON.parse(readFileSync(new URL('../design/tokens.json',import.meta.url)));
const luminance=hex=>{
 const values=hex.slice(1,7).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return values[0]*.2126+values[1]*.7152+values[2]*.0722;
};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('shared theme text, cue, border and focus contrast',()=>{
 for(const p of Object.values(tokens.themes)){
  for(const bg of ['bg','surface','raised'])for(const fg of ['ink','muted','accent','amber','cueRed','cueGreen','cueUnknown'])assert.ok(contrast(p[fg],p[bg])>=4.5,`${fg} on ${bg}`);
  for(const fg of ['cueRed','cueGreen','cueUnknown'])for(const bg of ['bg','surface']){
   const mixed='#'+p[fg].slice(1).match(/../g).map((v,i)=>Math.round(parseInt(v,16)*.14+parseInt(p[bg].slice(1+i*2,3+i*2),16)*.86).toString(16).padStart(2,'0')).join('');
   assert.ok(contrast(p[fg],mixed)>=4.5,`${fg} on tinted ${bg}`);
  }
  assert.ok(contrast(p.onAccent,p.accent)>=4.5);
  for(const bg of ['bg','surface'])for(const fg of ['line','focus'])assert.ok(contrast(p[fg],p[bg])>=3,`${fg} on ${bg}`);
 }
});
test('Maestro preferences migrate existing musician settings once',()=>{
 const values=new Map([['horizon-preferences',JSON.stringify({instrument:'tenor',horizon:20,volume:.4,followedDeck:2})]]);
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const migrated=loadPreferences(storage);
 assert.deepEqual(migrated,{instrument:'Bb',horizon:20,volume:.4,followedDeck:2});
 assert.equal(values.get('maestro-preferences'),JSON.stringify(migrated));
 values.set('horizon-preferences','{}');
 assert.deepEqual(loadPreferences(storage),migrated);
 assert.deepEqual(loadPreferences({getItem(){throw Error();}}),{});
 assert.deepEqual(loadPreferences({getItem(){return 'null';}}),{});
});
test('theme applies before rendering, persists, and tolerates unavailable storage',()=>{
 const script=readFileSync(new URL('./theme.js',import.meta.url),'utf8');
 for(const initial of [null,'light','invalid']){
  const values=new Map(initial?[['maestro-theme',initial]]:[]),document={addEventListener(){},readyState:'loading',documentElement:{dataset:{}},querySelector:()=>({setAttribute(){}})};
  const context={document,window:{},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};
  vm.runInNewContext(script,context);
  assert.equal(document.documentElement.dataset.theme,initial==='light'?'light':'dark');
  context.window.maestroTheme.set('light');assert.equal(values.get('maestro-theme'),'light');
 }
 const context={document:{addEventListener(){},readyState:'loading',documentElement:{dataset:{}},querySelector:()=>null},window:{},get localStorage(){throw Error();}};
 vm.runInNewContext(script,context);assert.equal(context.document.documentElement.dataset.theme,'dark');
});

test('instrument preferences support keys and migrate saxophone choices',()=>{
 for(const [before,after] of Object.entries({concert:'C',tenor:'Bb',soprano:'Bb',alto:'Eb',baritone:'Eb',C:'C',Bb:'Bb',Eb:'Eb',F:'F',invalid:'Eb'})){
  assert.equal(loadPreferences({getItem:()=>JSON.stringify({instrument:before})}).instrument,after);
 }
 assert.equal(loadPreferences({getItem:()=>null}).instrument,'Eb');
});
