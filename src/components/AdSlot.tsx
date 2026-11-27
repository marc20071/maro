'use client';

import Script from 'next/script';

interface AdSlotProps {
  placement?: string;
}

export default function AdSlot({ placement = 'default' }: AdSlotProps) {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== 'true') {
    return null;
  }

  return (
    <div
      className="w-full flex justify-center overflow-hidden"
      data-ad-placement={placement}
    >
      {/* Monetag In-Page Push */}
      <Script
        id={`monetag-inpage-${placement}`}
        src="https://nap5k.com/tag.min.js"
        strategy="afterInteractive"
        data-zone="12351795"
        data-cfasync="false"
      />
    </div>
  );
}
