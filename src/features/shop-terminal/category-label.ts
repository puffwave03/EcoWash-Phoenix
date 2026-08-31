export function humanizeCategoryKey(value: string) {
  return value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
    .replace(/^./, (character) => character.toLocaleUpperCase());
}

export function resolveShopCategoryLabel(
  categoryKey: string,
  canonicalTitle: string | null,
  localizedSystemLabels: Record<string, string>,
) {
  const localized = localizedSystemLabels[categoryKey]?.trim();
  if (localized) return localized;
  const canonical = canonicalTitle?.trim();
  if (canonical && canonical !== categoryKey) return canonical;
  return humanizeCategoryKey(canonical || categoryKey);
}
