import {hostname as systemHostname,networkInterfaces} from 'node:os';
// Host/Origin allow-list for the page server. Loopback mode only answers localhost names; LAN mode
// (HTTP_HOST=0.0.0.0, for iPhone/iPad) also answers this Mac's current IPv4 addresses and .local name.
// Anything else stays 403, which blocks DNS-rebinding pages from reading /api/.
export function lanAddresses(interfaces=networkInterfaces()){return [...new Set(Object.values(interfaces).flat().filter(info=>info&&info.family==='IPv4'&&!info.internal).map(info=>info.address))];}
export function allowedHosts({port,httpHost='127.0.0.1',interfaces,hostname=systemHostname()}){
 const names=['localhost','127.0.0.1'];
 if(httpHost==='0.0.0.0'){const short=hostname.toLowerCase().replace(/\.local$/,'');names.push(...lanAddresses(interfaces),short,`${short}.local`);}
 else if(httpHost!=='127.0.0.1'&&httpHost!=='localhost')names.push(httpHost);
 return new Set(names.map(name=>`${name}:${port}`));
}
export function pageUrls({port,httpHost='127.0.0.1',interfaces}){return httpHost==='0.0.0.0'?lanAddresses(interfaces).map(address=>`http://${address}:${port}`):[];}
