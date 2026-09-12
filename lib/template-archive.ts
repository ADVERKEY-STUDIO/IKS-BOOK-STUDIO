import { Unzip, UnzipInflate } from 'fflate';
/** Stream decompression with an actual output limit, not just untrusted ZIP metadata. */
export function readTemplateArchive(bytes: Uint8Array): Record<string, Uint8Array> {
    if (bytes.length > 40 * 1024 * 1024)
        throw Error('ZIP must be under 40 MB.');
    const entries: Record<string, Uint8Array> = Object.create(null);
    let total = 0, count = 0;
    let failure: Error | undefined;
    const unzip = new Unzip(file => {
        if (failure)
            return;
        if (++count > 250) {
            failure = Error('Too many ZIP entries.');
            return;
        }
        if (file.name.endsWith('/'))
            return;
        if (file.name.startsWith('/') || file.name.split(/[\\/]/).some(p => p === '..') || file.name.includes('\\')) {
            failure = Error('Unsafe archive path.');
            return;
        }
        if (!/^(book\.json|images\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp))$/i.test(file.name))
            return;
        if (Object.hasOwn(entries, file.name)) {
            failure = Error('Duplicate ZIP entry.');
            return;
        }
        entries[file.name] = new Uint8Array();
        const chunks: Uint8Array[] = [];
        let length = 0;
        file.ondata = (err, data, final) => { if (failure)
            return; if (err) {
            failure = err;
            return;
        } total += data.length; length += data.length; if (total > 50 * 1024 * 1024 || length > (file.name === 'book.json' ? 2 : 10) * 1024 * 1024) {
            failure = Error('Unpacked files exceed the size limit.');
            file.terminate();
            return;
        } chunks.push(data); if (final) {
            const all = new Uint8Array(length);
            let offset = 0;
            for (const c of chunks) {
                all.set(c, offset);
                offset += c.length;
            }
            entries[file.name] = all;
        } };
        file.start();
    });
    unzip.register(UnzipInflate);
    unzip.push(bytes, true);
    if (failure)
        throw failure;
    return entries;
}
