import { MiB, ARCHIVE_BYTES, UNPACKED_BYTES, IMAGE_BYTES } from './template-capacity.ts';
import { Unzip, UnzipInflate } from 'fflate';
/** Stream decompression with an actual output limit, not just untrusted ZIP metadata. */
export function readTemplateArchive(bytes: Uint8Array): Record<string, Uint8Array> {
    if (bytes.length > ARCHIVE_BYTES)
        throw Error(`ZIP must be under ${ARCHIVE_BYTES/MiB} MB.`);
    const entries: Record<string, Uint8Array> = Object.create(null);
    let total = 0, count = 0;
    let requestBundle = false;
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
        if (file.name === 'START-HERE.txt') requestBundle = true;
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
        } total += data.length; length += data.length; if (total > UNPACKED_BYTES || length > (file.name === 'book.json' ? 2 * 1024 * 1024 : IMAGE_BYTES)) {
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
    if (requestBundle && !entries['book.json'])
        throw Error('This is a request for ChatGPT, not a completed book. Attach it in ChatGPT with the copied prompt. Then return here with the generated images or completed book ZIP.');
    return entries;
}
