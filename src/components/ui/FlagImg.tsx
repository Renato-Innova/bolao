import Image from 'next/image'

interface FlagImgProps {
  codigo: string
  size?: number
  className?: string
}

export function FlagImg({ codigo, size = 20, className = '' }: FlagImgProps) {
  const h = Math.round(size * 0.67)
  return (
    <Image
      src={`https://flagcdn.com/w40/${codigo}.png`}
      alt={codigo}
      width={size}
      height={h}
      className={className}
      style={{ borderRadius: '2px', width: size, height: h, objectFit: 'cover', flexShrink: 0 }}
      unoptimized
      loading="eager"
      draggable={false}
    />
  )
}
