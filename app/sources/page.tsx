import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getKnowledge } from '@/lib/knowledge';
import '../style.css';

export default async function SourcesPage(){
  const data=await getKnowledge();
  const grouped=[
    {title:'Food, drinks & stadium map',links:data.sources.filter(s=>/food-and-drink|stadium-maps/.test(s.url))},
    {title:'Policies, accessibility & travel',links:data.sources.filter(s=>/policy|directions|parking/.test(s.url))},
    {title:'Current services',links:[
      {url:'https://www.capmetro.org/special-events/Q2'},
      {url:'https://www.austinfc.com/schedule/'},
      {url:'https://www.austinfc.com/roster/'},
      {url:'https://www.austinfc.com/news/'},
      {url:'https://images.mlssoccer.com/image/upload/v1763667074/assets/atx/2026_AustinFC_Schedule_PrintColor_lyhkf3.pdf'},
      {url:'https://www.austinfc.com/tickets/'},
      {url:'https://www.austinfc.com/tickets/mobile-ticketing'},
      {url:'https://forecast.weather.gov/MapClick.php?lat=30.3877&lon=-97.7194'},
    ]},
  ];
  return <main style={{minHeight:'100dvh',background:'#f7faf8',padding:'30px 20px'}}>
    <div style={{maxWidth:760,margin:'auto'}}>
      <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:7,color:'#148a53',fontSize:13,fontWeight:700}}><ArrowLeft size={16}/> Back to assistant</Link>
      <div style={{fontFamily:'Oswald,sans-serif',fontSize:11,letterSpacing:2,color:'#15965c',marginTop:42}}>OFFICIAL INFORMATION</div>
      <h1 style={{fontFamily:'Oswald,sans-serif',fontSize:48,textTransform:'uppercase',margin:'10px 0 12px'}}>Our sources</h1>
      <p style={{fontSize:15,lineHeight:1.7,color:'#607366',maxWidth:670}}>The assistant uses published Q2 Stadium information for concessions and policies. Weather comes from the National Weather Service. Match and club answers require a fresh official Austin FC or MLS source. Historical fan questions shaped the design but never override current information.</p>
      <p style={{color:'#245a3b',fontSize:13,fontWeight:700}}>Stadium knowledge last checked: {new Date(data.checkedAt).toLocaleString('en-US',{timeZone:'America/Chicago',dateStyle:'long',timeStyle:'short'})} CT</p>
      {grouped.map(group=><section key={group.title} style={{marginTop:30}}><h2 style={{fontFamily:'Oswald,sans-serif',fontSize:23,margin:'0 0 12px'}}>{group.title}</h2><div style={{display:'grid',gap:8}}>{group.links.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',padding:'14px 16px',border:'1px solid #dce9df',borderRadius:10,background:'#fff',fontSize:13,color:'#235437'}}><span>{new URL(s.url).pathname.replace(/\/$/,'')||new URL(s.url).hostname}</span><ExternalLink size={15}/></a>)}</div></section>)}
      <div style={{background:'#eaf5ed',padding:18,borderRadius:12,marginTop:32,fontSize:13,lineHeight:1.7,color:'#325841'}}><strong>How freshness works</strong><br/>The published snapshot is checked regularly. Updates must pass completeness checks before replacing the last working version. Live weather is cached briefly. If a current match or policy cannot be verified, the assistant says so and links to the official source. Vendor positions from the official list take priority when the interactive map contains older labels.</div>
      <p style={{fontSize:11,color:'#809387',margin:'26px 0'}}>Independent preview for testing. Venue operators and official providers control final policies, schedules, and availability.</p>
    </div>
  </main>;
}
