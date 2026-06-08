import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppSettingsProvider } from '@/components/app-settings-provider'
import { LocaleHead } from '@/components/locale-head'
import { buildRootMetadata } from '@/lib/site-metadata'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  ...buildRootMetadata(),
  generator: 'v0.app',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      'naver-site-verification':
        process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ??
        '86d2ac470af347b883c7d85256277906f558f671',
    },
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="bg-background">
      <body className="font-sans antialiased">
        <AppSettingsProvider>
          <LocaleHead />
          {children}
        </AppSettingsProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
