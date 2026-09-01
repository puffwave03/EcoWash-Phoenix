import type { CatalogOrderMode, CatalogPresentation } from "./types.ts";

export function humanizeCatalogKey(value: string) {
  const readable = value.replaceAll("_", " ").trim();
  return readable ? readable.charAt(0).toLocaleUpperCase() + readable.slice(1) : "Other";
}

export function sortCatalogPresentation<T extends { categoryKey?: string | null; id: string; name: string }>(
  items: T[],
  presentation: Map<string, CatalogPresentation>,
  locale: string,
  mode: CatalogOrderMode,
) {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base", usage: "sort" });
  return [...items].sort((left, right) => {
    const leftView = presentation.get(left.id);
    const rightView = presentation.get(right.id);
    const categoryDifference = (leftView?.categorySortOrder ?? 0) - (rightView?.categorySortOrder ?? 0);
    if (categoryDifference !== 0) return categoryDifference;
    if (mode === "manual") {
      const manualDifference = (leftView?.manualSortOrder ?? 0) - (rightView?.manualSortOrder ?? 0);
      if (manualDifference !== 0) return manualDifference;
    } else {
      const nameDifference = collator.compare(leftView?.name ?? left.name, rightView?.name ?? right.name);
      if (nameDifference !== 0) return mode === "alphabetical_desc" ? -nameDifference : nameDifference;
    }
    return left.id.localeCompare(right.id);
  });
}
