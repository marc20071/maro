
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

const sans = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-sans',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'MARO AI',
    template: '%s · MARO AI',
  },

  description:
    'One AI assistant for everyday questions, coding, health information and learning.',

  applicationName: 'MARO AI',

  manifest: '/manifest.webmanifest',

  icons: {
    icon: [
      {
        url: '/icons/maro.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
    apple: '/icons/apple-touch-icon.png',
  },

  appleWebApp: {
    capable: true,
    title: 'MARO AI',
    statusBarStyle: 'black-translucent',
  },

  other: {
    monetag: 'c8e74ae6ead447a698702cc796eec418',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0E13',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* Monetag website verification */}
        <meta
          name="monetag"
          content="c8e74ae6ead447a698702cc796eec418"
        />

        {/* Google Search Console verification */}
        <meta
          name="google-site-verification"
          content="qYPvRFyHCkzwqItYAul-sPsUPP3Ino476Er0fhX7hks"
        />

        {/* Install MARO button styles */}
        <style>{`
          #maro-install-button {
            position: fixed;
            right: 18px;
            bottom: calc(20px + env(safe-area-inset-bottom));
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 14px 20px;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 16px;
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            color: white;
            font-family: inherit;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 30px rgba(99,102,241,0.35);
            transition: transform .2s, opacity .2s;
          }

          #maro-install-button:hover {
            transform: translateY(-2px);
          }

          #maro-install-button:active {
            transform: scale(.96);
          }

          #maro-install-button svg {
            width: 20px;
            height: 20px;
          }

          @media (max-width: 480px) {
            #maro-install-button {
              right: 14px;
              bottom: calc(16px + env(safe-area-inset-bottom));
              padding: 12px 16px;
              font-size: 13px;
            }
          }
        `}</style>
      </head>

      <body>
        {children}

        {/* Install MARO button */}
        <button id="maro-install-button" type="button">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 19h14" />
          </svg>

          <span id="maro-install-text">Install MARO</span>
        </button>

        {/* PWA installation logic */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                let deferredPrompt = null;

                const button = document.getElementById('maro-install-button');
                const text = document.getElementById('maro-install-text');

                if (!button || !text) return;

                const isStandalone =
                  window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true;

                if (isStandalone) {
                  button.style.display = 'none';
                  return;
                }

                window.addEventListener('beforeinstallprompt', (event) => {
                  event.preventDefault();
                  deferredPrompt = event;
                });

                window.addEventListener('appinstalled', () => {
                  button.style.display = 'none';
                  deferredPrompt = null;
                });

                button.addEventListener('click', async () => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();

                    const result = await deferredPrompt.userChoice;

                    if (result.outcome === 'accepted') {
                      button.style.display = 'none';
                    }

                    deferredPrompt = null;
                    return;
                  }

                  const isIOS =
                    /iphone|ipad|ipod/i.test(navigator.userAgent);

                  if (isIOS) {
                    alert(
                      'To install MARO:\\\\n\\\\n' +
                      '1. Tap the Share button in Safari.\\\\n' +
                      '2. Select "Add to Home Screen".\\\\n' +
                      '3. Tap Add.'
                    );
                  } else {
                    alert(
                      'To install MARO:\\\\n\\\\n' +
                      'Open your browser menu and select "Install MARO", "Install app", or "Add to Home Screen".'
                    );
                  }
                });
              })();
            `,
          }}
        />

        <ServiceWorker />
      </body>
    </html>
  );
}
