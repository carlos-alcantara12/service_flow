import { useCallback, useEffect, useRef, useState } from 'react'

const visibleDuration = 5000
const exitDuration = 240

export default function useTransientNotice() {
  const [notice, setNotice] = useState('')
  const [isLeaving, setIsLeaving] = useState(false)
  const noticeValue = useRef('')
  const visibleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (visibleTimer.current) clearTimeout(visibleTimer.current)
    if (exitTimer.current) clearTimeout(exitTimer.current)
    visibleTimer.current = null
    exitTimer.current = null
  }, [])

  const dismissNotice = useCallback(() => {
    if (!noticeValue.current) return
    if (visibleTimer.current) clearTimeout(visibleTimer.current)
    visibleTimer.current = null
    setIsLeaving(true)
    exitTimer.current = setTimeout(() => {
      noticeValue.current = ''
      setNotice('')
      setIsLeaving(false)
      exitTimer.current = null
    }, exitDuration)
  }, [])

  const showNotice = useCallback((message: string) => {
    clearTimers()
    if (!message) {
      noticeValue.current = ''
      setNotice('')
      setIsLeaving(false)
      return
    }
    noticeValue.current = message
    setNotice(message)
    setIsLeaving(false)
    visibleTimer.current = setTimeout(() => dismissNotice(), visibleDuration)
  }, [clearTimers, dismissNotice])

  useEffect(() => clearTimers, [clearTimers])

  return { notice, showNotice, dismissNotice, isLeaving }
}
