import { useDocNavigation } from "./useDocNavigation";
import { DocNavigation } from "./DocNavigation";

/**
 * Drop-in replacement for DocNavigation that automatically
 * derives previous/next pages from the canonical reading order.
 * No props needed — just place <AutoDocNavigation /> at the bottom of each page.
 */
export function AutoDocNavigation() {
  const { previousPage, nextPage } = useDocNavigation();
  return <DocNavigation previousPage={previousPage} nextPage={nextPage} />;
}
