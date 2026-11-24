/** Reserved space for a future ad network. Renders nothing until NEXT_PUBLIC_ADS_ENABLED=true. */
export default function AdSlot({ placement }: { placement: string }) {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== 'true') return null;
  return (
    <aside aria-label="Advertisement" data-ad-placement={placement} className="my-4 flex min-h-[90px] items-center justify-center rounded-xl border border-dashed border-ink-600 text-xs text-mute">
      Advertisement space
    </aside>
  );
}
