import test from 'node:test';
import assert from 'node:assert/strict';
import {assessmentScope,sourceScope} from '../scripts/assessment.js';
import {composeSheet} from '../scripts/core.js';
test('midterm module suggests pre-exam weeks without confirming topics',()=>{
  const scope=assessmentScope({modules:[{title:'WEEK 7 | Mid-Term Test'}],assessmentEvidence:{documents:[{title:'Midterm',text:'Topics covered include planning and exclude probabilistic reasoning.',url:'https://canvas.nus.edu.sg/courses/1/discussion_topics/2'}]}},'midterm');
  assert.equal(scope.status,'suggested-from-modules');assert.equal(scope.range.end,6);assert.equal(scope.range.inferred,true);assert.equal(scope.statements.length,1);
  assert.equal(sourceScope({week:'8'},scope),'outside-weeks');assert.equal(sourceScope({week:''},scope),'unresolved');
  assert.equal(sourceScope({title:'Probabilistic reasoning lecture',week:'4'},scope),'explicitly-excluded');
});
test('final coverage remains unknown without evidence, even with later modules',()=>assert.equal(assessmentScope({modules:[{title:'WEEK 13 | Reinforcement learning'}]},'final').status,'unknown'));
test('explicit exam range and exclusion evidence are distinguished',()=>{
  const scope=assessmentScope({assessmentEvidence:{documents:[{title:'Final exam',text:'The final covers weeks 1-13. Exclude weeks 2-3.'}]}},'final');assert.equal(scope.range.end,13);assert.equal(scope.statements.length,2);
  assert.equal(assessmentScope({assessmentEvidence:{documents:[{title:'Final exam',text:'The final excludes weeks 1-4.'}]}},'final').range,null);
});
test('non-assessment titles and contradictory boundaries cannot establish scope',()=>{
  assert.equal(assessmentScope({modules:[{title:'WEEK 7 | Midterm'},{title:'WEEK 8 | Midterm make-up'}]},'midterm').range,null);
  assert.equal(assessmentScope({},'selected'),null);
  assert.equal(assessmentScope({modules:[{title:'WEEK 2 | Midterm past papers'}]},'midterm').range,null);
});
test('a later explicit inclusion overrides an earlier matching exclusion',()=>{
  const scope=assessmentScope({assessmentEvidence:{documents:[{title:'Midterm',text:'Exclude planning.',postedAt:'2026-09-01'},{title:'Midterm update',text:'Topics include planning.',postedAt:'2026-09-23'}]}},'midterm');assert.equal(scope.exclusions.length,0);assert.equal(scope.inclusions[0].topic,'planning');
});
test('composition balances materials and prioritizes reusable methods over worked examples',()=>{
  const atom=(id,sourceId,title,priority)=>({id,sourceId,title,summary:title,details:[],references:[],kind:'algorithm',priority});
  const points=[atom('a1','a','Worked example',3),atom('a2','a','General method',2),atom('a3','a','Another method',2),atom('b1','b','Core rule',2),atom('b2','b','Another rule',2)];
  const sheet=composeSheet({id:'course',name:'Example'},[{id:'a',title:'Long lecture'},{id:'b',title:'Short lecture'}],points,{blockLimit:4});
  assert.equal(sheet.blocks.filter(b=>b.sourceId==='a').length,2);assert.equal(sheet.blocks.filter(b=>b.sourceId==='b').length,2);assert.ok(!sheet.blocks.some(b=>b.id==='a1'));
});
