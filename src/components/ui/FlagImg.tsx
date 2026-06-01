import Image from 'next/image'

interface FlagImgProps {
  codigo: string
  size?: number
  className?: string
}

export function FlagImg({ codigo, size = 20, className = '' }: FlagImgProps) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${codigo}.png`}
      alt={codigo}
      width={size}
      height={Math.round(size * 0.65)}
      className={className}
      style={{ borderRadius: '2px' }}
      unoptimized
    />
  )
}
