"use client";

import { useEffect, useRef } from "react";

export function SalesDocumentViewTracker({ viewedAction }: { viewedAction: () => Promise<void> }) {
  const recordedRef = useRef(false);

  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    void viewedAction();
  }, [viewedAction]);

  return null;
}
