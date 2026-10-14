import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NSM – Studio tatuażu',
  description: 'System wspomagający obsługę klientów i usług studia tatuażu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
