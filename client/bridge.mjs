import dgram from 'node:dgram';
import {randomUUID} from 'node:crypto';
import {decodePacket,encodeMessage,newDeck,applyMessage} from './osc.mjs';
export function createBridge({receivePort=9000,requestPort=9001}={}){
 const socket=dgram.createSocket('udp4'),clients=new Set();
 let decks=Array.from({length:4},(_,i)=>newDeck(i+1)),lastPacket=0,packets=0,recognized=0,malformed=0,lastRequest=0,ready=false,error=null,session=randomUUID();
 const addresses=new Set();
 let mixer={crossfader:null};
 function snapshot(){const now=Date.now();return {session,now,ready,error,receivePort,requestPort,lastPacket,packets,recognized,malformed,status:!ready?'error':!lastPacket?'waiting':now-lastPacket>2500?'stale':'receiving',addresses:[...addresses],mixer,decks};}
 function dump(){const now=Date.now();if(!ready||now-lastRequest<1100)return false;lastRequest=now;socket.send(encodeMessage('/djay/request/dumpAll'),requestPort,'127.0.0.1',e=>{if(e)error=e.message;});return true;}
 socket.on('message',(packet,remote)=>{
  if(remote.address!=='127.0.0.1')return;
  let messages;try{messages=decodePacket(packet);}catch{malformed++;return;}
  const valid=messages.filter(m=>m.address.startsWith('/djay/'));if(!valid.length)return;
  const now=Date.now();if(lastPacket&&now-lastPacket>5000){decks=Array.from({length:4},(_,i)=>newDeck(i+1));session=randomUUID();mixer={crossfader:null};dump();}
  lastPacket=now;packets++;
  for(const message of valid){if(message.address==='/djay/mixer/crossfader'&&message.args.length===1&&Number.isFinite(message.args[0])&&message.args[0]>=0&&message.args[0]<=1){mixer.crossfader=message.args[0];recognized++;}if(addresses.size<150)addresses.add(message.address);const generations=decks.map(d=>d.generation).join(',');if(applyMessage(decks,message,now))recognized++;if(generations!==decks.map(d=>d.generation).join(','))dump();}
 });
 socket.on('error',e=>{error=e.message;ready=false;});
 socket.bind(receivePort,'127.0.0.1',()=>{ready=true;dump();});
 const updates=setInterval(()=>{const frame='data: '+JSON.stringify(snapshot())+'\n\n';for(const client of clients){if(client.writableLength>256000){client.destroy();clients.delete(client);}else client.write(frame);}},100);
 const refresh=setInterval(dump,5000);
 return {snapshot,dump,subscribe(response){clients.add(response);response.write('data: '+JSON.stringify(snapshot())+'\n\n');response.on('close',()=>clients.delete(response));dump();},close(){clearInterval(updates);clearInterval(refresh);for(const client of clients)client.end();socket.close();}};
}
