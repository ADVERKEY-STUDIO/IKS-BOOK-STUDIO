/** Shared import and storage boundaries for an illustrated book. */
export const MiB = 1024 * 1024;
export const BOOK_ARTWORK_BYTES = 1024 * MiB;
export const IMAGE_BYTES = 25 * MiB;
export const ARCHIVE_BYTES = 1150 * MiB;
export const UNPACKED_BYTES = 1026 * MiB;
export function validateBookArtwork(images: Record<string, {size: number}>) {
 const bytes = Object.values(images).reduce((sum, image) => sum + image.size, 0);
 if(bytes > BOOK_ARTWORK_BYTES) throw Error(`Book artwork must fit within ${BOOK_ARTWORK_BYTES / MiB} MB.`);
 return bytes;
}

export const SOURCE_BYTES = 500_000_000; // Large sources are uploaded in bounded chunks.
export function validateSourceFile(file:{name:string;size:number}) {
 if(!/\.(pdf|docx)$/i.test(file.name)||file.size>SOURCE_BYTES)throw Error(`Choose a PDF or DOCX up to ${SOURCE_BYTES / 1_000_000} MB.`);
}

export const SOURCE_CHUNK_BYTES = 25 * MiB;
