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
      <Script
        id={`maro-ad-${placement}`}
        src="https://quge5.com/88/tag.min.js"
        data-zone="315761"
        async
        data-cfasync="false"
        strategy="afterInteractive"
      />
    </div>
  );
}