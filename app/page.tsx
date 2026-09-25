'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, MapPin, RotateCcw, Send, Square, ThumbsDown, ThumbsUp, Ticket, Train, Utensils, CloudSun, Menu, X } from 'lucide-react';
import type { Card, FanContext, Source } from '@/lib/types';
import './style.css';

type Message = { id:string; role:'user'|'assistant'; content:string; sources?:Source[]; cards?:Card[]; route?:string; rating?:'up'|'down'; feedbackOpen?:boolean; feedbackSaved?:boolean; error?:boolean };
const welcome:Message = {id:'welcome',role:'assistant',content:'Hey, welcome to Q2 Stadium. Ask me about food, getting here, stadium policies, tickets, or the weather. Share your section and I can narrow down the options.'};
const suggestions = [
  {icon:Utensils,label:'Food near me',text:'I’m in section 123. Where can I get vegan food?'},
  {icon:Train,label:'Getting here',text:'How do I get to the stadium by train?'},
  {icon:Ticket,label:'Tickets',text:'How do I transfer my ticket?'},
  {icon:CloudSun,label:'Weather',text:'Will it rain at kickoff?'},
];
const key='austin-fc-fan-assistant-v1';
export default function Home(){
  const [messages,setMessages]=useState<Message[]>([welcome]);
  const [context,setContext]=useState<FanContext>({language:'en'});
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [drawer,setDrawer]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [retryText,setRetryText]=useState<string|null>(null);
  const [feedbackText,setFeedbackText]=useState('');
  const abort=useRef<AbortController|null>(null);
  const bottom=useRef<HTMLDivElement|null>(null);
  const input=useRef<HTMLTextAreaElement|null>(null);
  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x?.messages?.length)setMessages(x.messages);if(x?.context)setContext(x.context);}catch{}setHydrated(true);},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem(key,JSON.stringify({messages:messages.slice(-30),context}));},[messages,context,hydrated]);
  useEffect(()=>bottom.current?.scrollIntoView({behavior:'smooth',block:'end'}),[messages,busy]);
  function reset(){abort.current?.abort();setBusy(false);setMessages([welcome]);setContext({language:'en'});setDraft('');setRetryText(null);setDrawer(false);input.current?.focus();}
  async function send(question?:string,isRetry=false){
    const text=(question??draft).trim();if(!text||busy)return;
    const history=messages.filter(m=>m.id!=='welcome'&&!m.error);
    const conversation=isRetry?history:[...history,{id:crypto.randomUUID(),role:'user' as const,content:text}];
    const id=crypto.randomUUID();setMessages([welcome,...conversation,{id,role:'assistant',content:''}]);
    setDraft('');setBusy(true);setRetryText(null);setDrawer(false);
    const controller=new AbortController();abort.current=controller;
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:conversation.map(({role,content})=>({role,content})),context}),signal:controller.signal});
      if(!response.ok||!response.body)throw new Error('Service unavailable');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){
        const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});
        const lines=buffer.split('\n');buffer=lines.pop()||'';
        for(const line of lines){if(!line)continue;const event=JSON.parse(line);
          if(event.type==='meta'){setContext(event.context);setMessages(old=>old.map(m=>m.id===id?{...m,sources:event.sources,cards:event.cards,route:event.route}:m));}
          if(event.type==='delta')setMessages(old=>old.map(m=>m.id===id?{...m,content:m.content+event.text}:m));
          if(event.type==='error')throw new Error(event.message);
        }
      }
    }catch{setMessages(old=>old.map(m=>m.id===id?{...m,content:controller.signal.aborted?'Response stopped.':'Something went wrong. Please try again.',error:true}:m));if(!controller.signal.aborted)setRetryText(text);}
    finally{setBusy(false);abort.current=null;input.current?.focus();}
  }
  async function rate(id:string,rating:'up'|'down',comment?:string){
    const message=messages.find(m=>m.id===id);if(!message)return;
    setMessages(old=>old.map(m=>m.id===id?{...m,rating,feedbackOpen:rating==='down'&&comment===undefined}:m));
    if(rating==='down'&&comment===undefined)return;
    try{
      const index=messages.findIndex(m=>m.id===id),question=[...messages.slice(0,index)].reverse().find(m=>m.role==='user')?.content;
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating,comment,route:message.route,question})});
      if(!response.ok)throw new Error('Save failed');
      setMessages(old=>old.map(m=>m.id===id?{...m,feedbackOpen:false,feedbackSaved:true}:m));setFeedbackText('');
    }catch{setMessages(old=>old.map(m=>m.id===id?{...m,feedbackOpen:true,feedbackSaved:false}:m));}
  }
  return <div className="app">
    <aside className={'sidebar '+(drawer?'open':'')}>
      <div className="brand"><div className="brand-icon">AFC</div><div><strong>AUSTIN FC</strong><small>FAN ASSISTANT</small></div><button className="mobile menu-close" onClick={()=>setDrawer(false)} aria-label="Close menu"><X size={20}/></button></div>
      <nav><div className="nav-label">YOUR MATCHDAY</div><button className="nav-link selected" onClick={()=>setDrawer(false)}>Ask the assistant</button><a className="nav-link" href="/sources">Sources & freshness</a><div className="nav-divider"/><div className="nav-label">QUICK LINKS</div><a className="nav-link" target="_blank" rel="noopener noreferrer" href="https://www.q2stadium.com/stadium-maps/"><MapPin size={17}/>Stadium map <ExternalLink size={12}/></a><a className="nav-link" target="_blank" rel="noopener noreferrer" href="https://www.austinfc.com/schedule/"><Ticket size={17}/>Match schedule <ExternalLink size={12}/></a><a className="nav-link" target="_blank" rel="noopener noreferrer" href="https://www.q2stadium.com/directions/"><Train size={17}/>Getting to Q2 <ExternalLink size={12}/></a></nav>
      <div className="sidebar-footer"><div className="context-box"><strong>Your visit</strong><span>{context.section?'Section '+context.section:'Section not set'}</span>{context.dietary&&<span>{context.dietary}</span>}<span>{context.language==='es'?'Español':'English'}</span></div><button className="reset" onClick={reset}><RotateCcw size={15}/>Start over / Reset</button><small>Independent demo. Confirm match details with official providers.</small></div>
    </aside>
    {drawer&&<button className="scrim" aria-label="Close menu" onClick={()=>setDrawer(false)}/>}
    <main className="main">
      <header className="topbar"><button className="mobile menu-open" onClick={()=>setDrawer(true)} aria-label="Open menu"><Menu size={21}/></button><div className="top-title"><i/>Austin FC Fan Assistant <span>PREVIEW</span></div><a href="/sources">Our sources <ArrowRight size={15}/></a></header>
      <div className="scroll"><div className="conversation">
        {messages.length===1&&<div className="hero"><div className="eyebrow">HERE FOR EVERY MATCHDAY</div><h1>Need a hand at <em>Q2?</em></h1><p>From the first train to the final whistle, find the information you need, right when you need it.</p></div>}
        <div className="messages" aria-live="polite">{messages.map(m=><div key={m.id} className={'message '+m.role}><div className="avatar">{m.role==='assistant'?'AF':'YOU'}</div><div className="message-main"><strong>{m.role==='assistant'?'Austin FC Fan Assistant':'You'}</strong><div className={'message-copy '+(m.error?'error':'')}>{m.content||(busy&&m.id===messages.at(-1)?.id?'Thinking…':'')}</div>
          {!!m.cards?.length&&<div className="cards">{m.cards.slice(0,4).map((c,i)=><a key={i} href={c.href} target="_blank" rel="noopener noreferrer" className="card"><strong>{c.title}</strong><small>{c.detail}</small><b>{c.label} <ArrowRight size={14}/></b></a>)}</div>}
          {!!m.sources?.length&&<div className="sources"><span>Sources</span>{m.sources.slice(0,4).map((s,i)=><a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.title} <ExternalLink size={11}/></a>)}</div>}
          {m.role==='assistant'&&m.id!=='welcome'&&!busy&&!m.error&&<div className="feedback">Helpful? <button aria-label="Helpful answer" className={m.rating==='up'?'active':''} onClick={()=>rate(m.id,'up')}><ThumbsUp size={15}/></button><button aria-label="Unhelpful answer" className={m.rating==='down'?'active':''} onClick={()=>rate(m.id,'down')}><ThumbsDown size={15}/></button>{m.feedbackSaved&&<span>Saved</span>}</div>}
          {m.feedbackOpen&&<form className="feedback-form" onSubmit={e=>{e.preventDefault();rate(m.id,'down',feedbackText);}}><label htmlFor={'feedback-'+m.id}>What could be better? (optional)</label><textarea id={'feedback-'+m.id} maxLength={700} value={feedbackText} onChange={e=>setFeedbackText(e.target.value)}/><button type="submit">Send feedback</button></form>}
        </div></div>)}</div>
        {messages.length===1&&<div className="suggestions"><div className="nav-label">TRY ASKING</div><div className="suggestion-grid">{suggestions.map(({icon:Icon,label,text})=><button key={label} onClick={()=>send(text)}><Icon size={22}/><strong>{label}</strong><span>{text}</span><ArrowRight className="corner" size={16}/></button>)}</div></div>}
        {retryText&&<button className="retry" onClick={()=>send(retryText,true)}><RotateCcw size={15}/>Retry last question</button>}
        <div ref={bottom}/>
      </div></div>
      <div className="composer-wrap"><form className="composer" onSubmit={e=>{e.preventDefault();send();}}><label className="sr-only" htmlFor="chat">Ask a question</label><textarea id="chat" ref={input} placeholder="Ask about food, tickets, parking, weather..." rows={1} maxLength={1500} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}/><button type={busy?'button':'submit'} onClick={busy?()=>abort.current?.abort():undefined} disabled={!busy&&!draft.trim()} aria-label={busy?'Stop answer':'Send message'}>{busy?<Square size={17} fill="currentColor"/>:<Send size={18}/>}</button></form><div className="composer-note">Answers use published sources. Confirm policies, availability, and game times with the official provider.</div></div>
    </main>
  </div>;
}
