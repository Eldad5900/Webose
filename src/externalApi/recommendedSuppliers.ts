import type { User } from 'firebase/auth'
import { addDoc, collection, onSnapshot, query, serverTimestamp, type Firestore, where } from 'firebase/firestore'
import type { RecommendedSupplierRecord } from '../controlers/types'

type RecommendedSupplierPayload = Omit<RecommendedSupplierRecord, 'id' | 'ownerId'>

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

export function subscribeToUserRecommendedSuppliers(
  db: Firestore,
  user: User,
  onNext: (suppliers: RecommendedSupplierRecord[]) => void,
  onError: (error: Error) => void
) {
  const suppliersRef = collection(db, 'recommendedSuppliers')
  const q = query(suppliersRef, where('ownerId', '==', user.uid))

  return onSnapshot(
    q,
    (snapshot) => {
      const next = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Partial<RecommendedSupplierRecord>
          return {
            id: docSnap.id,
            ownerId: typeof data.ownerId === 'string' ? data.ownerId : user.uid,
            name: typeof data.name === 'string' ? data.name : '',
            category: typeof data.category === 'string' ? data.category : '',
            phone: typeof data.phone === 'string' ? data.phone : '',
            city: typeof data.city === 'string' ? data.city : '',
            notes: typeof data.notes === 'string' ? data.notes : ''
          }
        })
        .sort((first, second) => first.name.localeCompare(second.name, 'he'))
      onNext(next)
    },
    (error) => onError(error)
  )
}

export async function addRecommendedSupplierForUser(
  db: Firestore,
  user: User,
  payload: RecommendedSupplierPayload
) {
  const docPayload = removeUndefined({
    ...payload,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  await addDoc(collection(db, 'recommendedSuppliers'), docPayload)
}
