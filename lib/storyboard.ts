import type { Edition, PassageField } from './devotional-edition.ts';

export const compositionFamilies = ['Quiet verse', 'Image and commentary', 'Vignettes', 'Close detail', 'Panorama', 'Narrative sequence'] as const;
export const pageKinds = ['spread', 'single', 'cover'] as const;
export type Allocation = { passageId: string; fields: PassageField[]; start: number; end: number; ranges?: Partial<Record<PassageField, { start: number; end: number }>> };
export type SpreadPlan = {
  id: string; revision: number; artGuideVersion?: number; title: string; kind: typeof pageKinds[number];
  family: typeof compositionFamilies[number]; allocations: Allocation[];
  purpose: string; tone: string; concept: string; composition: string;
  textArea: string; textBudget: number; before: string; after: string;
  approvedContext?: string;
};
export type StoryboardAction =
  | { type: 'save-spread'; plan: SpreadPlan }
  | { type: 'delete-spread'; id: string }
  | { type: 'reorder-spreads'; ids: string[] }
  | { type: 'approve-spread'; id: string };
export type PageAssignment = { id: string; pages: number[]; blankBefore?: number };
export function blankSpread(): SpreadPlan {
  return { id: '', revision: 0, title: '', kind: 'spread', family: 'Quiet verse', allocations: [], purpose: '', tone: '', concept: '', composition: '', textArea: '', textBudget: 1200, before: '', after: '' };
}
/** Interior page 1 is a recto. Insert an explicit blank before a facing pair when needed. */
export function storyboardPages(plans: SpreadPlan[]): PageAssignment[] {
  let page = 1;
  return plans.map(plan => {
    if (plan.kind === 'cover') return { id: plan.id, pages: [] };
    const blankBefore = plan.kind === 'spread' && page % 2 === 1 ? page++ : undefined;
    const pages = plan.kind === 'spread' ? [page++, page++] : [page++];
    return { id: plan.id, pages, blankBefore };
  });
}
function context(edition: Edition, plan: SpreadPlan): string {
  return JSON.stringify({ metadata: edition.metadata, guide: edition.artDirection, references: edition.visualReferences?.map(r => [r.id, r.approvedVersion, r.archived]),
    source: plan.allocations.map(a => edition.passages.find(p => p.id === a.passageId)),
    order: (edition.storyboard || []).map(p => [p.id, p.kind]) });
}
export function spreadStatus(edition: Edition, plan: SpreadPlan): string {
  return !plan.approvedContext ? 'Draft plan' : plan.approvedContext === context(edition, plan) ? 'Approved plan' : 'Needs review';
}
export function storyboardIssues(edition: Edition): { target: string; message: string; blocking: boolean }[] {
  const plans = edition.storyboard || [], issues: { target: string; message: string; blocking: boolean }[] = [];
  for (const passage of edition.passages.filter(p => !p.retired)) {
    const ranges = plans.flatMap(plan => plan.allocations.filter(a => a.passageId === passage.id && a.fields.includes('original')).map(a => ({ ...a, target: plan.id }))).sort((a,b) => a.start-b.start);
    for (const field of ['transliteration','translation','commentary'] as const) {
      const ranges = plans.flatMap(plan=>plan.allocations.filter(a=>a.passageId===passage.id && a.fields.includes(field)).map(a=>({target:plan.id,...(a.ranges?.[field] || {start:0,end:passage.fields[field].text.length})}))).sort((a,b)=>a.start-b.start);
      let covered=0;
      for (const range of ranges) {
        if(range.start<covered) issues.push({target:range.target,message:`Duplicate ${field} allocation for ${passage.location || passage.id}.`,blocking:true});
        if(range.start>covered) issues.push({target:range.target,message:`Missing ${field} text before character ${range.start}.`,blocking:true});
        covered=Math.max(covered,range.end);
      }
      if(ranges.length && covered<passage.fields[field].text.length) issues.push({target:ranges.at(-1)!.target,message:`Unallocated ${field} continuation after character ${covered}.`,blocking:true});
    }
    let end = 0;
    for (const range of ranges) {
      if (range.start > end) issues.push({target: passage.id, message: `Missing original text at characters ${end+1}–${range.start}.`, blocking:true});
      if (range.start < end) issues.push({target: range.target, message: `Duplicate original allocation for ${passage.location || passage.id}.`, blocking:true});
      end = Math.max(end,range.end);
    }
    if (end < passage.fields.original.text.length) issues.push({target: passage.id, message:`Unallocated original text: characters ${end+1}–${passage.fields.original.text.length}.`,blocking:true});
  }
  plans.forEach((plan,index) => {
    let count = 0;
    for (const a of plan.allocations) {
      const p = edition.passages.find(p => p.id === a.passageId && !p.retired);
      if (!p || a.end > p.fields.original.text.length) { issues.push({target:plan.id,message:'A source passage changed or was retired. Reassign its content.',blocking:true}); continue; }
      for (const f of a.fields) {
        const range=f==='original'?a:a.ranges?.[f] || {start:0,end:p.fields[f].text.length};
        if(range.end>p.fields[f].text.length) issues.push({target:plan.id,message:`The ${f} text changed. Review its range.`,blocking:true});
        count+=range.end-range.start;
      }
      if (a.fields.some(f => p.fields[f].status !== 'approved' || !p.fields[f].text.trim())) issues.push({target:plan.id,message:'Allocated text needs source approval or is empty.',blocking:true});
    }
    if (count > plan.textBudget) issues.push({target:plan.id,message:`${count} characters exceed the ${plan.textBudget}-character planning budget. Add space or continue the passage on another spread.`,blocking:false});
    if (index > 1 && plans[index-1].family===plan.family && plans[index-2].family===plan.family) issues.push({target:plan.id,message:'Three consecutive compositions use the same family. Review whether this rhythm serves the text.',blocking:false});
  });
  return issues;
}
export function applyStoryboardAction(edition: Edition, action: StoryboardAction, makeId: () => string): void {
  const plans = edition.storyboard ||= [];
  const previousIds = plans.map(p=>p.id);
  if (action.type === 'save-spread') {
    const plan = structuredClone(action.plan);
    if (!plan || !pageKinds.includes(plan.kind) || !compositionFamilies.includes(plan.family)) throw new Error('Choose a valid page kind and composition family.');
    for (const key of ['title','purpose','tone','concept','composition','textArea','before','after'] as const) if (typeof plan[key] !== 'string' || plan[key].length > 4000) throw new Error('Plan notes must be text of at most 4,000 characters.');
    if (!plan.title.trim()) throw new Error('Give this plan a title.');
    if (!Number.isInteger(plan.textBudget) || plan.textBudget < 1 || plan.textBudget > 50000) throw new Error('Use a text budget between 1 and 50,000 characters.');
    if (!Array.isArray(plan.allocations) || plan.allocations.length > 2000) throw new Error('Invalid passage allocations.');
    for (const a of plan.allocations) {
      const p = edition.passages.find(p => p.id === a.passageId && !p.retired);
      if (!p || !Array.isArray(a.fields) || !a.fields.length || new Set(a.fields).size!==a.fields.length || a.fields.some(f => !['original','transliteration','translation','commentary'].includes(f))) throw new Error('Choose active passages and valid public text fields.');
      const text = p.fields.original.text;
      if (!Number.isInteger(a.start) || !Number.isInteger(a.end) || a.start<0 || a.end<=a.start || a.end>text.length || /[\uD800-\uDBFF]/.test(text[a.start-1]||'') || /[\uD800-\uDBFF]/.test(text[a.end-1]||'')) throw new Error('Choose a valid original-text range between complete characters.');
      if(a.ranges && (typeof a.ranges!=='object' || Object.keys(a.ranges).some(f=>!['transliteration','translation','commentary'].includes(f)))) throw new Error('Invalid supplementary text ranges.');
      for(const f of ['transliteration','translation','commentary'] as const) {
        const range=a.ranges?.[f];if(!range)continue;const value=p.fields[f].text;
        if(!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<0||range.end<=range.start||range.end>value.length||/[\uD800-\uDBFF]/.test(value[range.start-1]||'')||/[\uD800-\uDBFF]/.test(value[range.end-1]||'')) throw new Error('Choose a valid supplementary text range.');
      }
    }
    const old = plans.find(p => p.id===plan.id);
    if (plan.id && !old) throw new Error('This plan no longer exists.');
    if (!old && plans.length>=500) throw new Error('This book has reached 500 plans.');
    const saved: SpreadPlan = { ...blankSpread(), ...Object.fromEntries(['title','kind','family','allocations','purpose','tone','concept','composition','textArea','textBudget','before','after'].map(k=>[k,plan[k as keyof SpreadPlan]])), id:old?.id || makeId(), revision:(old?.revision||0)+1, artGuideVersion:edition.artDirection?.versions.at(-1)?.version || 0 };
    if (old) plans[plans.indexOf(old)] = saved; else plans.push(saved);
  } else if (action.type === 'delete-spread') {
    const index = plans.findIndex(p=>p.id===action.id); if(index<0) throw new Error('Plan no longer exists.'); plans.splice(index,1);
  } else if (action.type === 'reorder-spreads') {
    if (!Array.isArray(action.ids) || action.ids.length!==plans.length || new Set(action.ids).size!==plans.length || action.ids.some(id=>!plans.some(p=>p.id===id))) throw new Error('Reorder must contain every plan exactly once.');
    edition.storyboard = action.ids.map(id=>plans.find(p=>p.id===id)!);
  } else {
    const plan = plans.find(p=>p.id===action.id); if(!plan) throw new Error('Plan no longer exists.');
    if (!plan.purpose.trim() || !plan.concept.trim() || !plan.textArea.trim()) throw new Error('Describe the reading purpose, visual concept, and reserved text area before approval.');
    if (storyboardIssues(edition).some(i=>i.blocking)) throw new Error('Resolve missing, duplicated, or unapproved content before approving plans.');
    plan.approvedContext = context(edition,plan);
  }
  const ids = new Set([...previousIds, ...plans.map(p=>p.id), ...(edition.storyboard||[]).map(p=>p.id)]);
  edition.artGuideUsage = (edition.artGuideUsage || []).filter(u=>!ids.has(u.targetId));
  for (const plan of edition.storyboard || []) edition.artGuideUsage.push({targetId:plan.id, version:plan.artGuideVersion || 0});
  edition.bindings = edition.bindings.filter(b=>!ids.has(b.targetId));
  for (const plan of edition.storyboard || []) for (const a of plan.allocations) edition.bindings.push({targetId:plan.id,passageId:a.passageId});
}
