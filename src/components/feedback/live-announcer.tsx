import { useEffect, useState } from 'react'
import { onAnnounce } from '@/lib/announcer'

/** Two visually-hidden live regions fed by `announce()`. */
export function LiveAnnouncer() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  useEffect(
    () =>
      onAnnounce((msg, politeness) => {
        const set = politeness === 'assertive' ? setAssertive : setPolite
        // Clear first so repeating the same message is announced again.
        set('')
        requestAnimationFrame(() => set(msg))
      }),
    [],
  )
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-polite">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  )
}
