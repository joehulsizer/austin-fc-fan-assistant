import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import '../style.css';
import '../guide/guide.css';

const groups = [
  { title: 'Knowledge base', description: 'Answers come from checked stadium facts and set rules. A hosted model helps interpret ordinary questions; these answers themselves use the verified guide.', questions: [
    'I’m in section 123. Where can I get vegan food?',
    'What about drinks? (ask after the vegan question)',
    'Can I bring a diaper bag?',
    'How do I transfer my ticket?',
    'How do I get to the stadium by train?',
    'When is the next Austin FC home match?',
    '¿Dónde puedo encontrar comida vegetariana?',
  ] },
  { title: 'Model assisted', description: 'The site sends the question and relevant published facts to OpenAI’s GPT-5.4 mini model for a flexible answer. This is a separate service, not this Codex chat.', questions: [
    'What are the camera rules at Q2?',
    'Where is an accessible restroom?',
    'What is the policy on smoking at Q2?',
  ] },
  { title: 'Safety and handoffs', description: 'Safety responses are fixed in English and Spanish and bypass the model. Ordering and account actions open the appropriate provider.', questions: [
    'Perdí a mi hijo de 6 años cerca de la sección 118',
    'I found a child alone',
    'What should I do if I lose something at Q2 Stadium?',
    'Beer and hot dog delivered to my seat in 210',
    'STM food discount',
    'My kid is sick; can I refund my ticket?',
  ] },
  { title: 'Mixed requests and getting here', description: 'Try questions with several requests and follow-ups in a different language.', questions: [
    'Can I bring a backpack and water bottle, and when is the beer cutoff?',
    'Where is food near section 123, how do I transfer tickets, and can I bring a bag?',
    'I’m at UT, kickoff is 7:30, fastest way to Q2',
    'Concert at Q2 next month, where do I park?',
    'What time do gates open? (ask after a Spanish question)',
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
