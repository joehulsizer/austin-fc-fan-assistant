'use client';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowRight, MapPin, RotateCcw, Send, Square, ThumbsDown, ThumbsUp, Ticket, Train, Utensils, CloudSun, Menu, X, MessageCircle, BookOpen, CircleHelp, PanelLeftClose, PanelLeftOpen, Share2, Copy, Check } from 'lucide-react';
import type { Action, Card, FanContext, Source } from '@/lib/types';
import { internalGuideHref } from '@/lib/internal-links';
import { sanitizeShare } from '@/lib/share';
import { guestActions, isActionHref } from '@/lib/handoffs';
import './style.css';

type Message = { id:string; role:'user'|'assistant'; content:string; sources?:Source[]; cards?:Card[]; actions?:Action[]; route?:string; rating?:'up'|'down'; feedbackOpen?:boolean; feedbackSaved?:boolean; error?:boolean };
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
  const [collapsed,setCollapsed]=useState(true);
  const [shareOpen,setShareOpen]=useState(false);
  const [shareUrl,setShareUrl]=useState('');
  const [shareBusy,setShareBusy]=useState(false);
  const [shareCopied,setShareCopied]=useState(false);
  const [shareError,setShareError]=useState('');
  const [shareReviewed,setShareReviewed]=useState(false);
  const [queued,setQueued]=useState<string[]>([]);
  const [hydrated,setHydrated]=useState(false);
  const [retryText,setRetryText]=useState<string|null>(null);
  const [feedbackText,setFeedbackText]=useState('');
  const abort=useRef<AbortController|null>(null);
  const busyRef=useRef(false);
  const epoch=useRef(0);
  const queue=useRef<{text:string;retry:boolean}[]>([]);
  const messagesRef=useRef<Message[]>([welcome]);
  const contextRef=useRef<FanContext>({language:'en'});
  function updateMessages(value:Message[]|((old:Message[])=>Message[])){const next=typeof value==='function'?value(messagesRef.current):value;messagesRef.current=next;setMessages(next);}
  function updateContext(value:FanContext){contextRef.current=value;setContext(value);}
  const bottom=useRef<HTMLDivElement|null>(null);
  const input=useRef<HTMLTextAreaElement|null>(null);
  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x?.messages?.length)updateMessages(x.messages);if(x?.context)updateContext(x.context);if(localStorage.getItem('austin-fc-menu-collapsed')==='false')setCollapsed(false);}catch{}const suggested=new URLSearchParams(window.location.search).get('ask');if(suggested)setDraft(suggested.slice(0,1500));setHydrated(true);},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem(key,JSON.stringify({messages:messages.slice(-30),context}));},[messages,context,hydrated]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,busy]);
  function reset(){epoch.current++;queue.current=[];setQueued([]);busyRef.current=false;abort.current?.abort();setBusy(false);updateMessages([welcome]);updateContext({language:'en'});setDraft('');setRetryText(null);setDrawer(false);setShareOpen(false);setShareUrl('');input.current?.focus();}
  function toggleMenu(){setCollapsed(value=>{localStorage.setItem('austin-fc-menu-collapsed',String(!value));return !value;});}
  async function copyShare(url:string){try{await navigator.clipboard.writeText(url);setShareCopied(true);}catch{setShareCopied(false);}}
  async function createShare(){
    if(!shareReviewed){setShareError('Review the redacted copy and check the box before publishing.');return;}
    const snapshot=messages.filter(m=>m.id!=='welcome'&&!m.error&&m.content.trim()).slice(-24).map(({role,content,sources,cards,actions})=>({role,content,sources:sources?.slice(0,16),cards:cards?.slice(0,12),actions:actions?.slice(0,16)}));
    if(!snapshot.some(m=>m.role==='user')||!snapshot.some(m=>m.role==='assistant')){setShareError('Ask a question and wait for an answer before sharing.');return;}
    setShareBusy(true);setShareError('');setShareCopied(false);
    try{const response=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sanitizeShare({messages:snapshot}))});const result=await response.json();if(!response.ok||!result.path)throw new Error(result.error||'Could not create share link.');const url=new URL(result.path,window.location.origin).href;setShareUrl(url);await copyShare(url);}
    catch(error){setShareError(error instanceof Error?error.message:'Could not create share link.');}
    finally{setShareBusy(false);}
  }
  function send(question?:string,isRetry=false){
    const text=(question??draft).trim();if(!text)return;
    setDraft('');setRetryText(null);setShareReviewed(false);
    if(busyRef.current){queue.current.push({text,retry:isRetry});setQueued(queue.current.map(q=>q.text));return;}
    void processSend(text,isRetry);
  }
  async function processSend(text:string,isRetry=false){
    busyRef.current=true;const generation=epoch.current;
    const history=messagesRef.current.filter(m=>m.id!=='welcome'&&!m.error);
    const conversation=isRetry?history:[...history,{id:crypto.randomUUID(),role:'user' as const,content:text}];
    const id=crypto.randomUUID();updateMessages([welcome,...conversation,{id,role:'assistant',content:''}]);
    setBusy(true);setRetryText(null);setDrawer(false);setShareUrl('');setShareCopied(false);
    const requestContext=contextRef.current;
    const controller=new AbortController();abort.current=controller;
    let timedOut=false;const responseTimeout=setTimeout(()=>{timedOut=true;controller.abort();},60000);
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:conversation.slice(-16).map(({role,content})=>({role,content})),context:requestContext}),signal:controller.signal});
      if(!response.ok||!response.body){const detail=await response.json().catch(()=>({}));throw new Error(detail.error||'Service unavailable');}
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){
        const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});
        const lines=buffer.split('\n');buffer=lines.pop()||'';
        for(const line of lines){if(generation!==epoch.current)return;if(!line)continue;const event=JSON.parse(line);
          if(event.type==='meta'){updateContext(event.context);updateMessages(old=>old.map(m=>m.id===id?{...m,sources:event.sources,cards:event.cards,actions:event.actions,route:event.route}:m));}
          if(event.type==='delta')updateMessages(old=>old.map(m=>m.id===id?{...m,content:m.content+event.text}:m));
          if(event.type==='error')throw new Error(event.message);
        }
      }
    }catch(error){if(generation!==epoch.current)return;updateMessages(old=>old.map(m=>m.id===id?{...m,content:timedOut?(context.language==='es'?'La respuesta tardó demasiado. Inténtalo de nuevo o contacta a Guest Services.':'The response took too long. Retry or contact Guest Services.'):controller.signal.aborted?'Response stopped.':error instanceof Error?error.message:'Something went wrong. Please try again.',error:true,actions:guestActions(context.language==='es')}:m));if(timedOut||!controller.signal.aborted)setRetryText(text);}
    finally{clearTimeout(responseTimeout);if(generation===epoch.current){busyRef.current=false;setBusy(false);abort.current=null;input.current?.focus();const next=queue.current.shift();setQueued(queue.current.map(q=>q.text));if(next)void processSend(next.text,next.retry);}}
  }
  async function rate(id:string,rating:'up'|'down',comment?:string){
    const message=messages.find(m=>m.id===id);if(!message)return;
    updateMessages(old=>old.map(m=>m.id===id?{...m,rating,feedbackOpen:rating==='down'&&comment===undefined}:m));
    if(rating==='down'&&comment===undefined)return;
    try{
      const index=messages.findIndex(m=>m.id===id),question=[...messages.slice(0,index)].reverse().find(m=>m.role==='user')?.content;
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating,comment,route:message.route,question:question?.slice(0,500)})});
      if(!response.ok)throw new Error('Save failed');
      updateMessages(old=>old.map(m=>m.id===id?{...m,feedbackOpen:false,feedbackSaved:true}:m));setFeedbackText('');
    }catch{updateMessages(old=>old.map(m=>m.id===id?{...m,feedbackOpen:true,feedbackSaved:false}:m));}
  }
  return <div className="app">
    <aside className={'sidebar '+(drawer?'open':collapsed?'collapsed':'')}>
      <div className="brand"><div className="brand-icon">AFC</div><div className="brand-copy"><strong>AUSTIN FC</strong><small>FAN ASSISTANT</small></div><button className="desktop-collapse" onClick={toggleMenu} aria-label={collapsed?'Expand menu':'Collapse menu'} title={collapsed?'Expand menu':'Collapse menu'}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button className="mobile menu-close" onClick={()=>setDrawer(false)} aria-label="Close menu"><X size={20}/></button></div>
      <nav><div className="nav-label">YOUR MATCHDAY</div><button className="nav-link selected" onClick={()=>setDrawer(false)} aria-label="Ask the assistant" title="Ask the assistant"><MessageCircle size={17}/><span className="nav-text">Ask the assistant</span></button><a className="nav-link" href="/guide?topic=sources" aria-label="Sources & freshness" title="Sources & freshness"><BookOpen size={17}/><span className="nav-text">Sources & freshness</span></a><a className="nav-link" href="/try" aria-label="Questions to try" title="Questions to try"><CircleHelp size={17}/><span className="nav-text">Questions to try</span></a><div className="nav-divider"/><div className="nav-label">IN-SITE GUIDE</div><a className="nav-link" href="/guide?topic=sections" aria-label="Section guide" title="Section guide"><MapPin size={17}/><span className="nav-text">Section guide</span><ArrowRight className="nav-arrow" size={12}/></a><a className="nav-link" href="/guide?topic=club" aria-label="Match schedule" title="Match schedule"><Ticket size={17}/><span className="nav-text">Match schedule</span><ArrowRight className="nav-arrow" size={12}/></a><a className="nav-link" href="/guide?topic=travel" aria-label="Getting to Q2" title="Getting to Q2"><Train size={17}/><span className="nav-text">Getting to Q2</span><ArrowRight className="nav-arrow" size={12}/></a></nav>
      <div className="sidebar-footer"><div className="context-box"><strong>Your visit</strong><span>{context.section?'Section '+context.section:'Section not set'}</span>{context.dietary&&<span>{context.dietary}</span>}{context.origin&&<span title={context.origin}>From {context.origin}</span>}{context.event&&<span title={context.event.title}>{context.event.title}</span>}<span>{context.language==='es'?'Español':'English'}</span></div><button className="reset" onClick={reset} aria-label="Start over / Reset" title="Start over / Reset"><RotateCcw size={15}/><span className="reset-label">Start over / Reset</span></button><small>Independent demo. Confirm match details with official providers.</small></div>
    </aside>
    {drawer&&<button className="scrim" aria-label="Close menu" onClick={()=>setDrawer(false)}/>}
    <main className="main">
      <header className="topbar"><button className="mobile menu-open" onClick={()=>setDrawer(true)} aria-label="Open menu"><Menu size={21}/></button><div className="top-title"><i/>Austin FC Fan Assistant <span>PREVIEW</span></div><div className="top-actions"><a href="/guide?topic=sources">Our sources <ArrowRight size={15}/></a><button className="share-trigger" onClick={()=>{setShareOpen(value=>!value);setShareReviewed(false);}} aria-expanded={shareOpen} aria-label="Share chat"><Share2 size={16}/><span>Share chat</span></button></div>
      {shareOpen&&<div className="share-panel" role="dialog" aria-label="Share conversation"><div className="share-panel-head"><strong>Share this chat</strong><button onClick={()=>setShareOpen(false)} aria-label="Close share panel"><X size={17}/></button></div><p>Create a read-only copy of this conversation. Anyone with the link can read it. New messages won’t appear in the copy. We remove detected phone numbers, personal emails, street addresses and credentials. Names and other private details may remain—review the copy before sharing.</p><details><summary>Preview the redacted copy</summary><div className="share-preview">{sanitizeShare({messages:messages.filter(m=>m.id!=='welcome'&&!m.error&&m.content.trim()).slice(-24)}).messages.map((m,i)=><p key={i}><strong>{m.role==='user'?'You':'Assistant'}:</strong> {m.content}</p>)}</div></details><label className="share-review"><input type="checkbox" checked={shareReviewed} onChange={e=>setShareReviewed(e.target.checked)}/> I reviewed the copy and understand this is a public link.</label>{shareUrl?<><label htmlFor="share-link">Share link</label><div className="share-link-row"><input id="share-link" readOnly value={shareUrl} onFocus={e=>e.currentTarget.select()}/><button onClick={()=>copyShare(shareUrl)} aria-label="Copy share link">{shareCopied?<Check size={17}/>:<Copy size={17}/>}</button></div><small>{shareCopied?'Link copied.':'Select or copy the link to send it.'}</small><button className="share-create secondary" onClick={createShare} disabled={shareBusy||!shareReviewed}>Create updated copy</button></>:<button className="share-create" onClick={createShare} disabled={shareBusy||busy||!shareReviewed}>{shareBusy?'Creating link…':'Create share link'}</button>}{shareError&&<div className="share-error" role="alert">{shareError}</div>}</div>}</header>
      <div className="scroll"><div className="conversation">
        {messages.length===1&&<div className="hero"><div className="eyebrow">HERE FOR EVERY MATCHDAY</div><h1>Need a hand at <em>Q2?</em></h1><p>From the first train to the final whistle, find the information you need, right when you need it.</p></div>}
        <div className="messages" aria-live="polite">{messages.map(m=><div key={m.id} className={'message '+m.role}><div className="avatar">{m.role==='assistant'?'AF':'YOU'}</div><div className="message-main"><strong>{m.role==='assistant'?'Austin FC Fan Assistant':'You'}</strong><div className={'message-copy '+(m.error?'error':'')}><ReactMarkdown components={{a:({href,children})=><a href={internalGuideHref(href||'')}>{children}</a>}}>{m.content||(busy&&m.id===messages.at(-1)?.id?'Thinking…':'')}</ReactMarkdown></div>
          {!!m.cards?.length&&<div className="cards">{m.cards.slice(0,4).map((c,i)=><a key={i} href={internalGuideHref(c.href,c.title)} className="card"><strong>{c.title}</strong><small>{c.detail}</small><b>View here <ArrowRight size={14}/></b></a>)}</div>}
          {!!m.actions?.length&&<div className="handoffs" aria-label={context.language==='es'?'Acciones y ayuda':'Actions and support'}>{m.actions.filter(a=>isActionHref(a.href)).map((a,i)=><a key={i} href={a.href} target={a.href.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer">{a.label}<ArrowRight size={14}/></a>)}</div>}
          {!!m.sources?.length&&<div className="sources"><span>Sources</span>{m.sources.slice(0,16).map((s,i)=><a key={i} href={internalGuideHref(s.url,s.title)} title={s.checkedAt?'Checked '+new Date(s.checkedAt).toLocaleString():undefined}>{s.title} <ArrowRight size={11}/>{s.checkedAt&&<time>checked {new Date(s.checkedAt).toLocaleDateString()}</time>}</a>)}</div>}
          {m.role==='assistant'&&m.id!=='welcome'&&!busy&&!m.error&&<div className="feedback">Helpful? <button aria-label="Helpful answer" className={m.rating==='up'?'active':''} onClick={()=>rate(m.id,'up')}><ThumbsUp size={15}/></button><button aria-label="Unhelpful answer" className={m.rating==='down'?'active':''} onClick={()=>rate(m.id,'down')}><ThumbsDown size={15}/></button>{m.feedbackSaved&&<span>Saved</span>}</div>}
          {m.feedbackOpen&&<form className="feedback-form" onSubmit={e=>{e.preventDefault();rate(m.id,'down',feedbackText);}}><label htmlFor={'feedback-'+m.id}>What could be better? (optional)</label><textarea id={'feedback-'+m.id} maxLength={700} value={feedbackText} onChange={e=>setFeedbackText(e.target.value)}/><button type="submit">Send feedback</button></form>}
        </div></div>)}</div>
        {messages.length===1&&<div className="suggestions"><div className="nav-label">TRY ASKING</div><div className="suggestion-grid">{suggestions.map(({icon:Icon,label,text})=><button key={label} onClick={()=>send(text)}><Icon size={22}/><strong>{label}</strong><span>{text}</span><ArrowRight className="corner" size={16}/></button>)}</div><a className="all-questions" href="/try">See questions that test the knowledge base and model <ArrowRight size={15}/></a></div>}
        {retryText&&<button className="retry" onClick={()=>send(retryText,true)}><RotateCcw size={15}/>Retry last question</button>}
        <div ref={bottom}/>
      </div></div>
      <div className="composer-wrap"><form className="composer" onSubmit={e=>{e.preventDefault();send();}}><label className="sr-only" htmlFor="chat">Ask a question</label><textarea id="chat" ref={input} placeholder="Ask about food, tickets, parking, weather..." rows={1} maxLength={1500} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e.currentTarget.value);}}}/><button type={busy&&!draft.trim()?'button':'submit'} onClick={busy&&!draft.trim()?()=>abort.current?.abort():undefined} disabled={!busy&&!draft.trim()} aria-label={busy&&!draft.trim()?'Stop answer':busy?'Queue message':'Send message'}>{busy&&!draft.trim()?<Square size={17} fill="currentColor"/>:<Send size={18}/>}</button></form>{busy&&draft.trim()&&<button className="queue-stop" onClick={()=>abort.current?.abort()} aria-label="Stop answer">Stop current answer</button>}{!!queued.length&&<div className="queued-messages" role="status"><strong>{queued.length} message{queued.length===1?'':'s'} queued</strong><ol>{queued.map((text,i)=><li key={i}>{text}</li>)}</ol><button onClick={()=>{queue.current=[];setQueued([]);}}>Clear queue</button></div>}<div className="composer-note">Answers use published sources. Confirm policies, availability, and game times with the official provider.</div></div>
    </main>
  </div>;
}
