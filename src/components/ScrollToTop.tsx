import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth"
    });
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Home") {
        event.preventDefault();
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "smooth"
        });
      } else if (event.key === "End") {
        event.preventDefault();
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          left: 0,
          behavior: "smooth"
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
