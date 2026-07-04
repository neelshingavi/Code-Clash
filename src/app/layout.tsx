import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Daily Code Clash',
  description: '1v1 Daily Problem Solving Competition Tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="container">
          <header style={{ padding: '1.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)' }}>
            <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--primary)' }}>Code Clash</h1>
            <nav style={{ display: 'flex', gap: '1rem' }}>
              <a href="/" style={{ fontWeight: 600 }}>Dashboard</a>
              <a href="/submit" style={{ fontWeight: 600 }}>Log Problem</a>
              <a href="/settings" style={{ fontWeight: 600 }}>Settings</a>
            </nav>
          </header>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
