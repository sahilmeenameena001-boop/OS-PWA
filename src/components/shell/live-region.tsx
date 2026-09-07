"use client";
import { useUI } from "@/store/ui";

/** Polite screen-reader announcements ("Saved", "Expense recorded"). */
export function LiveRegion() {
  const message = useUI((s) => s.liveMessage);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
