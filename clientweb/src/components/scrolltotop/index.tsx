import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router";

// BrowserRouter (declarative mode) never resets the window scroll on its own,
// so opening a new page kept the previous page's scroll offset — e.g. scroll
// down a product detail, go Home, open another product and it opened halfway
// down. Jump to the top whenever a link/navigate() lands on a new path.
// Back/forward (POP) is left alone so the browser can restore the old spot.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    if (navType === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, navType]);

  return null;
}
