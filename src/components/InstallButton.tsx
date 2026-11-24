'use client';
import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export default function InstallButton() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return null;
  if (!evt && !ios) return null; // No install path available in this browser (e.g. Firefox desktop)

  async function click() {
    if (evt) { await evt.prompt(); const { outcome } = await evt.userChoice; if (outcome === 'accepted') setInstalled(true); setEvt(null); }
    else setHelp(true);
  }
  return (
    <>
      <button onClick={click} className="btn btn-ghost !min-h-[40px] !px-3"><Download size={16} /><span className="hidden sm:inline">Install app</span></button>
      {help && (
        <div role="dialog" aria-modal="true" aria-label="Install MARO AI" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-ink-600 bg-ink-800 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Install MARO AI on iPhone or iPad</h2>
              <button aria-label="Close" onClick={() => setHelp(false)} className="p-2"><X size={18} /></button></div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-mute">
              <li>Open this page in <b className="text-paper">Safari</b>.</li>
              <li>Tap the Share button <Share size={14} className="inline" /> in the toolbar.</li>
              <li>Choose <b className="text-paper">Add to Home Screen</b>, then tap <b className="text-paper">Add</b>.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
