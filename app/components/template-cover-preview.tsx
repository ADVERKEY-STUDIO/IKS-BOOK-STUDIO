import { literaryCover, literaryCss, literaryTemplates } from '../../lib/literary-templates';

// Use the same cover markup and appearance as the existing template studio.
const covers = literaryTemplates.filter(template => template.id === 'wild' || template.id === 'echo').map(template => ({
  ...template,
  html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
  .cover{display:flex;flex-direction:column;background:${template.paper};color:${template.ink};height:100%;width:100%!important}
  ${literaryCss()}
  </style></head><body>${literaryCover(template.id, template.sampleTitle, 'Essays on attention & everyday wisdom', template.demo)}</body></html>`,
}));

export default function TemplateCoverPreview() {
  return <div className="home-template-preview" aria-label="Examples from the template collection">
    {covers.map(template => <figure key={template.id} className={`home-template-cover home-template-cover-${template.id}`}>
      <iframe title={`${template.name} cover preview`} srcDoc={template.html} sandbox="allow-same-origin" tabIndex={-1} />
      <figcaption>{template.name}</figcaption>
    </figure>)}
  </div>;
}
