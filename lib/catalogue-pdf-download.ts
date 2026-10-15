// Only catalogue-owned URLs may be fetched; callers supply an ID, never a URL.
export async function cataloguePdfDownload(request: Request, books: { id: string; pdfUrl: string }[], fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return Response.json({ error: 'Use GET.' }, { status: 405 });
  const book = books.find(b => b.id === new URL(request.url).searchParams.get('id'));
  if (!book) return Response.json({ error: 'Attach a downloaded PDF to this saved source in the catalogue, then retry.' }, { status: 404 });
  try {
    let url = book.pdfUrl;
    for (let attempt = 0; attempt < 5; attempt++) {
      const target = new URL(url);
      if (target.protocol !== 'https:' || !(target.hostname === 'archive.org' || target.hostname.endsWith('.archive.org'))) throw new Error('Unexpected archive download destination.');
      const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(120000) });
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Archive returned an invalid redirect.');
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok || !response.body) throw new Error(`Archive download unavailable (${response.status}). Retry or attach the PDF in the catalogue.`);
      const limit = 200 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > limit) { await response.body.cancel(); throw new Error('PDF exceeds 200 MB. Attach a smaller PDF in the catalogue.'); }
      let bytes = 0;
      const bounded = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { bytes += chunk.byteLength; if (bytes > limit) throw new Error('PDF exceeds 200 MB.'); controller.enqueue(chunk); } }));
      return new Response(bounded, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
    }
    throw new Error('Too many archive redirects. Attach a downloaded PDF and retry.');
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Archive PDF unavailable.' }, { status: 502 }); }
}
