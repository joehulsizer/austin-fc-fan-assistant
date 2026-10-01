import { put } from '@vercel/blob';
import { privateKey,privateRead,privateOptions,reserveRouting } from './limits';
import type { FanContext } from './types';
export type RouteEstimate={minutes:number;distanceKm:number;mode:string;provider:string;traffic:boolean;checkedAt:string;originLabel:string};
const DEST={latitude:30.3877,longitude:-97.7194};
const agent='AustinFCFanAssistant-POC/2.0 (https://austin-fc-fan-assistant.vercel.app)';
async function cache<T>(key:string,value:T){if(process.env.FEEDBACK_READ_WRITE_TOKEN||process.env.FEEDBACK_STORE_ID)await put(key,JSON.stringify(value),{access:'private',...privateOptions(),addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60,contentType:'application/json'});}
async function geocode(origin:string):Promise<{lat:number;lon:number;label:string}|undefined> {
  const key=`operations/geocode/${privateKey(origin.toLowerCase())}.json`,cached=await privateRead<{lat:number;lon:number;label:string}>(key);
  if(cached)return cached.value;
  if(!await reserveRouting('nominatim'))return;
  if(/\d{1,6}\s+\w|\b(?:home|house|address|casa|direccion)\b/i.test(origin))return;
  const query=origin==='UT Austin'?'University of Texas at Austin':origin;
  const u=new URL(process.env.NOMINATIM_ENDPOINT||'https://nominatim.openstreetmap.org/search');
  u.search=new URLSearchParams({q:/texas|austin|antonio/i.test(query)?query:query+', Texas, USA',format:'jsonv2',countrycodes:'us',limit:'1'}).toString();
  const r=await fetch(u,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!r.ok)return;
  const rows=await r.json() as {lat:string;lon:string;display_name:string}[],first=rows[0];if(!first)return;
  const value={lat:Number(first.lat),lon:Number(first.lon),label:first.display_name};
  if(!Number.isFinite(value.lat)||!Number.isFinite(value.lon)||value.lat<25||value.lat>37||value.lon< -107||value.lon> -93)return;
  await cache(key,value);return value;
}
export async function liveRoute(context:FanContext,mode:string):Promise<RouteEstimate|undefined> {
  if(!context.origin||!['car','parking','rideshare','walk','bike'].includes(mode))return;
  if(!process.env.VERCEL&&!process.env.ROUTING_LIVE_TEST)return;
  const key=`operations/routes/${privateKey(context.origin.toLowerCase()+'|'+mode)}.json`;
  try {
    const saved=await privateRead<RouteEstimate>(key);if(saved&&Date.now()-Date.parse(saved.value.checkedAt)<15*60000)return saved.value;
    let value:RouteEstimate|undefined;
    if(process.env.GOOGLE_MAPS_API_KEY) {
      if(!await reserveRouting('google'))return;
      const routeMode=mode==='walk'?'WALK':mode==='bike'?'BICYCLE':'DRIVE';
      const r=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'routes.duration,routes.distanceMeters'},body:JSON.stringify({origin:{address:context.origin},destination:{location:{latLng:DEST}},travelMode:routeMode,...(routeMode==='DRIVE'?{routingPreference:'TRAFFIC_AWARE'}:{})}),signal:AbortSignal.timeout(6500),cache:'no-store'});
      const d=await r.json(),route=d.routes?.[0];
      if(r.ok&&route&&/^\d+(?:\.\d+)?s$/.test(route.duration))value={minutes:Math.ceil(parseFloat(route.duration)/60),distanceKm:route.distanceMeters/1000,provider:'Google Routes',traffic:routeMode==='DRIVE',mode,checkedAt:new Date().toISOString(),originLabel:context.origin};
    } else {
      const point=await geocode(context.origin);if(!point||!await reserveRouting('osrm'))return;
      const profile=mode==='walk'?'foot':mode==='bike'?'bike':'car';
      const u=`${process.env.OSRM_API_BASE||'https://routing.openstreetmap.de'}/routed-${profile}/route/v1/driving/${point.lon},${point.lat};${DEST.longitude},${DEST.latitude}?overview=false&steps=false`;
      const r=await fetch(u,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(6500),cache:'no-store'});
      const d=await r.json(),route=d.routes?.[0];
      if(r.ok&&d.code==='Ok'&&Number.isFinite(route?.duration))value={minutes:Math.ceil(route.duration/60),distanceKm:route.distance/1000,provider:'OpenStreetMap / OSRM',traffic:false,mode,checkedAt:new Date().toISOString(),originLabel:context.origin};
    }
    if(value&&value.minutes>0&&value.minutes<=480){await cache(key,value);return value;}
  }catch{console.warn(JSON.stringify({event:'routing_unavailable',mode}));}
}
