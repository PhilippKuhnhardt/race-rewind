export function slugify(text: string): string {
  // Fold to ASCII (NFKD decompose, strip combining marks, keep only ASCII letters/digits)
  const ascii = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritical marks
    .replace(/[^\x00-\x7F]/g, '');   // strip remaining non-ASCII
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function driverSlug(forename: string, surname: string): string {
  return slugify(`${forename} ${surname}`);
}

export function raceSlug(year: number | string, name: string): string {
  return slugify(`${year} ${name}`);
}

export function deduplicate(slug: string, existing: Set<string>): string {
  if (!existing.has(slug)) return slug;
  let n = 2;
  while (existing.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}
