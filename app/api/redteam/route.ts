import { POST as chat } from '../chat/route';
import { withEvaluationBudget } from '@/lib/limits';
export const maxDuration=120;
/** Same production handler and providers, with separate enforced test spending.
 * The fan endpoint never accepts fault-injection headers or an alternate budget.
 */
export async function POST(request:Request){
  if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:'Unauthorized'},{status:401});
  return withEvaluationBudget(request.headers.get('x-redteam-provider-outage')==='ai-and-routing',()=>chat(request));
}
