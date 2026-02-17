import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PickSlate — Daily Sports Picks',
  description: 'Wordle for sports. Pick winners. Flex on your friends.',
  openGraph: {
    title: 'PickSlate',
    description: 'Daily sports picks. 7 games. 30 seconds. Can you go perfect?',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#07070d',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-body antialiased" style={{ fontFamily: 'var(--font-body)' }}>
        <main className="relative z-10 min-h-screen min-h-[100dvh]">
          {children}
        </main>
      </body>
    </html>
  )
}
