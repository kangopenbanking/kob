import { useLocation } from "react-router-dom";
import { getDocNavigation } from "./docNavigationOrder";

/**
 * Hook that automatically derives previous/next page links
 * based on the canonical documentation reading order.
 */
export function useDocNavigation() {
  const { pathname } = useLocation();
  return getDocNavigation(pathname);
}
