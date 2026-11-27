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
   <script>(function(s){s.dataset.zone='12351795',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
     <script>(function(s){s.dataset.zone='12362495',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
    </div>
  );
}
