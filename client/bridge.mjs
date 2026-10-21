import dgram from 'node:dgram';
import {randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {decodePacket,encodeMessage,newDeck,applyMessage} from './osc.mjs';
export function createBridge({receivePort=9000,requestPort=9001,receiveHost='127.0.0.1',requestHost='127.0.0.1',pageUrls=()=>[]}={}){
 const socket=dgram.createSocket('udp4'),clients=new Set();
 let decks=Array.from({length:4},(_,i)=>newDeck(i+1)),lastPacket=0,packets=0,recognized=0,malformed=0,lastRequest=0,ready=false,error=null,session=randomUUID();
 const addresses=new Set();
 const recentMessages=[];
 let incomingPackets=0,lastIncoming=0,lastSender=null,lastRecognized=0;
 const clipped=value=>typeof value==='string'&&value.length>512?value.slice(0,512)+'…':value;
 function record(entry){recentMessages.push(entry);if(recentMessages.length>100)recentMessages.shift();}
 let mixer={crossfader:null},cue=null;
 // Waveform from the Maestro plugin: one [seq,min,max] point per 25 ms window, last 8 s kept.
 const wavePointsPerSecond=40,waveLimit=8*wavePointsPerSecond;let wave={updated:0,points:[]},waveMessages=0;
 function addWave([seq,min,max]){const last=wave.points.at(-1)?.[0];
  // Plugin restart or long gap: start a fresh strip.
  if(last!==undefined&&(seq<=last||seq-last>waveLimit))wave.points=[];
  wave.points.push([seq,Math.max(-1,Math.min(1,min)),Math.max(-1,Math.min(1,max))]);if(wave.points.length>waveLimit)wave.points.shift();}
 function snapshot({waveSeconds=2}={}){const now=Date.now();const destinations=receiveHost==='0.0.0.0'?[...new Set(['127.0.0.1',...Object.values(networkInterfaces()).flat().filter(info=>info.family==='IPv4'&&!info.internal).map(info=>info.address)])]:[receiveHost];return {session,now,ready,error,receiveHost,receivePort,requestHost,requestPort,requestsEnabled:Boolean(requestHost),destinations,incomingPackets,lastIncoming,lastSender,lastRecognized,recentMessages:[...recentMessages],lastPacket,packets,recognized,malformed,status:!ready?'error':!lastPacket?'waiting':now-lastPacket>2500?'stale':'receiving',addresses:[...addresses],mixer,cue,wave:{updated:wave.updated,points:wave.points.slice(-waveSeconds*wavePointsPerSecond)},waveMessages,pageUrls:pageUrls(),decks};}
 function dump(){const now=Date.now();if(!requestHost||!ready||now-lastRequest<1100)return false;lastRequest=now;socket.send(encodeMessage('/djay/request/dumpAll'),requestPort,requestHost,e=>{if(e)error=e.message;});return true;}
 socket.on('message',(packet,remote)=>{
  const receivedAt=Date.now(),sender={address:remote.address,port:remote.port};
  incomingPackets++;lastIncoming=receivedAt;lastSender=sender;
  let messages;try{messages=decodePacket(packet);}catch(e){malformed++;record({timestamp:receivedAt,sender,error:e.message,hex:packet.subarray(0,64).toString('hex')});return;}
  // Waveform points arrive 40 times a second; logging them would evict djay messages.
  for(const message of messages)if(message.address!=='/maestro/wave')record({timestamp:receivedAt,sender,address:clipped(message.address),args:message.args.slice(0,16).map(value=>typeof value==='string'&&value.length>64?value.slice(0,64)+'…':value),omittedArgs:Math.max(0,message.args.length-16)});
  // Cue: "red" (Stop), "green" (Play), or "amber" plus the state it is heading to (Ready).
  for(const message of messages)if(message.address==='/maestro/cue'){const [state,next]=message.args;
   if(message.args.length===1&&['red','green'].includes(state))cue={state,updated:receivedAt};
   else if(message.args.length===2&&state==='amber'&&['red','green'].includes(next))cue={state,next,updated:receivedAt};}
  for(const message of messages)if(message.address==='/maestro/wave'){waveMessages++;const [seq,min,max]=message.args;
   if(message.args.length===3&&Number.isInteger(seq)&&Number.isFinite(min)&&Number.isFinite(max)){addWave(message.args);wave.updated=receivedAt;}}
  const valid=messages.filter(m=>m.address.startsWith('/djay/'));if(!valid.length)return;
  const now=Date.now();if(lastPacket&&now-lastPacket>5000){decks=Array.from({length:4},(_,i)=>newDeck(i+1));session=randomUUID();mixer={crossfader:null};dump();}
  lastPacket=now;packets++;
  for(const message of valid){const before=recognized;if(message.address==='/djay/mixer/crossfader'&&message.args.length===1&&Number.isFinite(message.args[0])&&message.args[0]>=0&&message.args[0]<=1){mixer.crossfader=message.args[0];recognized++;}if(addresses.size<150)addresses.add(clipped(message.address));const generations=decks.map(d=>d.generation).join(',');if(applyMessage(decks,message,now))recognized++;if(recognized>before)lastRecognized=now;if(generations!==decks.map(d=>d.generation).join(','))dump();}
 });
 socket.on('error',e=>{error=e.message;ready=false;});
 socket.bind(receivePort,receiveHost,()=>{receivePort=socket.address().port;ready=true;dump();});
 const updates=setInterval(()=>{const frame='data: '+JSON.stringify(snapshot())+'\n\n';for(const client of clients){if(client.writableLength>256000){client.destroy();clients.delete(client);}else client.write(frame);}},100);
 const refresh=setInterval(dump,5000);
 return {snapshot,dump,subscribe(response){clients.add(response);response.write('data: '+JSON.stringify(snapshot({waveSeconds:8}))+'\n\n');response.on('close',()=>clients.delete(response));dump();},close(){clearInterval(updates);clearInterval(refresh);for(const client of clients)client.end();socket.close();}};
}
