import type { Metadata } from 'next'
import { Inter, Bebas_Neue } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { HeroStrip } from '@/components/layout/HeroStrip'
import { BottomNav } from '@/components/layout/BottomNav'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas', display: 'swap' })

export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão oficial da Copa do Mundo FIFA 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${bebasNeue.variable}`}>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <HeroStrip />
        <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>{children}</main>
        <BottomNav />
      </body>
    </html>
  )
}
