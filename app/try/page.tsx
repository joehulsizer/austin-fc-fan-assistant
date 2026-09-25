import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import '../guide/guide.css';

const groups = [
  { title: 'Knowledge base', description: 'These are answered from checked stadium facts and set rules, without generating text with a model.', questions: [
    'I’m in section 123. Where can I get vegan food?',
    'What about drinks? (ask after the vegan question)',
    'Can I bring a diaper bag?',
    'How do I transfer my ticket?',
    'How do I get to the stadium by train?',
    'When is the next Austin FC home match?',
    '¿Dónde puedo encontrar comida vegetariana?',
  ] },
  { title: 'Model assisted', description: 'The site sends the question and relevant published facts to OpenAI’s GPT-5.4 mini model for a flexible answer. This is a separate service, not this Codex chat.', questions: [
    'What should I do if I lose something at Q2 Stadium?',
    'What are the camera rules at Q2?',
    'Where is an accessible restroom?',
    'What time do gates open?',
    'When is the next Austin FC match? (live official-site search)',
  ] },
  { title: 'Live weather', description: 'Weather comes directly from the National Weather Service. Ask about a specific kickoff after choosing a match.', questions: [
    'Will it rain at kickoff? (ask after the home-match question)',
    'What is the weather at Q2 Stadium right now?',
  ] },
];

export default function TryPage() {
  return <main className="guide-page"><div className="guide-wrap">
    <header className="guide-header"><Link href="/"><ArrowLeft size={16}/> Back to chat</Link><Link href="/guide?topic=sources">In-site sources <ArrowRight size={15}/></Link></header>
    <div className="guide-kicker">TEST THE LIVE ASSISTANT</div><h1>Questions to try</h1>
    <p className="guide-intro">These questions show what the assistant can answer and where the answer comes from. Tap one to put it in the chat box. For follow-ups, ask the first question in that group before trying the second.</p>
    {groups.map(group => <section key={group.title}><h2 className="guide-subhead">{group.title}</h2><p className="guide-intro">{group.description}</p><div className="guide-grid guide-grid-two">{group.questions.map(question => {
      const clean = question.replace(/ \(.*\)$/, '');
      return <Link className="guide-card guide-source-card" key={question} href={`/?ask=${encodeURIComponent(clean)}`}><h2>{question}</h2><small>Use in chat <ArrowRight size={13}/></small></Link>;
    })}</div></section>)}
    <div className="guide-callout" style={{ marginTop: 32 }}>A model API call means the website’s server sends text to a hosted model and receives its answer. It does not call your Codex desktop session or use your Mac to answer fans.</div>
  </div></main>;
}
