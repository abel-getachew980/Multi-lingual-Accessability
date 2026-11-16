import type { Metadata, Viewport } from 'next';
// Self-hosted font: no request to Google Fonts, so the app renders correctly
// offline and behind restrictive networks.
import '@fontsource/noto-sans-ethiopic/400.css';
import '@fontsource/noto-sans-ethiopic/500.css';
import '@fontsource/noto-sans-ethiopic/600.css';
import '@fontsource/noto-sans-ethiopic/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Tutor - የአማርኛ ቱቶር',
  description: 'Accessible AI Tutor with Amharic and English support - Voice, text, and offline capable',
  keywords: ['AI', 'tutor', 'Amharic', 'English', 'accessibility', 'education', 'Ethiopia'],
  authors: [{ name: 'Digital Bridge Hackathon Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AI Tutor',
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
    <html lang="am" dir="ltr">
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
