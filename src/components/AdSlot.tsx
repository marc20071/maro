
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
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
      </head>

      <body>
        {/* Monetag advertising */}
        {process.env.NEXT_PUBLIC_ADS_ENABLED === 'true' && (
          <Script
            id="monetag-maroads"
            src="https://nap5k.com/tag.min.js"
            data-zone="12351795"
            strategy="afterInteractive"
          />
        )}

        {children}

        <ServiceWorker />
      </body>
    </html>
  );
}
