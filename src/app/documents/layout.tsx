/**
 * Layout for documents pages
 * Provides consistent structure for document management interface
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documents | SBWC ChatBot',
  description: 'Manage your document library for the SBWC ChatBot assistant',
};

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </div>
    </div>
  );
}
