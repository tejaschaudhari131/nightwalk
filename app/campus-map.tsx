'use client';
import { nodes,edges,walkerPath,type Plan } from '../lib/graph';
function lineOf(ids:string[]){return ids.map(id=>nodes.find(n=>n.id===id)).filter(Boolean).map(n=>`${n!.x},${n!.y}`).join(' ');}
function pin(n:{x:number;y:number},text:string,fill:string,width=60){return <g><rect x={n.x-width/2} y={n.y-45} width={width} height="23" rx="5" fill={fill}/><text x={n.x} y={n.y-29} textAnchor="middle" className="pin-label">{text}</text></g>;}
export default function CampusMap({origin,destination,plan}:{origin:string;destination:string;plan?:Plan|null}){
 const personal=walkerPath(origin,destination,plan);
 const shared=plan?.path??[];
 const sharedSet=new Set(shared);
 return <div className="campus-map"><div className="map-top"><span className="small-cap">{plan?'YOUR WALK + SHARED STRETCH':'YOUR SHARED GROUND'}</span><span className="map-chip">CMU · Pittsburgh</span></div><svg viewBox="0 0 800 600" role="img" aria-label={plan?'Your approach, shared campus stretch, and onward walk':'Illustrative campus walking network'}>
 <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#24392f" strokeWidth=".6"/></pattern><filter id="glow"><feGaussianBlur stdDeviation="6"/></filter></defs>
 <rect width="800" height="600" fill="url(#grid)"/>
 <path d="M0 208 L810 208 M365 0L365 600 M0 550L800 550" stroke="#26372f" strokeWidth="24"/>
 <path d="M0 208 L810 208 M365 0L365 600 M0 550L800 550" stroke="#34443b" strokeWidth="1" strokeDasharray="6 8"/>
 <text x="30" y="195" className="street">FORBES AVENUE</text><text x="625" y="539" className="street">SCHENLEY DRIVE</text><text x="353" y="570" transform="rotate(-90 353 570)" className="street">MOREWOOD AVENUE</text>
 {edges.map(([a,b])=>{const x=nodes.find(n=>n.id===a)!,y=nodes.find(n=>n.id===b)!;return <line key={a+b} x1={x.x} y1={x.y} x2={y.x} y2={y.y} stroke="#4d6657" strokeWidth="3" strokeDasharray="3 7"/>;})}
 {plan&&<polyline points={lineOf(personal)} fill="none" stroke="#8faf7a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 8" opacity=".9"/>}
 <polyline points={lineOf(plan?shared:personal)} fill="none" stroke="#c6ef85" strokeWidth="16" opacity=".14" filter="url(#glow)"/>
 <polyline points={lineOf(plan?shared:personal)} fill="none" stroke="#c6ef85" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
 {nodes.map(n=>{
  const onPersonal=personal.includes(n.id),onShared=sharedSet.has(n.id),featured=n.id===origin||n.id===destination||n.id===plan?.meeting||n.id===plan?.split;
  return <g key={n.id}>
   <circle cx={n.x} cy={n.y} r={featured?12:5} fill={onShared||(!plan&&onPersonal)?'#c6ef85':onPersonal?'#9bb88a':'#637e6a'} stroke="#17241e" strokeWidth={featured?5:2}/>
   <text x={n.x+17} y={n.y+5} className={onPersonal||onShared?'place active':'place'}>{n.name}</text>
   {plan?<>
    {n.id===origin&&n.id!==plan.meeting&&pin(n,'START','#d5dfd7')}
    {n.id===plan.meeting&&pin(n,'MEET','#c6ef85')}
    {n.id===plan.split&&n.id!==plan.meeting&&pin(n,'SPLIT','#d5dfd7')}
    {n.id===destination&&n.id!==plan.split&&n.id!==plan.meeting&&pin(n,'END','#b7c4b0',52)}
   </>:<>
    {n.id===personal[0]&&pin(n,'START','#c6ef85')}
    {n.id===personal[personal.length-1]&&n.id!==personal[0]&&pin(n,'END','#d5dfd7',52)}
   </>}
  </g>;
 })}
 </svg><div className="map-bottom"><span><i className="line-key"/> {plan?'Shared stretch · dashed is your approach':'Your planned route'}</span><span>Illustrative campus graph · not navigation</span></div></div>;
}
