import type { Metadata } from 'next'
import { GeistSans, GeistMono } from 'geist/font'
import './globals.css'
import AuthProviderWrapper from '@/components/AuthProviderWrapper'

export const metadata: Metadata = {
  title: 'AI Buddy Study',
  description: 'Your smart study partner',
  icons: {
    icon: '/favicon.ico',              // Normal browsers
    shortcut: '/favicon.ico',          // Shortcut icons (Windows, etc.)
    apple: '/apple-touch-icon.png',    // iPhone/iPad homescreen icon
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} ${GeistMono.variable} font-sans antialiased`}>
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
      </body>
    </html>
  )
}
