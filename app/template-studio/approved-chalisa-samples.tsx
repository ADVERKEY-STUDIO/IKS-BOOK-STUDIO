import { approvedChalisaSpreads, approvedChalisaReferenceRoot } from '../../lib/chalisa-approved-references';

export default function ApprovedChalisaSamples() {
  return <details className="ts-panel">
    <summary>Approved illustration style · 3 built-in spreads</summary>
    <p>These approved spreads and their unlettered paintings are stored with the website and included automatically in every Chalisa request ZIP. You do not need to upload them again.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      {approvedChalisaSpreads.map(sample => <figure key={sample.id} style={{ margin: 0 }}>
        <a href={`${approvedChalisaReferenceRoot}/${sample.spread}`} target="_blank" rel="noreferrer">
          <img src={`${approvedChalisaReferenceRoot}/${sample.spread}`} alt={`Approved ${sample.title} spread with cloud-backed text`} loading="lazy" style={{ width: '100%', display: 'block' }} />
        </a>
        <figcaption>{sample.title} · <a href={`${approvedChalisaReferenceRoot}/${sample.painting}`} target="_blank" rel="noreferrer">View unlettered artwork</a></figcaption>
      </figure>)}
    </div>
    <p>The samples guide the illustration style. Your uploaded source supplies the new book’s text and scenes. Download the request ZIP and attach it in ChatGPT so the images accompany your prompt.</p>
  </details>;
}
