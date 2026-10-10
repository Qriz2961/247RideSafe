"use client";

import { useEffect } from "react";
import { expireHolds } from "@/lib/store";

/** Stage 2 stand-in for the server job that releases expired 30-minute holds. */
export default function HoldSweeper() {
  useEffect(() => {
    expireHolds();
    const t = setInterval(expireHolds, 15_000);
    return () => clearInterval(t);
  }, []);
  return null;
}
