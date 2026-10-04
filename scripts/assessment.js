// Evidence stays local. Module order suggests coverage; it never proves an exam syllabus.
export const examKind = text => /mid[\s-]?term/i.test(text) ? 'midterm' : /final(?:\s+exam|\s+assessment|\s+test|s)?/i.test(text) ? 'final' : '';
export function assessmentScope(course, target) {
  if (!['midterm','final'].includes(target)) return null;
  const documents = (course.assessmentEvidence?.documents || []).filter(d => (examKind(d.title) || examKind(d.text)) === target).sort((a,b)=>(b.postedAt||'').localeCompare(a.postedAt||''));
  const statements = documents.flatMap(d => String(d.text).split(/\n|(?<=[.!?])\s+(?=[A-Z])/).map(text => text.trim()).filter(text => text && /cover|includ|exclud|examin|scope|open.book|closed.book|duration|permitted|cheat.?sheet/i.test(text)).map(text => ({ text, title:d.title, url:d.url, postedAt:d.postedAt || '' }))).slice(0,40);
  const explicitRanges = statements.filter(s=>!/exclud|not\s+(?:cover|examin)|out\s+of\s+scope/i.test(s.text)).flatMap(s => [...s.text.matchAll(/weeks?\s+(\d+)\s*(?:to|through|[-–])\s*(\d+)/gi)].map(m => ({start:Number(m[1]),end:Number(m[2]),evidence:s}))).filter(r => r.start>0 && r.end>=r.start && r.end<=60);
  const normalize=text=>String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const exclusions=statements.flatMap(s=>{
    const named=s.text.match(/\bexclud(?:e|es|ed|ing)\s+([^.!?]+)/i)?.[1];
    const before=s.text.match(/^(.+?)(?:\s*\([^)]*\))?\s+(?:will\s+)?not\s+be\s+examin(?:ed|able)/i)?.[1];
    return [named,before].filter(Boolean).map(text=>({topic:normalize(text),evidence:s}));
  }).filter(e=>e.topic.length>=4 && !/^(?:week|question|chapter|section|all)\b/.test(e.topic));
  const inclusions=statements.flatMap(s=>{const topic=s.text.match(/\binclud(?:e|es|ed|ing)\s+(.+?)(?:\s+and\s+exclud|\s+which\b|[.!?]|$)/i)?.[1];return topic?[{topic:normalize(topic),evidence:s}]:[];});
  const activeExclusions=exclusions.filter(e=>!inclusions.some(i=>i.topic===e.topic && i.evidence.postedAt>=e.evidence.postedAt));
  const boundaries = (course.modules || []).filter(m => examKind(m.title)===target && !/past\s+paper|sample|practice|revision/i.test(m.title)).map(m=>Number(m.title.match(/week\s*(\d+)/i)?.[1])).filter(Number.isFinite);
  const range = explicitRanges[0] || (target==='midterm' && boundaries.length===1 && boundaries[0]>1 ? {start:1,end:boundaries[0]-1,inferred:true} : null);
  return {target, statements, inclusions, exclusions:activeExclusions, range, status:explicitRanges.length ? 'explicit-week-range' : range ? 'suggested-from-modules' : statements.length ? 'topic-guidance-only' : 'unknown', message:target==='final' && !explicitRanges.length ? 'Final coverage is not confirmed. Later weeks do not establish whether the final is cumulative. Review Canvas guidance and choose materials.' : range?.inferred ? 'Pre-midterm weeks are a suggestion. Apply the instructor’s inclusions/exclusions and review every selected material.' : 'Review the Canvas evidence and selected materials before generating.'};
}
export function sourceScope(source, scope) {
  if (!scope) return 'selected';
  const title=String(source.title+' '+(source.topic||'')).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  if(scope.exclusions?.some(e=>title.includes(e.topic)))return 'explicitly-excluded';
  const week = /^\d+$/.test(String(source.week)) ? Number(source.week) : NaN;
  if (!scope.range || !Number.isFinite(week)) return 'unresolved';
  return week>=scope.range.start && week<=scope.range.end ? 'candidate' : 'outside-weeks';
}
