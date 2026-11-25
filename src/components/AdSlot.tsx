"use client";

import { useEffect, useRef } from "react";

export default function AdSlot({ placement }: { placement: string }) {
  const slotRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return;

    const slot = slotRef.current;
    if (!slot) return;

    // Prevent duplicate scripts
    if (slot.querySelector('script[data-zone="12351795"]')) return;

    const script = document.createElement("script");
    script.dataset.zone = "12351795";
    script.src = "https://nap5k.com/tag.min.js";
    script.async = true;

    slot.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return null;

  return (
    <aside
      ref={slotRef}
      aria-label="Advertisement"
      data-ad-placement={placement}
      className="relative my-4 flex min-h-[100px] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink-600 text-xs text-mute"
    >
      <span className="pointer-events-none absolute left-2 top-2 text-[10px] uppercase tracking-widest opacity-40">
        Advertisement
      </span>
    </aside>
  );
}