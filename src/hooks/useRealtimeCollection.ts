import { useEffect, useState } from 'react'

type CollectionSubscriber<T> = (
  onNext: (items: T[]) => void,
  onError: (error: Error) => void
) => (() => void) | void

export default function useRealtimeCollection<T>({
  enabled,
  subscribe
}: {
  enabled: boolean
  subscribe: CollectionSubscriber<T>
}) {
  const [items, setItems] = useState<T[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setItems([])
      setBusy(false)
      setError('')
      return
    }

    setBusy(true)
    setError('')

    return subscribe(
      (nextItems) => {
        setItems(nextItems)
        setBusy(false)
      },
      (subscribeError) => {
        setError(subscribeError.message)
        setBusy(false)
      }
    )
  }, [enabled, subscribe])

  return { items, busy, error }
}
