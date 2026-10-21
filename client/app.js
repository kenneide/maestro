import {parseTime,formatTime,writtenKey,beatPosition,chooseCrossfaderDeck} from './music.js';
const $=id=>document.getElementById(id);
const audio=$('audio'),canvas=$('waveform'),ctx=canvas.getContext('2d');
let saved={};try{saved=JSON.parse(localStorage.getItem('horizon-preferences')||'{}');}catch{}
const instruments=['alto','tenor','soprano','baritone','concert'];
const state={source:'demo',title:'After the Rain',duration:272,position:96,playing:false,key:0,mode:'minor',bpm:120,grid:0,build:96,drop:112,horizon:saved.horizon===20?20:30,instrument:instruments.includes(saved.instrument)?saved.instrument:'alto',peaks:null,peakRate:200};
const live={enabled:false,deck:saved.followedDeck===2?2:1,snapshot:null,received:0,connected:false,stale:true,values:{},prepared:null,attachment:null,rehearsal:null,identity:null,positionKnown:false};
let objectURL=null,loadGeneration=0,loading=false,wakeLock=null,lastFrame=performance.now(),lastPaint=0,toastTimer,resizeWidth=0,resizeHeight=0;
audio.volume=Number.isFinite(saved.volume)?Math.min(1,Math.max(0,saved.volume)):.7;
$('volume').value=audio.volume;$('instrument').value=state.instrument;
function persist(){try{localStorage.setItem('horizon-preferences',JSON.stringify({instrument:state.instrument,horizon:state.horizon,volume:audio.volume,followedDeck:live.deck}));}catch{}}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
async function keepAwake(){if('wakeLock' in navigator&&state.playing&&!wakeLock&&document.visibilityState==='visible'){try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>wakeLock=null);}catch{}}}
function pause(){state.playing=false;audio.pause();if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}renderTransport();}
async function togglePlay(){
 if(loading||live.enabled)return;
 if(state.playing){pause();return;}
 if(state.position>=state.duration-.05)seek(0);
 if(state.source==='file'){try{await audio.play();}catch{notify('Playback could not start. Try loading this file again or use another audio format.');return;}}
 state.playing=true;lastFrame=performance.now();keepAwake();renderTransport();
}
function seek(time){if(live.enabled)return;state.position=Math.max(0,Math.min(state.duration,time));if(state.source==='file'&&audio.readyState>=1)audio.currentTime=state.position;lastFrame=performance.now();renderTime();drawWave();}
function renderTransport(){
 document.body.classList.toggle('live-follow',live.enabled);
 canvas.setAttribute('aria-label',live.enabled?'Live djay waveform preview. Matching local audio is required.':'Future audio waveform. Use the track position slider below to seek.');
 $('play').innerHTML=state.playing?'Ⅱ <span>Pause</span>':state.source==='demo'?'▶ <span>Run demo</span>':'▶ <span>Play track</span>';
 $('play').disabled=loading;
 if(live.enabled){
  $('play').textContent=live.stale?'Waiting for djay':state.playing?'djay playing':'djay paused';
  $('play').disabled=true;
 }
 for(const id of ['restart','back','forward','seek'])$(id).disabled=live.enabled;
 $('playbackHint').textContent=live.enabled?'Transport controlled in djay':state.source==='demo'?'Silent preview':'Local file playback';
 $('mute').disabled=state.source!=='file';$('volume').disabled=state.source!=='file';
 $('mute').setAttribute('aria-pressed',String(audio.muted));$('mute').textContent=audio.muted?'Unmute':'Mute';
}
function renderStatic(){
 $('trackTitle').textContent=state.title;
 $('sourceBadge').lastChild.textContent=state.source==='demo'?' DEMO · NO DJAY LINK':' LOCAL AUDIO · NO DJAY LINK';
 $('trackSource').textContent=state.source==='demo'?'REHEARSAL / DEMO TRACK':'REHEARSAL / LOCAL AUDIO';
 $('trackSubtitle').textContent=state.source==='demo'?'A silent demo of your stage view':'Playing independently of djay · metadata entered manually';
 $('waveSource').textContent=state.source==='demo'?'Waveform · simulated audio':'Waveform · decoded from your audio file';
 $('markerSource').textContent=state.source==='demo'?'Build & drop · demo markers':'Build & drop · manual markers';
 $('writtenLabel').textContent=state.instrument==='concert'?'CONCERT KEY':'YOUR WRITTEN KEY';
 $('writtenKey').textContent=writtenKey(state.key,state.instrument,state.mode);
 $('writtenMode').textContent=state.key===null?'unknown':state.mode;
 $('concertLabel').textContent=state.key===null?'Set the concert key in setup':`Concert ${writtenKey(state.key,'concert',state.mode)} ${state.mode} · ${state.source==='demo'?'demo metadata':'manual'}`;
 $('bpmDisplay').textContent=state.bpm??'—';
 $('horizonLabel').textContent=state.horizon;
 $('horizonUnit').textContent=live.enabled?'track seconds':'seconds';
 if(live.enabled)renderLiveLabels();
 document.querySelectorAll('[data-window]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.window)===state.horizon)));
 $('seek').max=state.duration;$('duration').textContent=formatTime(state.duration);
 $('timeTicks').replaceChildren(...[0,1,2,3].map((n)=>{const el=document.createElement('span');el.textContent=n===0?'NOW':`+${Math.round(state.horizon*n/3)} s`;return el;}));
 renderTransport();renderTime();drawWave();
}
function renderTime(){
 $('seek').value=state.position;$('currentTime').textContent=formatTime(state.position);
 const grid=live.enabled?(live.positionKnown&&!live.stale&&Number.isInteger(live.values.bar)&&Number.isInteger(live.values.beat)?{bar:live.values.bar,beat:live.values.beat}:null):beatPosition(state.position,state.bpm,state.grid);
 $('barDisplay').textContent=grid?`${live.enabled?'djay':'Estimated'} bar ${grid.bar} · beat ${grid.beat}`:live.enabled?'Waiting for djay beat grid':'Beat grid not set';
 [...$('beatDots').children].forEach((dot,i)=>dot.classList.toggle('active',Boolean(grid)&&grid.beat===i+1));
 const remaining=state.drop===null||(live.enabled&&(live.stale||!live.positionKnown||live.values.loop!==0))?null:state.drop-state.position;
 $('cueEyebrow').textContent=state.source==='demo'?'COMING UP / DEMO MARKER':'COMING UP / MANUAL MARKER';
 $('cueTitle').textContent=remaining===null?'Add your drop marker':remaining<-.2?'Drop marker passed':remaining<=.2?'At the drop marker':remaining<=state.horizon?'Drop approaching':'Drop further ahead';
 $('cueDetail').textContent=remaining===null?'Open Set up to mark a known drop in this track.':remaining<-.2?'Rewind to rehearse, or set another drop in setup.':`Marked at ${formatTime(state.drop)}${state.build!==null?' · build starts at '+formatTime(state.build):''}`;
 $('secondsLeft').textContent=remaining===null||remaining<-.2?'—':Math.max(0,remaining).toFixed(1);
 const bars=remaining!==null&&remaining>=-.2&&state.bpm?Math.max(0,remaining)*state.bpm/240:null;
 $('barsLeft').textContent=bars===null?'—':Number(bars.toFixed(1));
 $('barsLabel').textContent=state.bpm?'estimated bars':'set BPM for bars';
 if(live.enabled){
  document.querySelector('.seconds-unit').textContent='track s';
  $('barsLeft').textContent='—';$('barsLabel').textContent='track-time distance';
  if(live.stale||!live.positionKnown){$('cueTitle').textContent='Waiting for live position';$('cueDetail').textContent='Countdown suspended until fresh djay data arrives.';}
  else if(live.values.loop!==0){$('cueTitle').textContent=live.values.loop===1?'Loop active':'Loop state unknown';$('cueDetail').textContent='Countdown suspended; future arrival at a marker is uncertain.';}
  else if(!live.attachment){$('cueTitle').textContent='Live deck connected';$('cueDetail').textContent='Attach matching audio and manual markers to enable the preview.';}
 }else document.querySelector('.seconds-unit').textContent='s';
 renderLane();
}
function renderLane(){
 const lane=$('sectionLane');lane.replaceChildren();
 if(live.enabled&&(!state.peaks||live.stale||!live.positionKnown)){const el=document.createElement('div');el.className='section-label unmarked';el.textContent='LIVE DATA / NO VERIFIED PREVIEW';lane.append(el);return;}
 const start=state.position,end=Math.min(state.duration,start+state.horizon);
 function band(a,b,text,kind){const from=Math.max(start,a),to=Math.min(end,b);if(to<=from)return;const el=document.createElement('div');el.className=`section-label ${kind}`;el.style.left=`${(from-start)/state.horizon*100}%`;el.style.width=`${(to-from)/state.horizon*100}%`;el.textContent=(to-from)/state.horizon>.12?text:'';lane.append(el);}
 if(state.build!==null&&state.drop!==null)band(state.build,state.drop,'BUILD · MANUAL','build');
 if(state.drop!==null)band(state.drop,state.duration,'AFTER DROP MARKER','drop');
 if(!lane.children.length){const el=document.createElement('div');el.className='section-label unmarked';el.textContent=state.position>=state.duration?'END OF TRACK':'NO SECTION MARKER IN VIEW';lane.append(el);}
}
function demoPeak(t){
 const cycles=t%64;
 let envelope=cycles<32?.26:cycles<46?.17+.032*(cycles-32):cycles<48?.04:.78;
 return envelope*(.28+.72*Math.abs(Math.sin(t*11.9)*Math.cos(t*3.7)));
}
function drawWave(){
 const w=resizeWidth||canvas.clientWidth,h=resizeHeight||canvas.clientHeight;
 if(!w||!h)return;
 ctx.clearRect(0,0,w,h);const wrap=canvas.parentElement;
 if(live.enabled&&(!state.peaks||live.stale||!live.positionKnown||live.values.loop!==0)){wrap.dataset.empty=live.stale?'Waiting for fresh djay data':!live.positionKnown?'Waiting for deck position':!state.peaks?'Live metadata connected · load and confirm matching audio for a waveform':live.values.loop===1?'Loop active · forward preview suspended':'Waiting for loop state';return;}
 delete wrap.dataset.empty;const mid=h/2,left=2,usable=w-4;
 ctx.lineWidth=1;ctx.strokeStyle='#2c3b3c';
 for(let sec=0;sec<=state.horizon;sec+=5){const x=left+sec/state.horizon*usable;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
 ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(w,mid);ctx.stroke();
 if(state.position+state.horizon>state.duration){const endX=Math.max(0,(state.duration-state.position)/state.horizon*usable);ctx.fillStyle='#0b1113a0';ctx.fillRect(endX,0,w-endX,h);}
 const step=3;
 for(let x=left;x<w-2;x+=step){
  const t=state.position+(x-left)/usable*state.horizon;if(t>=state.duration)break;
  let peak=0;
  if(state.source==='demo')peak=demoPeak(t);
  else if(state.peaks){const from=Math.floor(t*state.peakRate),to=Math.min(state.peaks.length,Math.ceil((t+step/usable*state.horizon)*state.peakRate));for(let p=from;p<to;p++)peak=Math.max(peak,state.peaks[p]);}
  const amplitude=Math.max(.6,Math.min(1,peak)*h*.43);
  ctx.fillStyle=state.drop!==null&&t>=state.drop?'#ffd08c':'#a3ecd0';ctx.fillRect(x,mid-amplitude,1.8,2*amplitude);
 }
 if(state.drop!==null){const x=left+(state.drop-state.position)/state.horizon*usable;if(x>=left&&x<=w){ctx.save();ctx.strokeStyle='#ffd08c';ctx.lineWidth=1.5;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();ctx.restore();}}
 ctx.strokeStyle='#edf4ee';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,0);ctx.lineTo(left,h);ctx.stroke();
}
new ResizeObserver(()=>{resizeWidth=canvas.clientWidth;resizeHeight=canvas.clientHeight;const ratio=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(resizeWidth*ratio);canvas.height=Math.round(resizeHeight*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);drawWave();}).observe(canvas);
function frame(now){
 const delta=(now-lastFrame)/1000;lastFrame=now;
 if(state.playing&&!live.enabled){state.position=state.source==='demo'?Math.min(state.duration,state.position+delta):audio.currentTime;if(state.position>=state.duration)pause();}
 if(state.playing&&!live.enabled&&now-lastPaint>=33){renderTime();drawWave();lastPaint=now;}
 requestAnimationFrame(frame);
}
function populateForm(){
 for(const id of ['titleInput','keyInput','modeInput','bpmInput','gridInput','buildInput','dropInput','markDrop'])$(id).disabled=live.enabled;
 $('liveSetupNote').textContent=live.enabled?'Live metadata is read-only. Loading audio switches to Rehearsal: prepare your markers there, then return to Follow djay and confirm that file matches the selected deck.':'';
 $('titleInput').value=state.title;$('keyInput').value=state.key===null?'unknown':String(state.key);$('modeInput').value=state.mode;$('bpmInput').value=state.bpm??'';$('gridInput').value=formatTime(state.grid,true);$('buildInput').value=state.build===null?'':formatTime(state.build,true);$('dropInput').value=state.drop===null?'':formatTime(state.drop,true);$('formError').textContent='';
}
function openSettings(){populateForm();$('settings').showModal();}
async function loadFile(file){
 if(!file)return;
 if(live.enabled)leaveLive();
 if(file.size>150*1024*1024){$('fileStatus').textContent='Please choose a track smaller than 150 MB.';return;}
 const generation=++loadGeneration;pause();loading=true;renderTransport();$('fileStatus').textContent='Decoding audio and building your waveform…';
 let context;
 try{
  context=new AudioContext();const buffer=await context.decodeAudioData(await file.arrayBuffer());
  if(generation!==loadGeneration)return;
  if(!Number.isFinite(buffer.duration)||buffer.duration<=0||buffer.duration>1800)throw new Error('Please use one track between 0 and 30 minutes long.');
  const count=Math.ceil(buffer.duration*state.peakRate),peaks=new Float32Array(count),channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  for(let i=0;i<count;i++){
   const from=Math.floor(i*buffer.sampleRate/state.peakRate),to=Math.min(buffer.length,Math.floor((i+1)*buffer.sampleRate/state.peakRate));let peak=0;
   for(const channel of channels)for(let s=from;s<to;s++)peak=Math.max(peak,Math.abs(channel[s]));peaks[i]=peak;
   if(i%10000===0){await new Promise(resolve=>setTimeout(resolve,0));if(generation!==loadGeneration)return;}
  }
  if(generation!==loadGeneration)return;
  if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);audio.src=objectURL;audio.load();
  Object.assign(state,{source:'file',title:file.name.replace(/\.[^.]+$/,''),duration:buffer.duration,position:0,key:null,bpm:null,grid:0,build:null,drop:null,peaks});
  $('fileStatus').textContent=`${file.name} · ${formatTime(buffer.duration)} · waveform ready. Add key, BPM and markers below.`;
  populateForm();renderStatic();
 }catch(error){if(generation===loadGeneration)$('fileStatus').textContent=error.message.startsWith('Please use')?error.message:'This file could not be decoded. Try MP3, WAV, or another browser-supported audio file. Your previous track is still selected.';}
 finally{if(context)context.close().catch(()=>{});if(generation===loadGeneration){loading=false;renderTransport();}}
}
function loadDemo(){
 if(live.enabled)leaveLive();
 ++loadGeneration;loading=false;pause();audio.removeAttribute('src');audio.load();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;
 Object.assign(state,{source:'demo',title:'After the Rain',duration:272,position:96,key:0,mode:'minor',bpm:120,grid:0,build:96,drop:112,peaks:null});
 $('audioFile').value='';$('fileStatus').textContent='Demo ready. Try the drop at 1:52.';populateForm();renderStatic();
}
$('setupForm').addEventListener('submit',e=>{
 e.preventDefault();if(live.enabled){$('settings').close();return;}if(loading){$('formError').textContent='Wait for the audio to finish loading.';return;}
 const grid=parseTime($('gridInput').value)??0,build=parseTime($('buildInput').value),drop=parseTime($('dropInput').value),bpm=$('bpmInput').value.trim()===''?null:Number($('bpmInput').value);
 if([grid,build,drop].some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>state.duration))){$('formError').textContent='Use valid seconds or m:ss positions within the track.';return;}
 if(bpm!==null&&(!Number.isFinite(bpm)||bpm<30||bpm>300)){$('formError').textContent='Enter a BPM between 30 and 300, or leave it unknown.';return;}
 if(build!==null&&(drop===null||build>=drop)){$('formError').textContent='A build needs a later drop marker. Clear the build field to mark only a drop.';return;}
 Object.assign(state,{title:$('titleInput').value.trim()||'Untitled track',key:$('keyInput').value==='unknown'?null:Number($('keyInput').value),mode:$('modeInput').value,bpm,grid,build,drop});
 $('settings').close();renderStatic();notify('Stage updated. Track details and markers are manual.');
});
$('audioFile').addEventListener('change',e=>loadFile(e.target.files[0]));$('loadDemo').addEventListener('click',loadDemo);$('settingsButton').addEventListener('click',openSettings);$('closeSettings').addEventListener('click',()=>$('settings').close());
$('markDrop').addEventListener('click',()=>{$('dropInput').value=formatTime(state.position,true);});
$('play').addEventListener('click',togglePlay);$('restart').addEventListener('click',()=>seek(0));$('back').addEventListener('click',()=>seek(state.position-5));$('forward').addEventListener('click',()=>seek(state.position+5));$('seek').addEventListener('input',e=>seek(Number(e.target.value)));
$('instrument').addEventListener('change',e=>{state.instrument=e.target.value;persist();renderStatic();});
document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>{state.horizon=Number(b.dataset.window);persist();renderStatic();}));
$('volume').addEventListener('input',e=>{audio.volume=Number(e.target.value);persist();});$('mute').addEventListener('click',()=>{audio.muted=!audio.muted;renderTransport();});
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notify('Use your browser’s View menu to enter full screen.');}catch{notify('Use your browser’s View menu to enter full screen.');}}
$('fullscreen').addEventListener('click',fullscreen);document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||$('settings').open||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();togglePlay();}else if(e.code==='ArrowLeft'){e.preventDefault();seek(state.position-5);}else if(e.code==='ArrowRight'){e.preventDefault();seek(state.position+5);}else if(e.key.toLowerCase()==='f')fullscreen();});
audio.addEventListener('ended',()=>{state.position=state.duration;pause();renderTime();drawWave();});audio.addEventListener('error',()=>{if(state.source==='file'&&audio.getAttribute('src')){pause();notify('Audio playback failed. Load another supported audio file.');}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(state.source==='file'&&!live.enabled)state.position=audio.currentTime;keepAwake();renderTime();drawWave();}});
startBridge();enterLive();renderStatic();requestAnimationFrame(frame);

