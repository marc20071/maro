import Script from "next/script";

/** Monetag integration. Renders only when NEXT_PUBLIC_ADS_ENABLED=true. */
export default function AdSlot({ placement }: { placement: string }) {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return null;

  return (
    <aside
      aria-label="Advertisement"
      data-ad-placement={placement}
      className="relative my-4 flex min-h-[90px] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink-600 text-xs text-mute"
    >
      <span className="pointer-events-none absolute left-2 top-2 text-[10px] uppercase tracking-widest opacity-40">
        Advertisement
      </span>

      <Script
        id="monetag-maroads"
        src="https://quge5.com/88/tag.min.js"
        data-zone="315761"
        strategy="afterInteractive"
        data-cfasync="false"
      />
    </aside>
  );
}