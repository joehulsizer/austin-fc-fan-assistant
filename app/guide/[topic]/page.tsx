import Guide from '../page';
export const dynamic='force-dynamic';
export default async function TopicGuide({params,searchParams}:{params:Promise<{topic:string}>;searchParams:Promise<{find?:string;section?:string;entry?:string}>}) {
 const path=await params,search=await searchParams;
 return Guide({searchParams:Promise.resolve({...search,topic:path.topic})});
}