function enterLive(){
 if(live.enabled)return;
 if(loading){notify('Wait for audio decoding to finish before following djay.');$('followMode').value='rehearsal';return;}
 pause();live.rehearsal={...state,playing:false};
 live.prepared=state.source==='file'?{...state}:null;
 live.enabled=true;live.attachment=null;live.identity=null;$('followMode').value='live';
 Object.assign(state,{source:'djay',title:'Waiting for djay',duration:0,position:0,key:null,bpm:null,build:null,drop:null,peaks:null,playing:false});
 updateLive();
}
function leaveLive(){
 if(!live.enabled)return;
 pause();live.enabled=false;live.attachment=null;
 if(live.rehearsal)Object.assign(state,live.rehearsal,{playing:false});
 $('followMode').value='rehearsal';document.body.classList.remove('live-stale');
 $('connectionText').textContent='Standalone rehearsal · not synchronized with djay';
 renderStatic();updateBridgeControls();
}
function liveIdentity(deck){return `${live.snapshot.session}:${deck.id}:${deck.generation}:${deck.values.title??''}:${deck.values.duration??''}`;}
function updateBridgeControls(){
 const snapshot=live.snapshot;
 const status=!live.connected?'Bridge disconnected':snapshot?.error?`OSC error: ${snapshot.error}`:snapshot?.status==='receiving'?'OSC receiving':snapshot?.status==='stale'?'OSC stream stale':'Waiting for OSC · 127.0.0.1:9000';
 const label=live.enabled&&snapshot?.status==='receiving'?(live.stale?`Deck ${live.deck} · waiting for fresh position`:`Deck ${live.deck} · ${state.playing?'playing':'paused'}${live.values.loop===1?' · loop':''}${Number.isFinite(live.crossfader)?live.crossfader>0.001&&live.crossfader<0.999?' · holding through blend':' · crossfader endpoint':' · crossfader unavailable'}`):status;
 if($('liveStatus').textContent!==label)$('liveStatus').textContent=label;
 $('liveStatus').dataset.fresh=String(live.connected&&snapshot?.status==='receiving'&&(!live.enabled||!live.stale));
 $('attachAudio').disabled=!live.enabled||!live.prepared||live.stale||live.values.loaded!==1||!live.values.title;
 $('attachAudio').textContent=live.attachment?'Detach matched audio':'Confirm matching audio';
 if(live.attachment)$('attachAudio').disabled=false;
 if(snapshot){
  $('receivePort').textContent=snapshot.receivePort;$('requestPort').textContent=snapshot.requestPort;
  $('bridgeDiagnostic').textContent=`Receiver ${snapshot.ready?'listening':'not ready'} · ${snapshot.packets} djay packets · ${snapshot.recognized} mapped values · ${snapshot.malformed} malformed packets. ${snapshot.error||''}`;
  $('keyDiagnostic').textContent=snapshot.addresses.some(a=>a.endsWith('/playback/key'))?'A playback/key address has been received. Verify its response to pitch shifts in djay before treating it as the sounding key.':'Only reported song keys are available so far. The PDF repeats song/key in its playback section; pitch-shift behavior remains unverified.';
 }
 if(live.prepared)$('audioMatchHelp').textContent=live.attachment?`Manually matched “${live.prepared.title}” to Deck ${live.deck}. Preview uses track seconds, not tempo-adjusted wall-clock seconds. Automatic track changes detach it.`:`Prepared audio: “${live.prepared.title}” (${formatTime(live.prepared.duration)}). Confirm only if this is the exact same edit of the selected djay track. Duration is checked; identity requires your confirmation.`;
}
function updateLive(){
 if(!live.enabled){updateBridgeControls();return;}
 const snapshot=live.snapshot;
 if(snapshot&&live.connected&&snapshot.status==='receiving'){live.crossfader=snapshot.mixer?.crossfader;const nextDeck=chooseCrossfaderDeck(live.crossfader,live.deck);if(nextDeck!==live.deck){live.deck=nextDeck;live.attachment=null;live.identity=null;persist();}}
 const deck=snapshot?.decks[live.deck-1],values=deck?.values||{};
 live.values=values;
 live.positionKnown=values.loaded===1&&Number.isFinite(values.time);
 live.stale=!live.connected||!snapshot||snapshot.status!=='receiving'||Date.now()-live.received>2500||!live.positionKnown||snapshot.now-(deck?.updated.time||0)>2500;
 if(deck){
  const identity=liveIdentity(deck);
  if(live.identity!==identity){if(live.attachment)notify('Track identity changed. Matching audio and markers were detached.');live.attachment=null;live.identity=identity;}
 }
 const active=values.loaded!==0;
 const encoded=active?(Number.isInteger(values.playbackKey)?values.playbackKey:values.songKey):null;
 const validKey=Number.isInteger(encoded)&&encoded>=0&&encoded<24;
 const minor=validKey&&encoded%2===1;
 Object.assign(state,{source:'djay',title:values.loaded===0?`Deck ${live.deck} · empty`:values.title||`Deck ${live.deck} · waiting for track`,duration:active&&Number.isFinite(values.duration)?values.duration:0,key:validKey?(Math.floor(encoded/2)+(minor?9:0))%12:null,mode:minor?'minor':'major',bpm:active&&values.bpm>0?Number(values.bpm.toFixed(1)):null,playing:!live.stale&&values.playing===1,peaks:live.attachment?live.prepared.peaks:null,build:live.attachment?live.prepared.build:null,drop:live.attachment?live.prepared.drop:null});
 if(live.positionKnown)state.position=Math.max(0,values.time);else state.position=0;
 document.body.classList.toggle('live-stale',live.stale);
 updateBridgeControls();renderStatic();
}
function renderLiveLabels(){
 $('sourceBadge').lastChild.textContent=live.stale?' DJAY · WAITING / STALE':' DJAY · OSC';
 $('trackSource').textContent=`LIVE DJAY / DECK ${live.deck} · CROSSFADER FOLLOW`;
 $('trackSubtitle').textContent=live.stale?'Live position unavailable · preview suspended':`${live.values.artist||'Live metadata'}${Number.isFinite(live.crossfader)?live.crossfader>0.001&&live.crossfader<0.999?' · Holding this song until the crossfader reaches the other end':' · Crossfader at '+(live.crossfader<=0.001?'left':'right')+' end':' · Waiting for crossfader; retaining this song'}${live.values.loop===1?' · LOOP ACTIVE':''}`;
 $('waveSource').textContent=live.attachment?'Waveform · manually matched local audio':'Waveform unavailable · OSC contains no audio samples';
 $('markerSource').textContent=live.attachment?'Sections · your manual markers':'No matched section markers';
 $('concertLabel').textContent=state.key===null?'Key not received':`Concert ${writtenKey(state.key,'concert',state.mode)} ${state.mode} · reported ${Number.isInteger(live.values.playbackKey)?'playback':'song'} key`;
 $('connectionText').textContent=live.stale?'Live mode · waiting for fresh djay position':`Following Deck ${live.deck} · no browser audio · preview measured in track seconds`;
 $('playbackHint').textContent='Transport controlled in djay';
}
function startBridge(){
 const events=new EventSource('/api/events');
 events.onmessage=event=>{try{const data=JSON.parse(event.data);if(!Array.isArray(data.decks)||data.decks.length!==4)return;live.snapshot=data;live.received=Date.now();live.connected=true;updateLive();}catch{}};
 events.onerror=()=>{live.connected=false;updateLive();};
 setInterval(()=>{if(Date.now()-live.received>2500&&live.connected){live.connected=false;updateLive();}},1000);
 $('followMode').addEventListener('change',e=>e.target.value==='live'?enterLive():leaveLive());
 $('refreshLive').addEventListener('click',async()=>{try{const response=await fetch('/api/refresh',{method:'POST'});if(!response.ok)throw Error();notify('State refresh requested. Check OSC sending in djay if no data arrives.');}catch{notify('The local bridge is unavailable. Restart Horizon’s server.');}});
 $('attachAudio').addEventListener('click',()=>{
  if(live.attachment){live.attachment=null;updateLive();return;}
  if(!live.enabled||!live.prepared||live.stale)return;
  if(!(live.values.duration>0)||Math.abs(live.values.duration-live.prepared.duration)>2){notify('Track durations differ, or djay duration is missing. Load the exact same audio edit before matching.');return;}
  live.attachment=live.identity;updateLive();notify('Audio matched by your confirmation. Browser playback stays silent.');
 });
}
