import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Ethiopic } from 'next/font/google';
import './globals.css';

const notoSansEthiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  display: 'swap',
  variable: '--font-ethiopic',
});

export const metadata: Metadata = {
  title: 'AI Tutor - የአማርኛ ቱቶር',
  description: 'Accessible AI Tutor with Amharic and English support - Voice, text, and offline capable',
  keywords: ['AI', 'tutor', 'Amharic', 'English', 'accessibility', 'education', 'Ethiopia'],
  authors: [{ name: 'Digital Bridge Hackathon Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="am" dir="ltr" className={notoSansEthiopic.variable}>
      <head>
        <meta name="screen-reader-optimized" content="true" />
        <meta name="keyboard-navigation" content="true" />
      </head>
      <body>
        {/* Skip to main content link */}
        <a href="#main-content" className="skip-link">
          Skip to main content - ወደ ዋና ይዘት ዝለል
        </a>

        {/* Screen reader announcer */}
        <div
          id="sr-announcer"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {children}
      </body>
    </html>
  );
}
