import { database,loadRoom,loadRoomById,updateRoom,updateRoomById,saveRoom } from '../../../lib/store.ts';
import { command,makePerson,publicRoom,resolveRole,person,event,validateIntent,tick,type Room,type Role,Fault } from '../../../lib/engine.ts';
import { hash,random } from '../../../lib/crypto.ts';
import { match } from '../../../lib/graph.ts';
import { caller } from '../../../lib/identity.ts';
export const dynamic='force-dynamic';
const response=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function handleError(e:unknown){if(e instanceof Fault)return response({error:e.message},e.status);console.error('NightWalk API failure',e instanceof Error?e.message:'unknown');return response({error:'Could not save this change. Your walk has not been confirmed. Please try again.'},503);}
export async function GET(req:Request){try{
 const who=await caller(req),url=new URL(req.url),id=url.searchParams.get('id');
 if(!id)return response({signedIn:true,via:who.via,name:who.name??null});
 const token=req.headers.get('x-walk-token')??'';
 const r=token?await loadRoomById(id):await loadRoom(id,who.id);
 const role=await resolveRole(r,token);
 if(tick(r)&&!await saveRoom(r)){const updated=token?await loadRoomById(id):await loadRoom(id,who.id);return response(publicRoom(updated,role));}
 return response(publicRoom(r,role));
}catch(e){return handleError(e);}}
export async function POST(req:Request){try{
 const who=await caller(req);const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Fault('Cross-origin changes are not allowed.',403);
 const text=await req.text();if(text.length>24000)throw new Fault('Request is too large.',413);let b:any;try{b=JSON.parse(text);}catch{throw new Fault('Invalid request.');}const op=b.op;
 if(op==='discover'){
  validateIntent(b.intent);
  const rows=who.via==='auth0'
   ? await database().prepare('SELECT state FROM walks WHERE expires > ? ORDER BY expires DESC LIMIT 40').bind(Date.now()).all<{state:string}>()
   : await database().prepare('SELECT state FROM walks WHERE owner = ? AND expires > ? ORDER BY expires DESC LIMIT 30').bind(who.id,Date.now()).all<{state:string}>();
  const offers=rows.results.map(row=>JSON.parse(row.state) as Room).filter(r=>r.status==='waiting'&&!r.b&&r.a.registered).map(r=>({id:r.id,plan:match(r.a.intent,b.intent)})).filter(r=>r.plan);
  return response({offers});
 }
 if(op==='create'){
  const count=await database().prepare('SELECT COUNT(*) AS n FROM walks WHERE owner = ? AND expires > ?').bind(who.id,Date.now()).first<{n:number}>();if((count?.n??0)>=30)throw new Fault('Your workspace has 30 recent walks. Older walks expire after 24 hours.',429);
  const now=Date.now(),id=random().slice(0,16),invite=random(),{p,token,contactInvite}=await makePerson(b.name,b.pub,b.intent,now);
  const r:Room={id,owner:who.id,created:now,expires:now+86400000,rev:0,demo:!!b.demo,status:'waiting',a:p,inviteHash:await hash(invite),plan:null,challenges:{},actions:{},events:[]};event(r,'Private walk created');
  await database().prepare('INSERT INTO walks (id, owner, revision, state, expires) VALUES (?, ?, ?, ?, ?)').bind(id,who.id,0,JSON.stringify(r),r.expires).run();return response({room:publicRoom(r,'A'),token,invite,contactInvite});
 }
 if(typeof b.id!=='string'||b.id.length>64)throw new Fault('Missing walk ID.');
 if(op==='join'){
  const {r,result}=await updateRoomById(b.id,async r=>{if(r.b||r.status!=='waiting')throw new Fault('This companion invitation has already been used.');if(!b.discovery&&await hash(b.invite??'')!==r.inviteHash)throw new Fault('Invalid companion invitation.',403);const {p,token,contactInvite}=await makePerson(b.name,b.pub,b.intent,Date.now());const plan=match(r.a.intent,p.intent);if(b.discovery&&!plan)throw new Fault('These walks are no longer compatible.');r.b=p;r.inviteHash='consumed';r.plan=plan;r.status=r.plan?'matched':'no-match';event(r,r.plan?'A shared route is ready to review':'These walking plans do not overlap');return {token,contactInvite};});return response({...result,room:publicRoom(r,'B')});
 }
 if(op==='join-contact'){
  const target=b.role==='TB'?'TB':'TA';const {r,result}=await updateRoomById(b.id,async r=>{const p=person(r,target);if(!p||p.contactHash||await hash(b.invite??'')!==p.contactInviteHash)throw new Fault('Invalid or already used contact invitation.',403);const token=random();p.contactHash=await hash(token);p.contactInviteHash='consumed';return {token};});return response({...result,room:publicRoom(r,target)});
 }
 const token=req.headers.get('x-walk-token')??'';let role:Role='A';
 const {r,result}=token
  ? await updateRoomById(b.id,async r=>{role=await resolveRole(r,token);return command(r,role,op,b);})
  : await updateRoom(b.id,who.id,async r=>{role=await resolveRole(r,token);return command(r,role,op,b);});
 return response({room:publicRoom(r,role),result});
}catch(e){return handleError(e);}}
