
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

const SITE_URL = 'https://maroai.vercel.app';
const SITE_NAME = 'MARO AI';
const MONETAG_ID = 'c8e74ae6ead447a698702cc796eec418';
const GOOGLE_VERIFICATION =
  'qYPvRFyHCkzwqItYAul-sPsUPP3Ino476Er0fhX7hks';

const sans = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'MARO AI - Your Intelligent AI Assistant',
    template: '%s | MARO AI',
  },

  description:
    'Meet MARO AI, your intelligent AI assistant for everyday questions, coding, learning, productivity and reliable health information.',

  applicationName: SITE_NAME,
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',

  alternates: {
    canonical: '/',
  },

  keywords: [
    'MARO AI',
    'MaroAI',
    'AI assistant',
    'artificial intelligence',
    'AI chatbot',
    'coding assistant',
    'learning assistant',
    'productivity AI',
    'online AI assistant',
  ],

  authors: [
    {
      name: SITE_NAME,
      url: SITE_URL,
    },
  ],

  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'technology',

  manifest: '/manifest.webmanifest',

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
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

    shortcut: '/favicon.ico',

    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },

  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'MARO AI - Your Intelligent AI Assistant',
    description:
      'One intelligent AI assistant for everyday questions, coding, learning and productivity.',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'MARO AI Logo',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'MARO AI - Your Intelligent AI Assistant',
    description:
      'Discover MARO AI, your intelligent assistant for coding, learning and everyday questions.',
    images: ['/icons/icon-512.png'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  other: {
    monetag: MONETAG_ID,
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* Monetag verification */}
        <meta name="monetag" content={MONETAG_ID} />

        {/* Google Search Console verification */}
        <meta
          name="google-site-verification"
          content={GOOGLE_VERIFICATION}
        />

        {/* Website identity */}
        <meta name="application-name" content={SITE_NAME} />

        {/* Installation banner styling */}
        <style>{`
          #maro-install-banner {
            display: none;
            width: 100%;
            box-sizing: border-box;
            padding: 12px 16px;
            background: #111827;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            color: white;
            z-index: 9999;
          }

          #maro-install-banner-content {
            max-width: 1100px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          #maro-install-icon {
            width: 42px;
            height: 42px;
            flex-shrink: 0;
            border-radius: 12px;
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          #maro-install-message {
            flex: 1;
            min-width: 0;
          }

          #maro-install-title {
            font-size: 14px;
            font-weight: 700;
          }

          #maro-install-description {
            font-size: 12px;
            color: #a1a1aa;
            margin-top: 3px;
          }

          #maro-install-action {
            border: 0;
            border-radius: 10px;
            padding: 10px 16px;
            background: #7c3aed;
            color: white;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            white-space: nowrap;
          }

          #maro-install-action:hover {
            background: #6d28d9;
          }

          #maro-install-close {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
            border: 0;
            border-radius: 10px;
            background: transparent;
            color: #a1a1aa;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          #maro-install-close:hover {
            background: rgba(255,255,255,0.08);
            color: white;
          }

          @media (max-width: 480px) {
            #maro-install-banner {
              padding: 10px 12px;
            }

            #maro-install-banner-content {
              gap: 9px;
            }

            #maro-install-icon {
              width: 36px;
              height: 36px;
              border-radius: 10px;
            }

            #maro-install-title {
              font-size: 13px;
            }

            #maro-install-description {
              font-size: 11px;
            }

            #maro-install-action {
              padding: 9px 12px;
              font-size: 12px;
            }

            #maro-install-close {
              width: 30px;
              height: 30px;
            }
          }
        `}</style>
      </head>

      <body>
        {/* MARO AI installation banner */}
        <div id="maro-install-banner">
          <div id="maro-install-banner-content">
            <div id="maro-install-icon">
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 19h14" />
              </svg>
            </div>

            <div id="maro-install-message">
              <div id="maro-install-title">
                Install MARO AI
              </div>

              <div id="maro-install-description">
                Get faster access from your home screen.
              </div>
            </div>

            <button
              id="maro-install-action"
              type="button"
            >
              Install
            </button>

            <button
              id="maro-install-close"
              type="button"
              aria-label="Dismiss install banner"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {children}

        {/* PWA installation functionality */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const banner = document.getElementById('maro-install-banner');
                const installButton = document.getElementById('maro-install-action');
                const closeButton = document.getElementById('maro-install-close');

                if (!banner || !installButton || !closeButton) return;

                const STORAGE_KEY = 'maro-install-banner-dismissed';

                let deferredPrompt = null;

                const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

                const isInstalled =
                  window.matchMedia('(display-mode: standalone)').matches ||
                  window.matchMedia('(display-mode: fullscreen)').matches ||
                  window.navigator.standalone === true;

                if (isInstalled) {
                  banner.style.display = 'none';
                  return;
                }

                try {
                  if (localStorage.getItem(STORAGE_KEY) === 'true') {
                    return;
                  }
                } catch (error) {}

                const isInstallSupported =
                  'onbeforeinstallprompt' in window || isIOS;

                if (!isInstallSupported) return;

                banner.style.display = 'block';

                window.addEventListener('beforeinstallprompt', (event) => {
                  event.preventDefault();
                  deferredPrompt = event;
                  banner.style.display = 'block';
                });

                window.addEventListener('appinstalled', () => {
                  banner.style.display = 'none';
                  deferredPrompt = null;

                  try {
                    localStorage.setItem(STORAGE_KEY, 'true');
                  } catch (error) {}
                });

                closeButton.addEventListener('click', () => {
                  banner.style.display = 'none';

                  try {
                    localStorage.setItem(STORAGE_KEY, 'true');
                  } catch (error) {}
                });

                installButton.addEventListener('click', async () => {
                  if (deferredPrompt) {
                    try {
                      await deferredPrompt.prompt();

                      const choice = await deferredPrompt.userChoice;

                      if (choice.outcome === 'accepted') {
                        banner.style.display = 'none';
                      }
                    } catch (error) {
                      console.error('Installation failed:', error);
                    }

                    deferredPrompt = null;
                    return;
                  }

                  if (isIOS) {
                    alert(
                      'Install MARO AI:\\n\\n' +
                      '1. Tap the Share button in Safari.\\n' +
                      '2. Select "Add to Home Screen".\\n' +
                      '3. Tap Add.'
                    );
                  } else {
                    alert(
                      'To install MARO AI:\\n\\n' +
                      'Open your browser menu and select "Install app" or "Add to Home Screen".'
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
