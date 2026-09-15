/** Account saving remains available even when this browser cannot store the book. */
export async function saveWithFallback<T>(value: T, local: (value: T) => Promise<unknown>, cloud?: (value: T) => Promise<T>) {
  let localError: unknown;
  if (!cloud) {
    await local(value);
    return { value, localError: undefined };
  }
  // Save to the account first: a slow or full browser must not delay the upload.
  const uploaded = await cloud(value);
  try { await local(uploaded); localError = undefined; } catch (error) { localError = error; }
  return { value: uploaded, localError };
}
export function browserSaveError(error: unknown) {
  return error instanceof Error && error.name === 'QuotaExceededError'
    ? 'This browser has run out of storage. Save to your account or download an editable ZIP. Remove unneeded browser copies to free space.'
    : 'This browser could not save the book. Try again, save to your account, or download an editable ZIP.';
}
