
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

        {/* Monetag advertising integration */}
        <Script
          id="monetag-advertising"
          src="https://quge5.com/88/tag.min.js"
          data-zone="315761"
          strategy="afterInteractive"
          data-cfasync="false"
        />
      </head>

      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
