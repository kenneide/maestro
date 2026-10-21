export function parseTime(text){
 const value=String(text).trim();
 if(!value)return null;
 if(/^\d+(\.\d+)?$/.test(value))return Number(value);
 const match=value.match(/^(\d+):([0-5]\d(?:\.\d+)?)$/);
 return match?Number(match[1])*60+Number(match[2]):NaN;
}
export function formatTime(seconds,precise=false){
 const value=Math.max(0,Number(seconds)||0);
 const rounded=precise?Math.round(value*10)/10:Math.floor(value);
 const minutes=Math.floor(rounded/60),rest=rounded-minutes*60;
 return `${minutes}:${precise?rest.toFixed(1).padStart(4,'0'):String(rest).padStart(2,'0')}`;
}
export function writtenKey(key,instrument,mode='minor'){
 if(key===null)return '—';
 const offset={C:0,Bb:2,Eb:9,F:7}[instrument]??0;
 const names=mode==='minor'?['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B']:['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 return names[(Number(key)+offset)%12];
}
export function deckMusic(values){
 const active=values.loaded!==0;
 const encoded=active?(Number.isInteger(values.playbackKey)?values.playbackKey:values.songKey):null;
 const validKey=Number.isInteger(encoded)&&encoded>=0&&encoded<24;
 const minor=validKey&&encoded%2===1;
 return {key:validKey?(Math.floor(encoded/2)+(minor?9:0))%12:null,mode:minor?'minor':'major',bpm:active&&Number.isFinite(values.bpm)&&values.bpm>0?Number(values.bpm.toFixed(1)):null};
}
export function beatPosition(time,bpm,grid=0){
 if(!bpm||time<grid)return null;
 const beats=(time-grid)*bpm/60;
 return {bar:Math.floor(beats/4)+1,beat:Math.floor(beats%4)+1};
}

// Latch to an endpoint; retain the previous deck throughout the blend.
// Assumes the normal two-deck routing: Deck 1 left, Deck 2 right.
export function chooseCrossfaderDeck(position,currentId){
 if(!Number.isFinite(position)||position<0||position>1)return currentId;
 if(position<=0.001)return 1;
 if(position>=0.999)return 2;
 return currentId;
}
