import type { Metadata, Viewport } from 'next'
import { Inter, Bebas_Neue } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { HeroStripWrapper } from '@/components/layout/HeroStripWrapper'
import { HeroStrip } from '@/components/layout/HeroStrip'
import { BottomNav } from '@/components/layout/BottomNav'
import { Footer } from '@/components/layout/Footer'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { NotificationPopup } from '@/components/layout/NotificationPopup'
import { EnquetePopup } from '@/components/layout/EnquetePopup'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas', display: 'swap' })

export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão oficial da Copa do Mundo FIFA 2026',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bolão 26',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#020F2A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${bebasNeue.variable}`}>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ServiceWorkerRegistrar />
        <Header />
        <HeroStripWrapper><HeroStrip /></HeroStripWrapper>
        <main style={{ flex: 1, position: 'relative', zIndex: 1, width: '100%', overflowX: 'hidden' }}>{children}</main>
        <Footer />
        <BottomNav />
        <NotificationPopup />
        <EnquetePopup />
        <Analytics />
        <SpeedInsights sampleRate={0.2} />
      </body>
    </html>
  )
}
