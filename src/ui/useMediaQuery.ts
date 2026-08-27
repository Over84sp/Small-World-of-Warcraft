import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/** narrow viewport: the UI switches to a map + bottom sheet layout */
export const useIsMobile = () => useMediaQuery('(max-width: 900px)')

/** coarse pointer: bigger hit areas and confirm-before-act by default */
export const useIsTouch = () => useMediaQuery('(pointer: coarse)')

/** portrait phones get an even more compact top bar */
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)')
