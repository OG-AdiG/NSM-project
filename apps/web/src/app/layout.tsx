import type { Metadata } from 'next';
import { Newsreader, Source_Sans_3 } from 'next/font/google';
import { AuthProvider } from '@/components/auth-provider';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

const display = Newsreader({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NSM – Studio tatuażu',
  description: 'System wspomagający obsługę klientów i usług studia tatuażu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${display.variable} ${sans.variable}`}>
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
