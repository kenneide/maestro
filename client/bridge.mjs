import dgram from 'node:dgram';
import {randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {decodePacket,encodeMessage,newDeck,applyMessage} from './osc.mjs';
export function createBridge({receivePort=9000,requestPort=9001,receiveHost='127.0.0.1',requestHost='127.0.0.1'}={}){
 const socket=dgram.createSocket('udp4'),clients=new Set();
 let decks=Array.from({length:4},(_,i)=>newDeck(i+1)),lastPacket=0,packets=0,recognized=0,malformed=0,lastRequest=0,ready=false,error=null,session=randomUUID();
 const addresses=new Set();
 const recentMessages=[];
 let incomingPackets=0,lastIncoming=0,lastSender=null,lastRecognized=0;
 const clipped=value=>typeof value==='string'&&value.length>512?value.slice(0,512)+'…':value;
 function record(entry){recentMessages.push(entry);if(recentMessages.length>100)recentMessages.shift();}
 let mixer={crossfader:null},cue=null;
 function snapshot(){const now=Date.now();const destinations=receiveHost==='0.0.0.0'?[...new Set(['127.0.0.1',...Object.values(networkInterfaces()).flat().filter(info=>info.family==='IPv4'&&!info.internal).map(info=>info.address)])]:[receiveHost];return {session,now,ready,error,receiveHost,receivePort,requestHost,requestPort,requestsEnabled:Boolean(requestHost),destinations,incomingPackets,lastIncoming,lastSender,lastRecognized,recentMessages:[...recentMessages],lastPacket,packets,recognized,malformed,status:!ready?'error':!lastPacket?'waiting':now-lastPacket>2500?'stale':'receiving',addresses:[...addresses],mixer,cue,decks};}
 function dump(){const now=Date.now();if(!requestHost||!ready||now-lastRequest<1100)return false;lastRequest=now;socket.send(encodeMessage('/djay/request/dumpAll'),requestPort,requestHost,e=>{if(e)error=e.message;});return true;}
 socket.on('message',(packet,remote)=>{
  const receivedAt=Date.now(),sender={address:remote.address,port:remote.port};
  incomingPackets++;lastIncoming=receivedAt;lastSender=sender;
  let messages;try{messages=decodePacket(packet);}catch(e){malformed++;record({timestamp:receivedAt,sender,error:e.message,hex:packet.subarray(0,64).toString('hex')});return;}
  for(const message of messages)record({timestamp:receivedAt,sender,address:clipped(message.address),args:message.args.slice(0,16).map(value=>typeof value==='string'&&value.length>64?value.slice(0,64)+'…':value),omittedArgs:Math.max(0,message.args.length-16)});
  for(const message of messages)if(message.address==='/maestro/cue'&&message.args.length===1&&['red','green'].includes(message.args[0]))cue={state:message.args[0],updated:receivedAt};
  const valid=messages.filter(m=>m.address.startsWith('/djay/'));if(!valid.length)return;
  const now=Date.now();if(lastPacket&&now-lastPacket>5000){decks=Array.from({length:4},(_,i)=>newDeck(i+1));session=randomUUID();mixer={crossfader:null};dump();}
  lastPacket=now;packets++;
  for(const message of valid){const before=recognized;if(message.address==='/djay/mixer/crossfader'&&message.args.length===1&&Number.isFinite(message.args[0])&&message.args[0]>=0&&message.args[0]<=1){mixer.crossfader=message.args[0];recognized++;}if(addresses.size<150)addresses.add(clipped(message.address));const generations=decks.map(d=>d.generation).join(',');if(applyMessage(decks,message,now))recognized++;if(recognized>before)lastRecognized=now;if(generations!==decks.map(d=>d.generation).join(','))dump();}
 });
 socket.on('error',e=>{error=e.message;ready=false;});
 socket.bind(receivePort,receiveHost,()=>{receivePort=socket.address().port;ready=true;dump();});
 const updates=setInterval(()=>{const frame='data: '+JSON.stringify(snapshot())+'\n\n';for(const client of clients){if(client.writableLength>256000){client.destroy();clients.delete(client);}else client.write(frame);}},100);
 const refresh=setInterval(dump,5000);
 return {snapshot,dump,subscribe(response){clients.add(response);response.write('data: '+JSON.stringify(snapshot())+'\n\n');response.on('close',()=>clients.delete(response));dump();},close(){clearInterval(updates);clearInterval(refresh);for(const client of clients)client.end();socket.close();}};
}
