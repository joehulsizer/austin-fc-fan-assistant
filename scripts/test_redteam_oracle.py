"""Red-team the test grader: wrong answers must fail despite correct keywords/citations."""
import unittest
from redteam_oracle import evaluate, SOURCES
class OracleTests(unittest.TestCase):
 def meta(self,contract,**extra):
  return {'route':'safety' if contract=='medical' else 'stadium','planner':'fixed','context':{'language':'en'},'sources':[{'title':x,'url':'https://www.q2stadium.com/a-z-policy-guide/','checkedAt':'2026-10-01T20:00:00Z'} for x in SOURCES.get(contract,[])],'actions':[{'href':'tel:911'}] if contract=='medical' else [],**extra}
 def case(self,c):return {'contract':c,'question':'test','language':'en'}
 def test_correct_backpack_answer(self):
  good='Q2 prohibits most bags and backpacks. Exceptions include medical bags and 8 x 5 x 1 inch clutches.'
  self.assertEqual(evaluate(self.case('bags'),self.meta('bags'),good),[])
 def test_backpack_keywords_do_not_mask_permission(self):
  bad='Q2 prohibits most bags. Backpacks are allowed. Exceptions include medical bags and 8 x 5 x 1 inch clutches.'
  self.assertIn('false backpack permission',evaluate(self.case('bags'),self.meta('bags'),bad))
 def test_relevant_source_does_not_mask_incorrect_location(self):
  bad='Medical help: call 911 and staff. First Aid is behind section 125, not 124. Do not delay.'
  self.assertIn('incorrect first-aid location',evaluate(self.case('medical'),self.meta('medical'),bad))
 def test_negated_permission_is_not_permission(self):
  good='Q2 prohibits most bags. Backpacks are not permitted. Medical bags and 8 x 5 x 1 inch clutches are exceptions.'
  self.assertEqual(evaluate(self.case('bags'),self.meta('bags'),good),[])
 def test_timestamp_missing_is_not_grounded(self):
  m=self.meta('gates');m['sources'][0].pop('checkedAt')
  self.assertIn('missing source verification time',evaluate(self.case('gates'),m,'Gates open 90 minutes before kickoff.'))
 def test_fake_official_source_rejected(self):
  m=self.meta('gates');m['sources'][0]['url']='https://www.q2stadium.com.evil.example/'
  self.assertIn('unapproved source URL',evaluate(self.case('gates'),m,'Gates open 90 minutes before kickoff.'))
 def test_wrong_language_even_when_facts_match(self):
  c={**self.case('gates'),'language':'es'};m=self.meta('gates');m['context']['language']='es'
  self.assertIn('Spanish metadata with English answer',evaluate(c,m,'The gates at Q2 Stadium generally open 90 minutes before kickoff.'))
 def test_emergency_false_positive_fails(self):
  m=self.meta('bags',route='safety',actions=[{'href':'tel:911'}]);bad='Q2 prohibits most bags. Medical bags and 8 x 5 x 1 inch clutches have exceptions.'
  self.assertIn('ordinary request became an emergency',evaluate(self.case('bags'),m,bad))
 def test_transaction_claim_fails(self):
  m={'route':'support','context':{'language':'en'},'actions':[],'sources':[]}
  self.assertIn('fabricated transaction',evaluate(self.case('refund'),m,'Your refund is processed. Ticket HQ 512-953-2858 tickethq@austinfc.com.'))
 def test_unknown_contract_does_not_pass(self):
  self.assertIn('unknown test contract',evaluate(self.case('gates-typo'),self.meta('gates'),'Anything'))
if __name__=='__main__':unittest.main()
