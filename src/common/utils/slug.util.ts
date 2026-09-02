/**
 * Converts an arbitrary title into a URL-safe slug.
 * Handles accents (café -> cafe) and strips everything that is not
 * alphanumeric, collapsing separators into single dashes.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    // strip combining diacritical marks left over by NFKD
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

  return slug.length > 0 ? slug : 'post';
}
