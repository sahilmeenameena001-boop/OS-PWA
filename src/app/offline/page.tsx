import Link from "next/link";
import { IconCloudOff } from "@/components/icons";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="glass max-w-sm rounded-3xl p-8">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-amber/15 text-amber"><IconCloudOff size={28} /></span>
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">Everything you captured is saved on this device and will sync when you are back online.</p>
        <Link href="/" className="tap mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-5 font-medium text-primary-foreground">Open Today</Link>
      </div>
    </main>
  );
}
