/** Content pages exclude the cover that the renderer adds separately. */
export function parseNotebookPageCount(value: unknown): number | undefined {
 if(value===undefined)return undefined;
 if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>80)
  throw Error('Notebook page count must be a whole number from 1 to 80.');
 return value;
}
export function notebookPageCountPrompt(value?:number){
 const count=parseNotebookPageCount(value);
 return count===undefined
  ? 'PAGE COUNT: Automatic. Choose the fewest well-filled, readable content pages that faithfully serve the selected mode. The cover is additional.'
  : `PAGE COUNT: Exactly ${count} content pages in pages[], excluding the cover added by the app. Create a chapter-by-chapter page budget before writing; the allocations must total ${count}. Distribute source-supported explanations, examples and diagrams across that budget. Do not add title-only, filler or blank pages to reach the count. If the selected mode cannot fit this count at readable size, report the conflict and recommend a feasible count before claiming completion; never silently omit material or invent facts. Verify pages.length === ${count} in review.md.`;
}
