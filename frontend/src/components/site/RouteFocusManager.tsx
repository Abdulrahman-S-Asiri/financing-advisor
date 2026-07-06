"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function RouteFocusManager() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathname.current === null) {
      previousPathname.current = pathname;
      return;
    }

    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    const target = document.getElementById("main-content");
    if (!target) {
      return;
    }

    const focusTarget = () => target.focus({ preventScroll: true });
    const frame = window.requestAnimationFrame
      ? window.requestAnimationFrame(focusTarget)
      : window.setTimeout(focusTarget, 0);

    return () => {
      if (window.cancelAnimationFrame) {
        window.cancelAnimationFrame(frame);
      } else {
        window.clearTimeout(frame);
      }
    };
  }, [pathname]);

  return null;
}
