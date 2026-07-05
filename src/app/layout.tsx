import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

import { ToastProvider } from '@/components/ui/Toast'
import { Navbar } from '@/components/Navbar'
import { PWARegister } from '@/components/PWARegister'
import { PenaltyNotifierWrapper } from '@/components/PenaltyNotifierWrapper'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Code Clash — 1v1 Daily Coding Arena',
  description: 'Compete daily with friends on LeetCode problems. Track your progress, maintain streaks, and climb the leaderboard.',
  manifest: '/manifest.json',
}

export const viewport = {
  themeColor: '#818cf8',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <div className="container">
            <header className="header-wrapper">
              <Link href="/" className="logo-link">
                <span className="logo-icon">⚔️</span>
                <span className="logo-text">Code Clash</span>
              </Link>
              <Navbar />
            </header>

            <main className="main-content">
              {children}
            </main>

            <footer className="app-footer">
              <div className="footer-content">
                <span>© {new Date().getFullYear()} Code Clash — Built with ♥ for competitive coders</span>
              </div>
            </footer>
          </div>
          <PWARegister />
          <PenaltyNotifierWrapper />
        </ToastProvider>
      </body>
    </html>
  )
}
