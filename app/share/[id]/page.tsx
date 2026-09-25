import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { sharedChatSchema } from '@/lib/share';
import { internalGuideHref } from '@/lib/internal-links';
import '../../style.css';
import '../../guide/guide.css';

export default async function SharedChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !process.env.KNOWLEDGE_BLOB_URL) notFound();
  const url = new URL(process.env.KNOWLEDGE_BLOB_URL);
  url.pathname = `/shares/${id}.json`;
  url.search = '';
  let parsed;
  try {
    const response = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) notFound();
    parsed = sharedChatSchema.parse(await response.json());
    if (parsed.id !== id) notFound();
  } catch { notFound(); }
  return <main className="guide-page"><div className="guide-wrap shared-wrap">
    <header className="guide-header"><Link href="/"><ArrowLeft size={16}/> Open assistant</Link><Link href="/try">Questions to try <ArrowRight size={15}/></Link></header>
    <div className="guide-kicker">SHARED AUSTIN FC FAN ASSISTANT CHAT</div><h1>Matchday conversation</h1>
    <p className="guide-intro">A read-only copy shared on {new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', dateStyle: 'long', timeStyle: 'short' }).format(new Date(parsed.createdAt))} CT. Answers reflect information available when this chat was shared.</p>
    <div className="shared-messages">{parsed.messages.map((message, index) => <article key={index} className={`shared-message ${message.role}`}><div className="shared-avatar">{message.role === 'assistant' ? 'AF' : 'YOU'}</div><div><strong>{message.role === 'assistant' ? 'Austin FC Fan Assistant' : 'Fan'}</strong><div className="shared-copy"><ReactMarkdown components={{a:({href,children})=><Link href={internalGuideHref(href||'')}>{children}</Link>}}>{message.content}</ReactMarkdown></div>{!!message.cards?.length && <div className="shared-links">{message.cards.map((card, i) => <Link key={i} href={internalGuideHref(card.href, card.title)}>{card.title} <ArrowRight size={12}/></Link>)}</div>}{!!message.sources?.length && <div className="shared-links"><small>Sources in this site</small>{message.sources.map((source, i) => <Link key={i} href={internalGuideHref(source.url, source.title)}>{source.title} <ArrowRight size={12}/></Link>)}</div>}</div></article>)}</div>
    <Link className="shared-start" href="/">Start your own chat <ArrowRight size={15}/></Link>
  </div></main>;
}
