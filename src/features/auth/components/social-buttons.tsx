import { Link } from '@tanstack/react-router'
import facebookLogo from '@/assets/icons/facebook-logo.svg'
import g0 from '@/assets/icons/google/v0.svg'
import g1 from '@/assets/icons/google/v1.svg'
import gGroup from '@/assets/icons/google/group.svg'
import g2 from '@/assets/icons/google/v2.svg'
import g3 from '@/assets/icons/google/v3.svg'
import g4 from '@/assets/icons/google/v4.svg'
import g5 from '@/assets/icons/google/v5.svg'

/** Google mark assembled from the Figma vector layers at their original insets. */
function GoogleMark() {
  const parts: [string, string][] = [
    [g0, '57.68% 17.83% 0 7.11%'],
    [g1, '71.33% 17.83% 0 50%'],
    [gGroup, '24.69% 75.25% 24.69% 0'],
    [g2, '38.28% 0 11.97% 47.07%'],
    [g3, '38.28% 0 11.97% 50%'],
    [g4, '0 17.01% 57.68% 7.11%'],
    [g5, '0 17.01% 70.51% 50%'],
  ]
  return (
    <span aria-hidden className="relative size-5 overflow-hidden">
      {parts.map(([src, inset]) => (
        <img key={src} src={src} alt="" className="absolute block max-w-none" style={{ inset, width: 'auto', height: 'auto' }} />
      ))}
    </span>
  )
}

/** Third-party sign-in is out of scope: buttons lead to an honest notice. */
export function SocialButtons() {
  const cls =
    'border-line text-text-secondary flex h-10 w-full items-center justify-center gap-3 rounded-[5px] border text-[13px] leading-4 font-medium hover:border-brand'
  return (
    <div className="flex flex-col gap-3">
      <Link to="/em-breve/$secao" params={{ secao: 'login-social' }} className={cls}>
        <GoogleMark />
        Continuar com Google
      </Link>
      <Link to="/em-breve/$secao" params={{ secao: 'login-social' }} className={cls}>
        <img src={facebookLogo} alt="" width={20} height={20} />
        Continuar com Facebook
      </Link>
    </div>
  )
}
