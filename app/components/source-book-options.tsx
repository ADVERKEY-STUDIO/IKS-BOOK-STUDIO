"use client";
import { imageEnhancements, normalizeSourceBookOptions, sourceImageModes, sourceImageStyles, type SourceBookOptions as Options } from "../../lib/source-book-options";

type Props = { value?: Options; onChange: (value: Options) => void; chapters?: {id:number;title:string}[] };
export function SourceBookOptions({ value, onChange, chapters = [] }: Props) {
  const options = normalizeSourceBookOptions(value);
  const patch = (next: Partial<Options>) => onChange({...options,...next});
  const needsCustom = options.imageStyle === "custom" || Object.values(options.chapterStyles).includes("custom");
  return <section className="source-book-options form-card">
    <p className="eyebrow">SOURCE IMAGES & SANSKRIT</p><h2>Choose what to carry into your book</h2>
    <p className="source-options-note">These preferences are saved with your book. Source-image processing and Sanskrit prompt support will become available in the next phase.</p>
    <div className="source-options-grid">
      <fieldset><legend>Illustrations</legend>
        <label>Image source<select aria-label="Image source" value={options.imageMode} onChange={e=>patch({imageMode:e.target.value as Options["imageMode"]})}>{sourceImageModes.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <label>Source image enhancement<select aria-label="Source image enhancement" disabled={options.imageMode === "generate"} value={options.enhancement} onChange={e=>patch({enhancement:e.target.value as Options["enhancement"]})}>{imageEnhancements.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <p>Cleaning keeps labels, symbols and factual details intact. Restyling is a separate choice for selected images.</p>
        <label>Illustration style<select aria-label="Illustration style" value={options.imageStyle} onChange={e=>patch({imageStyle:e.target.value as Options["imageStyle"]})}>{sourceImageStyles.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <p>The style applies to new or deliberately restyled artwork. Originals stay unchanged when you choose to keep them.</p>
        {chapters.length>0 && <details><summary>Style exceptions by chapter</summary>{chapters.map(chapter=><label key={chapter.id}>{chapter.title}<select aria-label={`Illustration style for ${chapter.title}`} value={options.chapterStyles[String(chapter.id)] ?? "book"} onChange={e=>{const chapterStyles={...options.chapterStyles};if(e.target.value==="book")delete chapterStyles[String(chapter.id)];else chapterStyles[String(chapter.id)]=e.target.value as Options["chapterStyles"][string];patch({chapterStyles});}}><option value="book">Follow the whole-book choice</option>{sourceImageStyles.filter(o=>o.value!=="book").map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}</details>}
        {needsCustom && <label>Describe your custom style<textarea aria-label="Describe your custom style" maxLength={600} rows={3} value={options.customStyle} onChange={e=>patch({customStyle:e.target.value})} placeholder="For example: soft earth colours, fine ink outlines and gentle paper texture"/><small>{options.customStyle.length}/600 characters</small></label>}
      </fieldset>
      <fieldset><legend>Sanskrit ślokas</legend>
        <label className="source-option-check"><input type="checkbox" checked={options.preserveSlokas} onChange={e=>patch({preserveSlokas:e.target.checked})}/>Preserve Sanskrit ślokas from the source</label>
        <p>Keep the source verse, verse number and attribution. Unclear words must be flagged for review.</p>
        <fieldset disabled={!options.preserveSlokas}><legend>Alongside each verse</legend>
          <label className="source-option-check"><input type="checkbox" checked={options.transliteration} onChange={e=>patch({transliteration:e.target.checked})}/>Roman transliteration</label>
          <label className="source-option-check"><input type="checkbox" checked={options.translation} onChange={e=>patch({translation:e.target.checked})}/>Translation in the book’s language</label>
          <label className="source-option-check"><input type="checkbox" checked={options.explanation} onChange={e=>patch({explanation:e.target.checked})}/>Age-appropriate explanation</label>
        </fieldset>
      </fieldset>
    </div>
  </section>;
}

export function SourceBookOptionsReview({value}:{value?:Options}) {
  const o=normalizeSourceBookOptions(value);
  return <section className="source-book-options-review brief-review" aria-label="Source image and Sanskrit choices">
    <div><span>IMAGE SOURCE</span><strong>{sourceImageModes.find(c=>c.value===o.imageMode)?.label}</strong></div>
    {o.imageMode!=="generate" && <div><span>ENHANCEMENT</span><strong>{imageEnhancements.find(c=>c.value===o.enhancement)?.label}</strong></div>}
    <div><span>ILLUSTRATION STYLE</span><strong>{sourceImageStyles.find(c=>c.value===o.imageStyle)?.label}{o.imageStyle==="custom" ? `: ${o.customStyle || "Description pending"}` : ""}</strong></div>
    <div><span>SANSKRIT ŚLOKAS</span><strong>{o.preserveSlokas ? `Preserve source verses${o.transliteration ? " · transliteration" : ""}${o.translation ? " · translation" : ""}${o.explanation ? " · explanation" : ""}` : "No verse-preservation request"}</strong></div>
  </section>;
}
