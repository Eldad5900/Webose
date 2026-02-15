import type { User } from 'firebase/auth'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, type Firestore, where } from 'firebase/firestore'
import type { MeetingRecord } from '../controlers/types'

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack }
  }
  return { message: String(error) }
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefined(item)) as T
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    const cleaned = entries.reduce<Record<string, unknown>>((acc, [key, entry]) => {
      if (entry === undefined) return acc
      acc[key] = removeUndefined(entry)
      return acc
    }, {})
    return cleaned as T
  }
  return value
}

export function subscribeToUserMeetings(
  db: Firestore,
  user: User,
  onNext: (meetings: MeetingRecord[]) => void,
  onError: (error: Error) => void
) {
  const meetingsRef = collection(db, 'meetings')
  const q = query(meetingsRef, where('ownerId', '==', user.uid), orderBy('date', 'asc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const next = snapshot.docs.map((doc) => ({
        id: doc.id,
        ownerId: (doc.data() as any).ownerId,
        coupleName: (doc.data() as any).coupleName || '',
        location: (doc.data() as any).location || '',
        date: (doc.data() as any).date || '',
        time: (doc.data() as any).time || ''
      }))
      onNext(next)
    },
    (error) => {
      onError(error)
    }
  )
}

export async function addMeetingForUser(db: Firestore, user: User, payload: Omit<MeetingRecord, 'id'>) {
  try {
    const docPayload = removeUndefined({ ...payload, ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    await addDoc(collection(db, 'meetings'), docPayload)
  } catch (error) {
    const normalized = normalizeError(error)
    throw new Error(normalized.message)
  }
}
