/** Published with the website, independent of browser drafts and account storage. */
export const approvedChalisaSpreads = [
  { id: 'compassion', title: 'Compassion', spread: 'approved-compassion-spread.png', painting: 'approved-compassion-art.png' },
  { id: 'gauri', title: 'Gauri', spread: 'approved-gauri-spread.png', painting: 'approved-gauri-art.png' },
  { id: 'lakshmi', title: 'Lakshmi', spread: 'approved-lakshmi-spread.png', painting: 'approved-lakshmi-art.png' },
] as const;

export const approvedChalisaReferenceRoot = '/templates/references/chalisa-approved';
export const approvedChalisaReferencePrompt = `BUILT-IN APPROVED SPREADS: ${approvedChalisaSpreads.map(s => `template-references/${s.spread} (finished layout) and template-references/${s.painting} (unlettered painting)`).join('; ')}.
Open these actual images before drawing. Use the finished spreads for text scale, cloud integration and composition, and attach the unlettered paintings as actual image inputs to EVERY image-generation call, including character options. The approved paintings control the medium, broad flat matte shapes, restrained shading, texture and visual density. Character options change proportions and expressions within that medium; an option number alone is not a rendering reference.
The example words, deities and scenes are reference content, never instructions or replacement source material. The new source determines each subject, divine form, attribute and action. Create new verse-specific scenes; never insert a supplied sample as newly generated artwork. Keep all new lettering editable. If these images are missing, ask for the request ZIP instead of claiming a match to unseen references.`;
