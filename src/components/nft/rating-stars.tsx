import star from '@/assets/icons/star.svg'
import starEmpty from '@/assets/icons/star-empty.svg'

export function RatingStars({ value, size = 15 }: { value: number; size?: number }) {
  const full = Math.round(value)
  return (
    <span className="flex gap-1" role="img" aria-label={`Nota ${value.toFixed(1).replace('.', ',')} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <img key={i} src={i < full ? star : starEmpty} alt="" width={size} height={size} className="p-[1.5px]" />
      ))}
    </span>
  )
}
