import { canonicalize } from 'json-canonicalize';
export const canon=(v:unknown)=>canonicalize(v);
export const bytes=(v:unknown)=>new TextEncoder().encode(canon(v));
export const b64=(v:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(v instanceof Uint8Array?v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength):v))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const un64=(v:string)=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const hash=async(v:unknown)=>b64(await crypto.subtle.digest('SHA-256',bytes(v)));
export async function newKey(){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);return {pair,publicKey:b64(await crypto.subtle.exportKey('raw',pair.publicKey))};}
export async function sign(key:CryptoKey,v:unknown){return b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,bytes(v)));}
export async function verify(publicKey:string,v:unknown,signature:string){try{const key=await crypto.subtle.importKey('raw',un64(publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,un64(signature),bytes(v));}catch{return false;}}
