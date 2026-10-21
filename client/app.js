import {formatTime,writtenKey,deckMusic,chooseCrossfaderDeck} from './music.js';
import {loadPreferences} from './preferences.js';
import {mergeWave,createPlayout,advancePlayout,waveSpan} from './wave.js';
const $=id=>document.getElementById(id);
let saved={};try{saved=loadPreferences(localStorage);}catch{}
const state={instrument:saved.instrument||'Eb',title:'Waiting for djay',key:null,mode:'major',bpm:null,position:null,duration:null,playing:false};
const live={deck:saved.followedDeck===2?2:1,snapshot:null,received:0,connected:false,stale:true,values:{},positionKnown:false};
let toastTimer,wakeLock=null,wakePending=false;
$('instrument').value=state.instrument;
function persist(){try{localStorage.setItem('maestro-preferences',JSON.stringify({instrument:state.instrument,followedDeck:live.deck}));}catch{}}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
async function keepAwake(){
 const active=state.playing&&document.visibilityState==='visible';
 if(!active&&wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}
 if(active&&'wakeLock' in navigator&&!wakeLock&&!wakePending){
  wakePending=true;
  try{const lock=await navigator.wakeLock.request('screen');wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});if(!state.playing||document.visibilityState!=='visible'){await lock.release();if(wakeLock===lock)wakeLock=null;}}catch{}finally{wakePending=false;}
 }
}
function renderStatic(){
 $('trackTitle').textContent=`Deck ${live.deck} · ${state.title}`;
 $('trackSubtitle').textContent=live.values.artist||'';
 $('writtenKey').textContent=writtenKey(state.key,state.instrument,state.mode);
 $('writtenMode').textContent=state.key===null?'':state.mode;
 $('bpmDisplay').textContent=state.bpm??'—';
 const grid=!live.stale&&Number.isInteger(live.values.bar)&&Number.isInteger(live.values.beat)?{bar:live.values.bar,beat:live.values.beat}:null;
 [...$('beatDots').children].forEach((dot,i)=>dot.classList.toggle('active',Boolean(grid)&&grid.beat===i+1));
 const positionAvailable=state.position!==null;
 $('trackTimeline').dataset.available=String(positionAvailable);
 $('trackTimeline').setAttribute('aria-hidden',String(!positionAvailable));
 $('trackProgress').value=state.position!==null&&state.duration?Math.max(0,Math.min(1,state.position/state.duration)):0;
 $('currentTime').textContent=positionAvailable?formatTime(state.position):'';
 $('duration').textContent=positionAvailable&&state.duration!==null?formatTime(state.duration):'';
 $('timeStatus').textContent=!positionAvailable?'':state.playing?'Playing':'Paused';
 $('connectionText').textContent=live.stale?'Waiting for djay':`Connected · Deck ${live.deck}`;
 $('connectionText').parentElement.dataset.fresh=String(!live.stale);
 renderOtherDeck();
 keepAwake();
}
function renderOtherDeck(){
 const snapshot=live.snapshot,otherId=live.deck===1?2:1;
 const deck=snapshot?.decks[otherId-1],values=deck?.values;
 const elapsed=Math.max(0,Date.now()-live.received);
 const available=live.connected&&snapshot?.status==='receiving'&&elapsed<=2500&&values?.loaded===1&&typeof values.title==='string'&&values.title.trim()!=='';
 $('otherDeck').hidden=!available;
 $('otherDeckTrack').textContent='';$('otherDeckDetails').textContent='';
 $('otherDeckTrack').removeAttribute('title');
 if(!available)return;
 const {key,mode,bpm}=deckMusic(values);
 const track=`Preview · Deck ${otherId} · ${values.title}${values.artist?' — '+values.artist:''}`;
 const details=[];
 if(key!==null)details.push(`${writtenKey(key,state.instrument,mode)} ${mode}`);
 if(bpm!==null)details.push(`${bpm} BPM`);
 // A paused deck may only report playback state in the five-second state dump.
 const statusAge=snapshot.now-deck.updated?.playing+elapsed;
 if(statusAge>=0&&statusAge<=6500){
  if(values.playing===1)details.push('Playing');
  else if(values.playing===0)details.push('Paused');
 }
 $('otherDeckTrack').textContent=track;
 $('otherDeckTrack').setAttribute('title',track);
 $('otherDeckDetails').textContent=details.join(' · ');
}
$('settingsButton').addEventListener('click',()=>$('settings').showModal());
$('closeSettings').addEventListener('click',()=>$('settings').close());
$('instrument').addEventListener('change',e=>{state.instrument=e.target.value;persist();renderStatic();});
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notify('Use your browser’s View menu to enter full screen.');}catch{notify('Use your browser’s View menu to enter full screen.');}}
if(navigator.standalone||matchMedia('(display-mode: standalone)').matches)$('fullscreen').hidden=true;$('fullscreen').addEventListener('click',fullscreen);document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||$('settings').open||['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f')fullscreen();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){updateLive();renderCue();renderWave();}else keepAwake();});
function renderMessageLog(){
 if(!$('debugDetails').open||!$('messageDetails').open)return;
 const messages=live.snapshot?.recentMessages||[];
 const filter=$('messageFilter').value.trim().toLowerCase();
 const matches=filter?messages.filter(entry=>typeof entry.address==='string'&&entry.address.toLowerCase().includes(filter)):messages;
 const lines=matches.slice().reverse().map(entry=>`${new Date(entry.timestamp).toLocaleTimeString()} ${entry.sender.address}:${entry.sender.port} ${entry.error?`DECODE ERROR: ${entry.error} · hex ${entry.hex}`:`${entry.address} ${JSON.stringify(entry.args)}${entry.omittedArgs?` (+${entry.omittedArgs} arguments)`:''}`}`);
 const text=lines.join('\n')||(messages.length?'No messages match this filter.':'No messages received yet.');
 if($('messageLog').textContent!==text)$('messageLog').textContent=text;
 $('messageCount').textContent=`Showing ${matches.length} of ${messages.length} recent messages`;
 $('clearMessageFilter').disabled=$('messageFilter').value.length===0;
}
$('messageFilter').addEventListener('input',renderMessageLog);
$('clearMessageFilter').addEventListener('click',()=>{
 $('messageFilter').value='';
 renderMessageLog();
 $('messageFilter').focus();
});
$('messageDetails').addEventListener('toggle',renderMessageLog);
$('debugDetails').addEventListener('toggle',renderMessageLog);
function updateBridgeControls(){
 const snapshot=live.snapshot;
 const status=!live.connected?'Bridge disconnected':snapshot?.error?`OSC error: ${snapshot.error}`:snapshot?.status==='receiving'?'OSC receiving':snapshot?.status==='stale'?'OSC stream stale':`Waiting for OSC · ${snapshot?.receiveHost??'127.0.0.1'}:${snapshot?.receivePort??9000}`;
 $('liveStatus').textContent=status;
 $('liveStatus').dataset.fresh=String(live.connected&&snapshot?.status==='receiving'&&!live.stale);
 $('deckDiagnostic').textContent=`Deck ${live.deck} · ${live.stale?'waiting for fresh position':state.playing?'playing':'paused'}${live.values.loop===1?' · loop active':''} · ${Number.isFinite(live.crossfader)?live.crossfader>0.001&&live.crossfader<0.999?'holding through blend':'crossfader endpoint':'crossfader unavailable'}`;
 if(snapshot){
  $('receivePort').textContent=snapshot.receivePort;$('requestPort').textContent=snapshot.requestPort;
  $('receiveDestinations').textContent=(snapshot.destinations||['127.0.0.1']).join(' or ');
  const pages=snapshot.pageUrls||[];$('pageDiagnostic').hidden=!pages.length;if(pages.length)$('pageDiagnostic').textContent=`Open on iPhone/iPad (same Wi-Fi): ${pages.join(' or ')}, then Share → Add to Home Screen.`;
  $('refreshLive').disabled=!snapshot.requestsEnabled;
  $('requestDiagnostic').textContent=snapshot.requestsEnabled?`State requests go to ${snapshot.requestHost}:${snapshot.requestPort}.`:'Passive reception: state requests are disabled. The sender must stream updates.';
  const sender=snapshot.lastSender?`${snapshot.lastSender.address}:${snapshot.lastSender.port}`:'none';
  const recentSupported=snapshot.lastRecognized&&snapshot.now-snapshot.lastRecognized<=2500;
  $('packetDiagnostic').textContent=`${snapshot.incomingPackets} UDP packets received · last sender: ${sender} · ${recentSupported?'supported djay data received recently':snapshot.incomingPackets?'waiting for fresh supported djay data':'waiting for packets'}.`;
  renderMessageLog();
  $('bridgeDiagnostic').textContent=`Receiver ${snapshot.ready?'listening':'not ready'} · ${snapshot.packets} djay packets · ${snapshot.recognized} mapped values · ${snapshot.malformed} malformed packets. ${snapshot.error||''}`;
  $('keyDiagnostic').textContent=snapshot.addresses.some(a=>a.endsWith('/playback/key'))?'A playback/key address has been received. Verify its response to pitch shifts in djay before treating it as the sounding key.':'Only reported song keys are available so far. The PDF repeats song/key in its playback section; pitch-shift behavior remains unverified.';
 }
}
function updateLive(){
 const snapshot=live.snapshot;
 if(snapshot&&live.connected&&snapshot.status==='receiving'){
  live.crossfader=snapshot.mixer?.crossfader;
  const nextDeck=chooseCrossfaderDeck(live.crossfader,live.deck);
  if(nextDeck!==live.deck){live.deck=nextDeck;persist();}
 }
 const deck=snapshot?.decks[live.deck-1],values=deck?.values||{};
 live.values=values;
 live.positionKnown=values.loaded===1&&Number.isFinite(values.time);
 live.stale=!live.connected||!snapshot||snapshot.status!=='receiving'||Date.now()-live.received>2500||!live.positionKnown||snapshot.now-(deck?.updated.time||0)>2500;
 const active=values.loaded!==0;
 Object.assign(state,deckMusic(values),{title:values.loaded===0?'Empty':values.title||'Waiting for djay',duration:active&&Number.isFinite(values.duration)&&values.duration>0?values.duration:null,playing:!live.stale&&values.playing===1,position:!live.stale?Math.max(0,values.time):null});
 updateBridgeControls();renderStatic();
}
function renderCue(){
 const cue=live.snapshot?.cue,fresh=live.connected&&cue&&live.snapshot.now-cue.updated<=3000,value=fresh?cue.state:'unknown';
 // A server started before cue support omits the field entirely; it must be restarted to receive cues.
 const outdated=live.connected&&live.snapshot&&!('cue' in live.snapshot);
 const toPlay=value==='amber'&&cue.next==='green';
 const detail=value==='green'?'The DJ is cueing you in':value==='red'?'Hold until the DJ cues you':value==='amber'?(toPlay?'Get ready. The DJ is about to cue you in':'Get ready. The DJ is about to stop you'):outdated?'Maestro’s server is out of date. Restart it to receive cues.':'Waiting for the Maestro Cue plugin in djay';
 $('performerCue').dataset.action=value==='green'?'play':value==='amber'?'ready':'stop';
 $('cueLight').textContent=value==='green'?'Play':value==='amber'?'Ready':'Stop';
 $('cueNext').textContent=value==='amber'?`Next: ${toPlay?'Play':'Stop'}`:'';
 if($('cueDiagnostic').textContent!==detail)$('cueDiagnostic').textContent=detail;
 const waveDetail=live.snapshot?.wave?.updated?`Waveform: ${live.snapshot.waveMessages} points received`:'Waveform: waiting for the Maestro Cue plugin';
 if($('waveDiagnostic').textContent!==waveDetail)$('waveDiagnostic').textContent=waveDetail;
}
const waveCanvas=$('waveform'),waveContext=waveCanvas.getContext?.('2d');
const wave={points:[],clock:createPlayout(),frame:0,colour:'',idle:''};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function waveFresh(){const updated=live.snapshot?.wave?.updated;return live.connected&&Boolean(updated)&&wave.points.length>0&&live.snapshot.now-updated+Date.now()-live.received<=1000;}
function readWaveColours(){const style=getComputedStyle(document.documentElement);wave.colour=style.getPropertyValue('--accent').trim();wave.idle=style.getPropertyValue('--line').trim();}
function sizeWave(){const box=waveCanvas.getBoundingClientRect(),scale=window.devicePixelRatio||1;waveCanvas.width=Math.round(box.width*scale);waveCanvas.height=Math.round(box.height*scale);readWaveColours();drawWave(performance.now());}
function drawWave(now){
 const {width,height}=waveCanvas,mid=height/2;
 waveContext.clearRect(0,0,width,height);
 if(!width||!height)return;
 if(!waveFresh()){waveContext.fillStyle=wave.idle;waveContext.fillRect(0,Math.floor(mid),width,Math.max(1,Math.round(window.devicePixelRatio||1)));return;}
 // Newest point enters on the right; x is time, so the strip slides smoothly between arrivals.
 const pos=advancePlayout(wave.clock,wave.points.at(-1)[0],now),start=pos-waveSpan,step=width/waveSpan;
 const visible=wave.points.filter(([seq])=>seq>=start-1&&seq<=pos+1);
 if(visible.length<2)return;
 const x=seq=>(seq-start)*step,y=value=>mid-value*mid*.95;
 waveContext.beginPath();
 visible.forEach(([seq,,max],i)=>i?waveContext.lineTo(x(seq),y(max)):waveContext.moveTo(x(seq),y(max)));
 for(let i=visible.length-1;i>=0;i--)waveContext.lineTo(x(visible[i][0]),y(Math.min(visible[i][1],visible[i][2]-1/mid)));
 waveContext.closePath();
 const fade=waveContext.createLinearGradient(0,0,width*.2,0);fade.addColorStop(0,'transparent');fade.addColorStop(1,wave.colour);
 waveContext.fillStyle=fade;waveContext.fill();
}
function waveLoop(now){wave.frame=0;drawWave(now);if(waveFresh()&&document.visibilityState==='visible')wave.frame=requestAnimationFrame(waveLoop);}
// Reduced motion: redraw only when data arrives instead of animating every frame.
function renderWave(){if(!waveContext||wave.frame)return;if(reducedMotion()||document.visibilityState!=='visible')drawWave(performance.now());else wave.frame=requestAnimationFrame(waveLoop);}
if(waveContext){if(typeof ResizeObserver==='function')new ResizeObserver(sizeWave).observe(waveCanvas);sizeWave();}
function startBridge(){
 const events=new EventSource('/api/events');
 events.onmessage=event=>{try{const data=JSON.parse(event.data);if(!Array.isArray(data.decks)||data.decks.length!==4)return;live.snapshot=data;live.received=Date.now();live.connected=true;wave.points=mergeWave(wave.points,data.wave?.points||[]);updateLive();renderCue();renderWave();}catch{}};
 events.onerror=()=>{live.connected=false;updateLive();renderCue();renderWave();};
 setInterval(()=>{if(Date.now()-live.received>2500&&live.connected)live.connected=false;updateLive();renderCue();renderWave();},1000);
 $('refreshLive').addEventListener('click',async()=>{try{const response=await fetch('/api/refresh',{method:'POST'});if(!response.ok)throw Error();notify('State refresh requested. Check OSC sending in djay if no data arrives.');}catch{notify('The local bridge is unavailable. Restart Maestro’s server.');}});
}
const themeToggle=$('themeToggle');
function renderThemeControl(){const light=document.documentElement.dataset.theme==='light';themeToggle.setAttribute('aria-label',`Switch to ${light?'dark':'light'} mode`);themeToggle.setAttribute('title',`Switch to ${light?'dark':'light'} mode`);}
themeToggle.addEventListener('click',()=>{window.maestroTheme.set(document.documentElement.dataset.theme==='light'?'dark':'light');renderThemeControl();if(waveContext){readWaveColours();drawWave(performance.now());}});
renderThemeControl();updateLive();renderCue();startBridge();
