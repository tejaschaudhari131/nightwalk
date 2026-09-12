import assert from 'node:assert/strict';
import {newKey,sign,verify,hash} from '../lib/crypto.ts';
const base='http://localhost:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=login.headers.get('set-cookie')!.split(';')[0];
async function post(op:string,b:any={},token?:string){const r=await fetch(base+'/api/nightwalk',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:base,...(token?{'x-walk-token':token}:{})},body:JSON.stringify({op,...b})});const data:any=await r.json();if(!r.ok)throw new Error(data.error);return data;}
const anon=await fetch(base+'/api/nightwalk');assert.equal(anon.status,401);
const a=await newKey(),b=await newKey(),now=Date.now(),intent={origin:'gates',destination:'morewood',leaveAt:now,window:5,detour:2,wait:5};
let A=await post('create',{name:'API test A',pub:a.publicKey,intent,demo:true});const id=A.room.id;
await post('register',{id,signature:await sign(a.pair.privateKey,A.room.registration)},A.token);
const offers=await post('discover',{intent:{...intent,origin:'wean',destination:'resnik'}});assert.ok(offers.offers.some((o:any)=>o.id===id));
let B=await post('join',{id,invite:A.invite,name:'API test B',pub:b.publicKey,intent:{...intent,origin:'wean',destination:'resnik'}});
await post('register',{id,signature:await sign(b.pair.privateKey,B.room.registration)},B.token);
await post('accept',{id},A.token);let state=(await post('accept',{id},B.token)).room;
async function read(token:string){const res=await fetch(base+'/api/nightwalk?id='+id,{headers:{Cookie:cookie,'x-walk-token':token}});assert.equal(res.status,200);return await res.json() as any;}
const as=await read(A.token),bs=await read(B.token);
await post('scan',{id,payload:bs.meeting,signature:await sign(b.pair.privateKey,bs.meeting)},A.token);
await post('scan',{id,payload:as.meeting,signature:await sign(a.pair.privateKey,as.meeting)},B.token);
for(const [role,actor,k] of [['A',A,a],['B',B,b]] as const){state=(await post('agreement',{id,signature:await sign(k.pair.privateKey,{domain:'nightwalk.agreement-signature.v1',room:id,role,agreementHash:state.agreementHash})},actor.token)).room;}
assert.equal(state.status,'active');assert.equal(state.agreementHash,await hash(state.agreement));
const ch=(await post('challenge',{id,action:'CHECK_IN',payload:{}},A.token)).result.envelope;const sig=await sign(a.pair.privateKey,ch);
const sent=await post('action',{id,envelope:ch,signature:sig},A.token);assert.equal(sent.result.sequence,1);
const replay=await post('action',{id,envelope:ch,signature:sig},A.token);assert.equal(replay.result.replayed,true);
const forged=(await post('challenge',{id,action:'ARRIVE',payload:{}},A.token)).result.envelope;
await assert.rejects(()=>post('action',{id,envelope:forged,signature:'AAAA'},A.token),/Signature rejected/);
const wrong=await sign(b.pair.privateKey,forged);await assert.rejects(()=>post('action',{id,envelope:forged,signature:wrong},A.token),/Signature rejected/);
const contact=await post('join-contact',{id,role:'TA',invite:A.contactInvite});await post('contact-accept',{id},contact.token);
async function action(actor:any,k:any,action:string,payload:any={}){const e=(await post('challenge',{id,action,payload},actor.token)).result.envelope;return post('action',{id,envelope:e,signature:await sign(k.pair.privateKey,e)},actor.token);}
await action(A,a,'ARM_TIMER',{minutes:1,demo:true});const after=await read(B.token);assert.equal(after.peer.timer,undefined);assert.equal(after.peer.intent,undefined);
await action(B,b,'LEAVE');assert.equal((await read(A.token)).me.timer.state,'armed');
console.log('LIVE API: matching, two signatures, scope checks, forgery rejection, replay and independent timer passed.');
console.log('Waiting for the 30-second demonstration deadline...');
await new Promise(r=>setTimeout(r,31000));const alert=await read(contact.token);assert.equal(alert.timer.state,'alerted');await post('acknowledge',{id},contact.token);
await action(A,a,'ARRIVE',{version:1});assert.equal((await read(contact.token)).timer.state,'arrived');assert.equal((await read(B.token)).me.arrived,false);
console.log('LIVE API: contact consent, overdue incident, acknowledgement and independent arrival resolution passed.');


