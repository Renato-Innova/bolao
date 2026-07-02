import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    // Fixa a raiz do workspace neste projeto — sem isso, o Next sobe os
    // diretórios e encontra um pnpm-lock.yaml solto em C:\Users\renat
    // (de outro projeto, sem relação com o bolão), gerando um warning de
    // "multiple lockfiles" a cada build.
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
