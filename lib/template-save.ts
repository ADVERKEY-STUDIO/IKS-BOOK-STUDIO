/** Attempt both copies independently: neither a full browser nor an offline account loses the other copy. */
export async function saveWithFallback<T>(value: T, local: (value: T) => Promise<unknown>, cloud?: (value: T) => Promise<T>) {
  if (!cloud) { await local(value); return { value, localError: undefined }; }
  const [browser, account] = await Promise.allSettled([local(value), cloud(value)]);
  if (account.status === 'rejected') {
    if(browser.status === 'rejected') throw new Error(`Neither copy could be saved. Account: ${account.reason instanceof Error?account.reason.message:'save failed'}. ${browserSaveError(browser.reason)}`);
    throw account.reason;
  }
  let localError: unknown;
  try { await local(account.value); } catch(error) { localError=error; }
  return { value: account.value, localError };
}
export function browserSaveError(error: unknown) {
  return error instanceof Error && error.name === 'QuotaExceededError'
    ? 'This browser has run out of storage. Save to your account or download an editable ZIP. Remove unneeded browser copies to free space.'
    : 'This browser could not save the book. Try again, save to your account, or download an editable ZIP.';
}
