import {formatTime,writtenKey,chooseCrossfaderDeck} from './music.js';
import {loadPreferences} from './preferences.js';
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
 $('trackTitle').textContent=state.title;
 $('trackSource').textContent=`DJAY / DECK ${live.deck}`;
 $('trackSubtitle').textContent=live.values.artist||'';
 $('writtenLabel').textContent=state.instrument==='C'?'CONCERT KEY':'YOUR WRITTEN KEY';
 $('writtenKey').textContent=writtenKey(state.key,state.instrument,state.mode);
 $('writtenMode').textContent=state.key===null?'':state.mode;
 $('concertLabel').textContent=state.key===null?'Key not received':`Concert ${writtenKey(state.key,'C',state.mode)} ${state.mode}`;
 $('bpmDisplay').textContent=state.bpm??'—';
 const grid=!live.stale&&Number.isInteger(live.values.bar)&&Number.isInteger(live.values.beat)?{bar:live.values.bar,beat:live.values.beat}:null;
 $('barDisplay').textContent=grid?`Bar ${grid.bar} · beat ${grid.beat}`:'Waiting for beat grid';
 [...$('beatDots').children].forEach((dot,i)=>dot.classList.toggle('active',Boolean(grid)&&grid.beat===i+1));
 $('currentTime').textContent=state.position===null?'—':formatTime(state.position);
 $('duration').textContent=state.duration===null?'—':formatTime(state.duration);
 $('timeStatus').textContent=live.stale?'Position unavailable':state.playing?'Playing':'Paused';
 $('connectionText').textContent=live.stale?'Waiting for djay':`Connected · Deck ${live.deck}`;
 $('connectionText').parentElement.dataset.fresh=String(!live.stale);
 keepAwake();
}
$('settingsButton').addEventListener('click',()=>$('settings').showModal());
$('closeSettings').addEventListener('click',()=>$('settings').close());
$('instrument').addEventListener('change',e=>{state.instrument=e.target.value;persist();renderStatic();});
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notify('Use your browser’s View menu to enter full screen.');}catch{notify('Use your browser’s View menu to enter full screen.');}}
if(navigator.standalone||matchMedia('(display-mode: standalone)').matches)$('fullscreen').hidden=true;$('fullscreen').addEventListener('click',fullscreen);document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||$('settings').open||['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='f')fullscreen();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){updateLive();renderCue();}else keepAwake();});
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
 const encoded=active?(Number.isInteger(values.playbackKey)?values.playbackKey:values.songKey):null;
 const validKey=Number.isInteger(encoded)&&encoded>=0&&encoded<24;
 const minor=validKey&&encoded%2===1;
 Object.assign(state,{title:values.loaded===0?`Deck ${live.deck} · empty`:values.title||'Waiting for djay',duration:active&&Number.isFinite(values.duration)&&values.duration>0?values.duration:null,key:validKey?(Math.floor(encoded/2)+(minor?9:0))%12:null,mode:minor?'minor':'major',bpm:active&&values.bpm>0?Number(values.bpm.toFixed(1)):null,playing:!live.stale&&values.playing===1,position:!live.stale?Math.max(0,values.time):null});
 updateBridgeControls();renderStatic();
}
function renderCue(){
 const cue=live.snapshot?.cue,fresh=live.connected&&cue&&live.snapshot.now-cue.updated<=3000,value=fresh?cue.state:'unknown';
 // A server started before cue support omits the field entirely; it must be restarted to receive cues.
 const outdated=live.connected&&live.snapshot&&!('cue' in live.snapshot);
 const detail=value==='green'?'The DJ is cueing you in':value==='red'?'Hold until the DJ cues you':outdated?'Maestro’s server is out of date. Restart it to receive cues.':'Waiting for the Maestro Cue plugin in djay';
 $('performerCue').dataset.cue=value;
 $('cueLight').textContent=value==='green'?'GREEN · PLAY':value==='red'?'RED · HOLD':'NO CUE SIGNAL';
 if($('cueLightDetail').textContent!==detail)$('cueLightDetail').textContent=detail;
}
function startBridge(){
 const events=new EventSource('/api/events');
 events.onmessage=event=>{try{const data=JSON.parse(event.data);if(!Array.isArray(data.decks)||data.decks.length!==4)return;live.snapshot=data;live.received=Date.now();live.connected=true;updateLive();renderCue();}catch{}};
 events.onerror=()=>{live.connected=false;updateLive();renderCue();};
 setInterval(()=>{if(Date.now()-live.received>2500&&live.connected)live.connected=false;updateLive();renderCue();},1000);
 $('refreshLive').addEventListener('click',async()=>{try{const response=await fetch('/api/refresh',{method:'POST'});if(!response.ok)throw Error();notify('State refresh requested. Check OSC sending in djay if no data arrives.');}catch{notify('The local bridge is unavailable. Restart Maestro’s server.');}});
}
const themeToggle=$('themeToggle');
function renderThemeControl(){const light=document.documentElement.dataset.theme==='light';themeToggle.textContent=light?'Dark mode':'Light mode';themeToggle.setAttribute('aria-label',`Switch to ${light?'dark':'light'} mode`);}
themeToggle.addEventListener('click',()=>{window.maestroTheme.set(document.documentElement.dataset.theme==='light'?'dark':'light');renderThemeControl();});
renderThemeControl();updateLive();renderCue();startBridge();
