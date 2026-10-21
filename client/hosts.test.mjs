import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedHosts,pageUrls} from './hosts.mjs';
const interfaces={lo0:[{family:'IPv4',address:'127.0.0.1',internal:true}],en0:[{family:'IPv6',address:'fe80::1',internal:false},{family:'IPv4',address:'192.168.1.20',internal:false}]};
test('loopback mode answers only localhost names',()=>{
 const hosts=allowedHosts({port:4173,interfaces,hostname:'Studio-Mac.local'});
 assert.deepEqual([...hosts],['localhost:4173','127.0.0.1:4173']);
 assert.deepEqual(pageUrls({port:4173,interfaces}),[]);
});
test('LAN mode adds this Mac\'s addresses and .local name, nothing else',()=>{
 const hosts=allowedHosts({port:4173,httpHost:'0.0.0.0',interfaces,hostname:'Studio-Mac.local'});
 for(const host of ['localhost:4173','192.168.1.20:4173','studio-mac:4173','studio-mac.local:4173'])assert.ok(hosts.has(host),host);
 for(const host of ['evil.example:4173','192.168.1.20:80','192.168.1.21:4173','[fe80::1]:4173'])assert.ok(!hosts.has(host),host);
 assert.deepEqual(pageUrls({port:4173,httpHost:'0.0.0.0',interfaces}),['http://192.168.1.20:4173']);
});
