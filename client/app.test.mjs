import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {formatTime,writtenKey,deckMusic,chooseCrossfaderDeck} from './music.js';
import {loadPreferences} from './preferences.js';
import {mergeWave,createPlayout,advancePlayout,waveSpan} from './wave.js';

function createClient(){
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{textContent:'',value:'',dataset:{},listeners:{},children:[],parentElement:{dataset:{}},classList:{toggle(){}},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){(this.attributes??={})[name]=value;},removeAttribute(name){delete this.attributes?.[name];},focus(){},showModal(){this.open=true;},close(){this.open=false;}}]));
 elements.get('beatDots').children=Array.from({length:4},()=>({classList:{toggle(){}}}));
 const drawing={fills:0,idle:0},frames=[];
 Object.assign(elements.get('waveform'),{width:0,height:0,getBoundingClientRect:()=>({width:320,height:48}),getContext:()=>({clearRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){drawing.fills++;},fillRect(){drawing.idle++;},createLinearGradient:()=>({addColorStop(){}})})});
 const storage=new Map();let events,timer,now=10000;
 const document={getElementById:id=>{assert.ok(elements.has(id),`Missing element ${id}`);return elements.get(id);},documentElement:{dataset:{}},visibilityState:'visible',addEventListener(){}};
 const context={document,window:{devicePixelRatio:2,maestroTheme:{set(theme){document.documentElement.dataset.theme=theme;}}},navigator:{},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:false}),EventSource:class{constructor(){events=this;}},setInterval(fn){timer=fn;},setTimeout(){},clearTimeout(){},Date:class extends Date{static now(){return now;}},performance:{now:()=>now},requestAnimationFrame:fn=>frames.push(fn),getComputedStyle:()=>({getPropertyValue:()=>'#888888'}),mergeWave,createPlayout,advancePlayout,waveSpan,formatTime,writtenKey,deckMusic,chooseCrossfaderDeck,loadPreferences};
 const script=readFileSync(new URL('./app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(script,context);
 return {get:id=>elements.get(id),storage,document,drawing,get now(){return now;},
  frame(){const pending=frames.splice(0);for(const fn of pending)fn(now);return pending.length;},
  send(snapshot){events.onmessage({data:JSON.stringify(snapshot)});},
  advance(ms){now+=ms;timer();},disconnect(){events.onerror();}};
}

test('live musician view follows decks, expires data, saves settings and filters diagnostics',()=>{
 const client=createClient(),{get,storage,document}=client;
 let now=client.now;
 assert.equal(get('trackTitle').textContent,'Deck 1 · Waiting for djay');
 assert.equal(get('cueLight').textContent,'Stop');assert.equal(get('performerCue').dataset.action,'stop');
 assert.equal(get('currentTime').textContent,'');
 const deck=(title,time)=>({values:{loaded:1,title,artist:'Artist',duration:240,time,songKey:0,bpm:120,bar:4,beat:2,playing:1,phase:.25,loop:0},updated:{time:now}});
 const snapshot={now,status:'receiving',decks:[deck('First',30),deck('Second',60),deck('',0),deck('',0)],mixer:{crossfader:0},cue:{state:'green',updated:now},addresses:[],recentMessages:[{timestamp:now,sender:{address:'127.0.0.1',port:9000},address:'/djay/time',args:[30]}]};
 const send=()=>client.send(snapshot);
 send();assert.equal(get('trackTitle').textContent,'Deck 1 · First');assert.equal(get('currentTime').textContent,'0:30');assert.equal(get('writtenKey').textContent,'A');assert.equal(get('cueLight').textContent,'Play');assert.equal(get('performerCue').dataset.action,'play');
 assert.equal(get('trackProgress').value,.125);assert.equal(get('trackTimeline').dataset.available,'true');
 get('settingsButton').listeners.click();assert.equal(get('settings').open,true);
 get('instrument').listeners.change({target:{value:'F'}});assert.equal(get('writtenKey').textContent,'G');assert.equal(JSON.parse(storage.get('maestro-preferences')).instrument,'F');
 get('themeToggle').listeners.click();assert.equal(document.documentElement.dataset.theme,'light');assert.equal(get('themeToggle').attributes['aria-label'],'Switch to dark mode');
 get('themeToggle').listeners.click();assert.equal(document.documentElement.dataset.theme,'dark');
 get('closeSettings').listeners.click();assert.equal(get('settings').open,false);
 assert.equal(get('cueNext').textContent,'');
 snapshot.cue={state:'amber',next:'green',updated:now};send();assert.equal(get('cueLight').textContent,'Ready');assert.equal(get('performerCue').dataset.action,'ready');assert.equal(get('cueNext').textContent,'Next: Play');
 snapshot.cue={state:'amber',next:'red',updated:now};send();assert.equal(get('cueNext').textContent,'Next: Stop');assert.match(get('cueDiagnostic').textContent,/stop you/);
 snapshot.cue={state:'green',updated:now};send();assert.equal(get('cueNext').textContent,'');
 snapshot.mixer.crossfader=.5;send();assert.equal(get('trackTitle').textContent,'Deck 1 · First');
 snapshot.mixer.crossfader=1;send();assert.equal(get('trackTitle').textContent,'Deck 2 · Second');assert.equal(get('currentTime').textContent,'1:00');assert.equal(JSON.parse(storage.get('maestro-preferences')).followedDeck,2);
 get('debugDetails').open=true;get('messageDetails').open=true;get('messageFilter').value='';get('debugDetails').listeners.toggle();assert.match(get('messageLog').textContent,/\/djay\/time/);
 get('messageFilter').value='unmatched';get('messageFilter').listeners.input();assert.equal(get('messageLog').textContent,'No messages match this filter.');
 get('clearMessageFilter').listeners.click();assert.match(get('messageLog').textContent,/\/djay\/time/);
 now+=3500;client.advance(3500);assert.equal(get('trackTimeline').dataset.available,'false');assert.equal(get('trackProgress').value,0);assert.equal(get('currentTime').textContent,'');assert.equal(get('timeStatus').textContent,'');assert.equal(get('cueLight').textContent,'Stop');assert.equal(get('performerCue').dataset.action,'stop');
 snapshot.now=now;snapshot.decks[1]=deck('Recovered',90);snapshot.cue={state:'red',updated:now};send();assert.equal(get('currentTime').textContent,'1:30');assert.equal(get('trackTimeline').dataset.available,'true');assert.equal(get('cueLight').textContent,'Stop');assert.equal(get('performerCue').dataset.action,'stop');
 snapshot.decks[1]={values:{loaded:0},updated:{}};send();assert.equal(get('writtenKey').textContent,'—');assert.equal(get('duration').textContent,'');
 client.disconnect();assert.equal(get('connectionText').textContent,'Waiting for djay');
});

test('other deck follows the opposite deck through blends and instrument changes',()=>{
 const client=createClient(),{get}=client;
 const deck=(title,playing)=>({values:{loaded:1,title,artist:'Artist',time:30,duration:240,songKey:0,bpm:124.36,playing},updated:{time:client.now,playing:client.now}});
 const snapshot={now:client.now,status:'receiving',decks:[deck('First',1),deck('Second',0),{},{}],mixer:{crossfader:0},addresses:[]};
 const send=()=>client.send(snapshot);
 assert.equal(get('otherDeck').hidden,true);
 send();
 assert.equal(get('otherDeck').hidden,false);
 assert.equal(get('otherDeckTrack').textContent,'Preview · Deck 2 · Second — Artist');
 assert.equal(get('otherDeckDetails').textContent,'A major · 124.4 BPM · Paused');
 snapshot.decks[1].values.playbackKey=1;send();
 assert.equal(get('otherDeckDetails').textContent,'F♯ minor · 124.4 BPM · Paused');
 get('instrument').listeners.change({target:{value:'Bb'}});
 assert.equal(get('otherDeckDetails').textContent,'B minor · 124.4 BPM · Paused');
 assert.equal(get('writtenKey').textContent,'D');
 snapshot.mixer.crossfader=.5;snapshot.decks[1].values.playing=1;send();
 assert.equal(get('trackTitle').textContent,'Deck 1 · First');
 assert.equal(get('otherDeckTrack').textContent,'Preview · Deck 2 · Second — Artist');
 assert.equal(get('otherDeckDetails').textContent,'B minor · 124.4 BPM · Playing');
 snapshot.mixer.crossfader=1;send();
 assert.equal(get('trackTitle').textContent,'Deck 2 · Second');
 assert.equal(get('otherDeckTrack').textContent,'Preview · Deck 1 · First — Artist');
 assert.equal(get('otherDeckDetails').textContent,'D major · 124.4 BPM · Playing');
 snapshot.mixer.crossfader=.5;send();assert.match(get('otherDeckTrack').textContent,/Deck 1/);
 snapshot.mixer.crossfader=0;send();assert.match(get('otherDeckTrack').textContent,/Deck 2/);
 // Main-deck position can be missing while the other deck still has useful metadata.
 delete snapshot.decks[0].values.time;send();
 assert.equal(get('trackTimeline').dataset.available,'false');
 assert.equal(get('otherDeck').hidden,false);
});

test('other deck omits absent metadata and stale status, clears on unload or disconnection',()=>{
 const client=createClient(),{get}=client;
 const other={values:{loaded:1,title:'Other song',playing:0},updated:{playing:client.now}};
 const snapshot={now:client.now,status:'receiving',decks:[{values:{},updated:{}},other,{},{}],mixer:{crossfader:0},addresses:[]};
 const send=()=>client.send(snapshot);
 send();assert.equal(get('otherDeckTrack').textContent,'Preview · Deck 2 · Other song');
 assert.equal(get('otherDeckDetails').textContent,'Paused');
 other.updated.playing=client.now-6500;send();assert.equal(get('otherDeckDetails').textContent,'Paused');
 other.updated.playing--;send();assert.equal(get('otherDeckDetails').textContent,'');
 other.updated.playing=client.now-6000;send();client.advance(1000);
 assert.equal(get('otherDeck').hidden,false);assert.equal(get('otherDeckDetails').textContent,'');
 snapshot.now=client.now;other.updated.playing=client.now;send();
 assert.equal(get('otherDeckDetails').textContent,'Paused');
 delete other.updated.playing;send();assert.equal(get('otherDeckDetails').textContent,'');
 other.values.songKey=24;other.values.bpm=0;send();assert.equal(get('otherDeckDetails').textContent,'');
 other.values.loaded=0;send();assert.equal(get('otherDeck').hidden,true);assert.equal(get('otherDeckTrack').textContent,'');
 // A title replacement clears the former track's metadata until the new load is reported.
 other.values={title:'Replacement'};send();assert.equal(get('otherDeck').hidden,true);
 other.values.loaded=1;send();assert.equal(get('otherDeck').hidden,false);
 assert.equal(get('otherDeckTrack').textContent,'Preview · Deck 2 · Replacement');
 assert.equal(get('otherDeckDetails').textContent,'');
 other.values.title='  ';send();assert.equal(get('otherDeck').hidden,true);
 other.values.title='Restored';send();assert.equal(get('otherDeck').hidden,false);
 snapshot.status='stale';send();assert.equal(get('otherDeck').hidden,true);
 snapshot.status='receiving';send();assert.equal(get('otherDeck').hidden,false);
 client.disconnect();assert.equal(get('otherDeck').hidden,true);
 send();assert.equal(get('otherDeck').hidden,false);
 client.advance(2600);assert.equal(get('otherDeck').hidden,true);
});

test('waveform scrolls while plugin points are fresh and rests on a flat line when they stop',()=>{
 const client=createClient(),{get,drawing}=client;
 assert.equal(get('waveform').width,640,'canvas sized for device pixels');
 assert.ok(drawing.idle>0,'idle line before any points');
 const deck={values:{loaded:1,title:'First',time:30},updated:{time:client.now}};
 const snapshot=now=>({now,status:'receiving',decks:[deck,deck,deck,deck],mixer:{crossfader:0},cue:null,addresses:[],recentMessages:[],waveMessages:80,wave:{updated:now,points:Array.from({length:80},(_,i)=>[i,-.5,.5])}});
 client.send(snapshot(client.now));
 assert.equal(client.frame(),1);assert.ok(drawing.fills>0,'waveform drawn');
 assert.match(get('waveDiagnostic').textContent,/80 points/);
 assert.equal(client.frame(),1,'keeps animating while fresh');
 const idle=drawing.idle;client.advance(1500);
 assert.equal(client.frame(),1);assert.ok(drawing.idle>idle,'flat line once stale');
 assert.equal(client.frame(),0,'animation stops when stale');
});
