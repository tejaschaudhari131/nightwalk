export const nodes = [
 {id:'gates',name:'Gates Center',x:235,y:310}, {id:'wean',name:'Wean Hall',x:170,y:390},
 {id:'hunt',name:'Hunt Library',x:310,y:500}, {id:'cut',name:'The Cut',x:405,y:355},
 {id:'cohen',name:'Cohon Center',x:530,y:400}, {id:'forbes',name:'Forbes crossing',x:445,y:230},
 {id:'tepper',name:'Tepper',x:280,y:165}, {id:'morewood',name:'Morewood area',x:480,y:85},
 {id:'resnik',name:'Resnik area',x:680,y:240}, {id:'oakland',name:'Oakland zone',x:90,y:150},
];
export const edges: [string,string,number][] = [ ['gates','wean',2],['gates','cut',3],['wean','hunt',3],['hunt','cut',3],['cut','cohen',2],['cut','forbes',2],['forbes','tepper',3],['forbes','morewood',3],['forbes','resnik',4],['tepper','oakland',4] ];
export const label=(id:string)=>nodes.find(n=>n.id===id)?.name??id;
export type Intent={origin:string;destination:string;leaveAt:number;window:number;detour:number;wait:number};
export type Plan={meeting:string;split:string;path:string[];minutes:number;meetAt:number;extraA:number;extraB:number;waitA:number;waitB:number;graphVersion:string};
export function shortest(from:string,to:string):{path:string[];minutes:number}{
 const costs=new Map(nodes.map(n=>[n.id,Infinity])); const prev=new Map<string,string>(); const unseen=new Set(nodes.map(n=>n.id));costs.set(from,0);
 while(unseen.size){const u=[...unseen].sort((a,b)=>costs.get(a)!-costs.get(b)!)[0];unseen.delete(u);if(u===to)break;
 for(const [a,b,w] of edges){const v=a===u?b:b===u?a:null;if(v&&unseen.has(v)&&costs.get(u)!+w<costs.get(v)!){costs.set(v,costs.get(u)!+w);prev.set(v,u);}}}
 const path=[to];while(path[0]!==from){const p=prev.get(path[0]);if(!p)return {path:[],minutes:Infinity};path.unshift(p);}return {path,minutes:costs.get(to)!};
}
/** Reconstruct this walker's full path from their own endpoints plus the shared plan. Never requires the companion's destination. */
export function walkerPath(origin:string,destination:string,plan?:Plan|null):string[]{
 if(!plan)return shortest(origin,destination).path;
 const head=shortest(origin,plan.meeting).path,tail=shortest(plan.split,destination).path;
 if(!head.length||!tail.length||!plan.path.length)return shortest(origin,destination).path;
 return [...head.slice(0,-1),...plan.path.slice(0,-1),...tail];
}
export function match(a:Intent,b:Intent):Plan|null{
 const candidates:Plan[]=[];
 for(const m of nodes)for(const s of nodes){if(m.id===s.id)continue;const shared=shortest(m.id,s.id);if(shared.minutes<4)continue;
 const aa=shortest(a.origin,m.id),bb=shortest(b.origin,m.id),ae=shortest(s.id,a.destination),be=shortest(s.id,b.destination);
 const extraA=aa.minutes+shared.minutes+ae.minutes-shortest(a.origin,a.destination).minutes;
 const extraB=bb.minutes+shared.minutes+be.minutes-shortest(b.origin,b.destination).minutes;
 if(extraA>a.detour||extraB>b.detour)continue;
 // Reject a proposed path that retraces an edge or passes its own endpoint before splitting.
 const fullA=[...aa.path.slice(0,-1),...shared.path.slice(0,-1),...ae.path],fullB=[...bb.path.slice(0,-1),...shared.path.slice(0,-1),...be.path];
 if(new Set(fullA).size!==fullA.length||new Set(fullB).size!==fullB.length)continue;
 const ar=a.leaveAt+aa.minutes*60000,br=b.leaveAt+bb.minutes*60000,meetAt=Math.max(ar,br);
 if(meetAt>ar+(a.window+a.wait)*60000||meetAt>br+(b.window+b.wait)*60000)continue;
 const waitA=Math.max(0,(meetAt-ar)/60000-a.window),waitB=Math.max(0,(meetAt-br)/60000-b.window);
 candidates.push({meeting:m.id,split:s.id,path:shared.path,minutes:shared.minutes,meetAt,extraA,extraB,waitA,waitB,graphVersion:'campus-illustrative-v1'});
 }return candidates.sort((x,y)=>y.minutes-x.minutes||Math.max(x.extraA,x.extraB)-Math.max(y.extraA,y.extraB)||x.waitA+x.waitB-y.waitA-y.waitB)[0]??null;
}
