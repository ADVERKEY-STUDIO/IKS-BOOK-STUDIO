import { childrenTemplates } from '../lib/children-templates.ts';
/** Only catalogued public reference images are fetchable; never accepts arbitrary URLs. */
export async function templateReferenceApi(request: Request, fetchImage: typeof fetch = fetch) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const params = new URL(request.url).searchParams;
  const template = childrenTemplates.find(t => t.id === params.get('template'));
  const index = Number(params.get('index'));
  if (!template || !Number.isInteger(index) || index < 0 || index >= template.images.length) return new Response('Unknown reference', { status: 404 });
  try {
    const upstream = await fetchImage(template.images[index], { redirect: 'error', signal: AbortSignal.timeout(15000) });
    const type = upstream.headers.get('content-type')?.split(';')[0];
    if (!upstream.ok || !type || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw Error('Unavailable reference');
    const reader = upstream.body?.getReader();
    if (!reader) throw Error('Empty reference');
    const parts: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 8 * 1024 * 1024) { await reader.cancel(); throw Error('Reference too large'); }
        parts.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Reference unavailable. Download the template reference images from the gallery and attach them in ChatGPT.', { status: 502 }); }
}
