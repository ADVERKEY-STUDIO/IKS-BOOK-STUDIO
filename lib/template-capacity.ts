/** Shared import and storage boundaries for an illustrated book. */
export const MiB = 1024 * 1024;
export const BOOK_ARTWORK_BYTES = 512 * MiB;
export const IMAGE_BYTES = 25 * MiB;
export const ARCHIVE_BYTES = 550 * MiB;
export const UNPACKED_BYTES = 514 * MiB;
export function validateBookArtwork(images: Record<string, {size: number}>) {
 const bytes = Object.values(images).reduce((sum, image) => sum + image.size, 0);
 if(bytes > BOOK_ARTWORK_BYTES) throw Error(`Book artwork must fit within ${BOOK_ARTWORK_BYTES / MiB} MB.`);
 return bytes;
}
