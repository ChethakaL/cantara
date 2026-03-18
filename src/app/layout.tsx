import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cantara Business Sale Readiness & M&A Advisory Portal',
  description: 'Powered by Babalilm AI FZ-LLC',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
