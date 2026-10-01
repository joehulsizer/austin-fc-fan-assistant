import {get,list,put} from '@vercel/blob';
import {sharedChatSchema,sanitizeShare} from './share';
import {privateOptions} from './limits';
// Reviewer-only migration: preserve a private backup before replacing old public records.
export async function redactLegacyShares(cursor?:string){
 const page=await list({prefix:'shares/',limit:30,cursor});let examined=0,redacted=0,invalid=0;
 for(const item of page.blobs){
  const read=await get(item.pathname,{access:'public',useCache:false});if(!read?.stream)continue;
  const raw=await new Response(read.stream).text();const parsed=sharedChatSchema.safeParse(JSON.parse(raw));
  if(!parsed.success){invalid++;continue;}
  examined++;const clean={...parsed.data,...sanitizeShare(parsed.data)},json=JSON.stringify(clean);
  if(JSON.stringify(parsed.data)===json)continue;
  await put(`operations/share-backups/${parsed.data.id}.json`,raw,{access:'private',...privateOptions(),addRandomSuffix:false,contentType:'application/json'});
  await put(item.pathname,json,{access:'public',addRandomSuffix:false,allowOverwrite:true,ifMatch:read.blob.etag,cacheControlMaxAge:60,contentType:'application/json'});redacted++;
 }
 return {examined,redacted,invalid,cursor:page.hasMore?page.cursor:null};
}
