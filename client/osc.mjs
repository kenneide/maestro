// OSC 1.0 messages and nested bundles. No playback-control commands are sent.
export function encodeMessage(address){
 const string=value=>{const bytes=Buffer.from(value+'\0');const out=Buffer.alloc(Math.ceil(bytes.length/4)*4);bytes.copy(out);return out;};
 return Buffer.concat([string(address),string(',')]);
}
export function decodePacket(packet,depth=0){
 if(depth>8||packet.length<4)throw Error('Invalid OSC packet');
 let offset=0;
 const need=n=>{if(offset+n>packet.length)throw Error('Truncated OSC packet');};
 const string=()=>{const end=packet.indexOf(0,offset);if(end<0)throw Error('Unterminated OSC string');const text=packet.toString('utf8',offset,end);offset=Math.ceil((end+1)/4)*4;if(offset>packet.length)throw Error('Invalid string padding');return text;};
 const address=string();
 if(address==='#bundle'){
  need(8);offset+=8;const messages=[];
  while(offset<packet.length){need(4);const size=packet.readInt32BE(offset);offset+=4;if(size<4||size%4)throw Error('Invalid bundle size');need(size);messages.push(...decodePacket(packet.subarray(offset,offset+size),depth+1));offset+=size;if(messages.length>2048)throw Error('Bundle too large');}
  return messages;
 }
 if(!address.startsWith('/'))throw Error('Invalid address');
 const tags=string();if(!tags.startsWith(','))throw Error('Missing type tags');const args=[];
 for(const type of tags.slice(1)){
  if(type==='i'){need(4);args.push(packet.readInt32BE(offset));offset+=4;}
  else if(type==='f'){need(4);args.push(packet.readFloatBE(offset));offset+=4;}
  else if(type==='d'){need(8);args.push(packet.readDoubleBE(offset));offset+=8;}
  else if(type==='h'){need(8);const n=Number(packet.readBigInt64BE(offset));if(!Number.isSafeInteger(n))throw Error('Unsafe integer');args.push(n);offset+=8;}
  else if(type==='s'||type==='S')args.push(string());
  else if(type==='T'||type==='F')args.push(type==='T'?1:0);
  else if(type==='N'||type==='I')args.push(null);
  else if(type==='b'){need(4);const length=packet.readInt32BE(offset);offset+=4;if(length<0)throw Error('Invalid blob');need(length);args.push(null);offset+=Math.ceil(length/4)*4;need(0);}
  else throw Error('Unsupported OSC type '+type);
 }
 if(offset!==packet.length)throw Error('Unexpected trailing data');
 return [{address,args}];
}

const fields={
 'song/loaded':['loaded',0,1], 'song/title':['title','string'], 'song/artist':['artist','string'],
 'song/duration':['duration',0,86400], 'song/key':['songKey',0,23], 'song/bpm':['baseBpm',0,1000],
 'playback/key':['playbackKey',0,23], 'playback/playing':['playing',0,1], 'playback/bpm':['bpm',0,1000],
 'playback/time':['time',-86400,86400], 'playback/bar':['bar',-100000,100000], 'playback/beat':['beat',1,4],
 'playback/phase':['phase',0,1], 'playback/barPhase':['barPhase',0,4],
 'loop/active':['loop',0,1], 'loop/inTime':['loopIn',-86400,86400], 'loop/outTime':['loopOut',-86400,86400],
};
export function newDeck(id,generation=0){return {id,generation,values:{},updated:{}};}
export function applyMessage(decks,message,now){
 const match=message.address.match(/^\/djay\/turntable([1-4])\/(.+)$/);if(!match)return false;
 const spec=fields[match[2]];if(!spec||message.args.length!==1)return false;
 let value=message.args[0];const name=spec[0];
 if(['songKey','playbackKey'].includes(name)&&typeof value==='number'&&Number.isInteger(value)&&(value<0||value>23))value=null;
 if(spec[1]==='string'){if(typeof value!=='string'||value.length>4096)return false;}
 else if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<spec[1]||value>spec[2]))return false;
 if(value===null&&!['songKey','playbackKey'].includes(name))return false;
 if(value!==null&&['loaded','playing','loop','songKey','playbackKey','bar','beat'].includes(name)&&!Number.isInteger(value))return false;
 const index=Number(match[1])-1;let deck=decks[index];
 const replaced=name==='title'&&deck.values.title!==undefined&&deck.values.title!==value;
 const unloaded=name==='loaded'&&value===0&&deck.values.loaded!==0;
 if(replaced||unloaded){deck=newDeck(index+1,deck.generation+1);decks[index]=deck;}
 deck.values[name]=value;deck.updated[name]=now;return true;
}
