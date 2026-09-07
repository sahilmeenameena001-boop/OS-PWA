"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/store/ui";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";

/** Deep-link target for the PWA shortcut and the mobile Capture tab: opens the sheet immediately. */
export default function CapturePage() {
  const openCapture = useUI((s) => s.openCapture);
  const open = useUI((s) => s.captureOpen);
  const router = useRouter();
  useEffect(() => {
    openCapture();
  }, [openCapture]);
  return (
    <div>
      <PageHeader title="Capture" subtitle="Anything on your mind goes to the Inbox first." />
      <div className="flex gap-2">
        <Button onClick={() => openCapture()} disabled={open}>Open quick capture</Button>
        <Button variant="outline" onClick={() => router.push("/inbox")}>Go to Inbox</Button>
      </div>
    </div>
  );
}
