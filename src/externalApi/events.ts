import type { User } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore
} from 'firebase/firestore'
import type { EventRecord } from '../controlers/types'

export type EventPayload = Omit<EventRecord, 'id' | 'ownerId'>

function normalizeEvent(
  docSnap: { id: string; data: () => Partial<EventRecord> },
  fallbackOwnerId: string
): EventRecord {
  const data = docSnap.data()
  
  // Extract createdAt with proper type handling
  let createdAt: number | undefined
  const rawCreatedAt = data.createdAt
  if (rawCreatedAt && typeof rawCreatedAt === 'object' && 'toDate' in rawCreatedAt) {
    createdAt = (rawCreatedAt as { toDate: () => Date }).toDate().getTime()
  } else if (typeof rawCreatedAt === 'number') {
    createdAt = rawCreatedAt
  }

  return {
    id: docSnap.id,
    ownerId: data.ownerId ?? fallbackOwnerId,
    coupleName: data.coupleName ?? '',
    createdAt,
    groomName: data.groomName ?? '',
    brideName: data.brideName ?? '',
    groomFatherName: data.groomFatherName ?? '',
    groomMotherName: data.groomMotherName ?? '',
    groomFatherPhone: typeof data.groomFatherPhone === 'number' ? data.groomFatherPhone : 0,
    groomMotherPhone: typeof data.groomMotherPhone === 'number' ? data.groomMotherPhone : 0,
    brideFatherName: data.brideFatherName ?? '',
    brideMotherName: data.brideMotherName ?? '',
    brideFatherPhone: typeof data.brideFatherPhone === 'number' ? data.brideFatherPhone : 0,
    brideMotherPhone: typeof data.brideMotherPhone === 'number' ? data.brideMotherPhone : 0,
    date: data.date ?? '',
    hall: data.hall ?? '',
    notes: data.notes ?? '',
    budget: typeof data.budget === 'number' ? data.budget : undefined,
    guests: typeof data.guests === 'number' ? data.guests : undefined,
    status: data.status ?? '',
    contactPhone: typeof data.contactPhone === 'number' ? data.contactPhone : 0,
    groomEscort: data.groomEscort ?? '',
    brideEscort: data.brideEscort ?? '',
    groomEntrySong: data.groomEntrySong ?? '',
    brideEntrySong: data.brideEntrySong ?? '',
    siblingsEntry: data.siblingsEntry ?? '',
    siblingsEntrySong: data.siblingsEntrySong ?? '',
    waitingAtChuppah: data.waitingAtChuppah ?? '',
    glassBreakSong: data.glassBreakSong ?? '',
    afterShoeshbinim: data.afterShoeshbinim ?? '',
    afterRings: data.afterRings ?? '',
    wineAtChuppah: data.wineAtChuppah ?? '',
    bridesBlessing: data.bridesBlessing ?? '',
    bridesBlessingNote: data.bridesBlessingNote ?? '',
    ushersOrPullCouple: data.ushersOrPullCouple ?? '',
    witnesses: data.witnesses ?? '',
    danceSeparationBarcodes: data.danceSeparationBarcodes ?? '',
    danceSeparationBarcodesNote: data.danceSeparationBarcodesNote ?? '',
    danceSeparationWedding: data.danceSeparationWedding ?? '',
    danceSeparationWeddingNote: data.danceSeparationWeddingNote ?? '',
    slowDance: data.slowDance ?? '',
    slowDanceNote: data.slowDanceNote ?? '',
    menus: data.menus ?? '',
    menusNote: data.menusNote ?? '',
    kippot: data.kippot ?? '',
    kippotNote: data.kippotNote ?? '',
    fans: data.fans ?? '',
    organizationBaskets: data.organizationBaskets ?? '',
    grapeJuice: data.grapeJuice ?? '',
    sunglasses: data.sunglasses ?? '',
    gummiesAndTools: data.gummiesAndTools ?? '',
    fansNote: data.fansNote ?? '',
    organizationBasketsNote: data.organizationBasketsNote ?? '',
    grapeJuiceNote: data.grapeJuiceNote ?? '',
    sunglassesNote: data.sunglassesNote ?? '',
    gummiesAndToolsNote: data.gummiesAndToolsNote ?? '',
    groomPrepLocation: data.groomPrepLocation ?? '',
    groomEscortPhone: typeof data.groomEscortPhone === 'number' ? data.groomEscortPhone : 0,
    bridePrepLocation: data.bridePrepLocation ?? '',
    brideEscortPhone: typeof data.brideEscortPhone === 'number' ? data.brideEscortPhone : 0,
    arrivalTimeToHall: data.arrivalTimeToHall ?? '',
    brideLook1Makeup: data.brideLook1Makeup ?? '',
    brideLook1Hair: data.brideLook1Hair ?? '',
    brideLook2Makeup: data.brideLook2Makeup ?? '',
    brideLook2Hair: data.brideLook2Hair ?? '',
    brideLook3Makeup: data.brideLook3Makeup ?? '',
    brideLook3Hair: data.brideLook3Hair ?? '',
    brideNotes: data.brideNotes ?? '',
    suppliers: Array.isArray(data.suppliers)
      ? data.suppliers.map((supplier) => ({
          id: typeof supplier?.id === 'string' ? supplier.id : `${docSnap.id}-${Math.random()}`,
          role: typeof supplier?.role === 'string' ? supplier.role : '',
          name: typeof supplier?.name === 'string' ? supplier.name : '',
          phone: typeof supplier?.phone === 'number' ? supplier.phone : 0,
          hours: typeof supplier?.hours === 'string' ? supplier.hours : '',
          totalPayment:
            typeof supplier?.totalPayment === 'number' ? supplier.totalPayment : undefined,
          deposit: typeof supplier?.deposit === 'number' ? supplier.deposit : undefined,
          balance: typeof supplier?.balance === 'number' ? supplier.balance : undefined,
          paymentReceivedAmount:
            typeof supplier?.paymentReceivedAmount === 'number'
              ? supplier.paymentReceivedAmount
              : undefined,
          paymentReceivedHours:
            typeof supplier?.paymentReceivedHours === 'string'
              ? supplier.paymentReceivedHours
              : '',
          paymentReceivedDate:
            typeof supplier?.paymentReceivedDate === 'string'
              ? supplier.paymentReceivedDate
              : '',
          paymentReceivedName:
            typeof supplier?.paymentReceivedName === 'string'
              ? supplier.paymentReceivedName
              : '',
          paymentReceivedSignature:
            typeof supplier?.paymentReceivedSignature === 'string'
              ? supplier.paymentReceivedSignature
              : '',
          hasSigned: typeof supplier?.hasSigned === 'boolean' ? supplier.hasSigned : false
        }))
      : []
  }
}

export function subscribeToUserEvents(
  db: Firestore,
  user: User,
  onNext: (events: EventRecord[]) => void,
  onError: (error: Error) => void
) {
  console.info('[events] subscribe start', { ownerId: user.uid })
  const eventsRef = collection(db, 'events')
  const q = query(eventsRef, where('ownerId', '==', user.uid), orderBy('date', 'asc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const next = snapshot.docs.map((docSnap) => normalizeEvent(docSnap, user.uid))
      console.info('[events] subscribe snapshot', {
        ownerId: user.uid,
        count: next.length
      })
      onNext(next)
    },
    (error) => {
      console.error('[events] subscribe error', { ownerId: user.uid, error })
      onError(error)
    }
  )
}

export async function saveEventForUser(
  db: Firestore,
  user: User,
  payload: EventPayload,
  eventId?: string
) {
  try {
    console.info('[events] save start', {
      ownerId: user.uid,
      eventId: eventId ?? 'new'
    })
    const basePayload = {
      ...payload,
      ownerId: user.uid,
      updatedAt: serverTimestamp()
    }
    if (eventId) {
      const ref = doc(db, 'events', eventId)
      await updateDoc(ref, basePayload)
      console.info('[events] save success', { ownerId: user.uid, eventId })
      return eventId
    }

    const created = await addDoc(collection(db, 'events'), {
      ...basePayload,
      createdAt: serverTimestamp()
    })
    console.info('[events] save success', { ownerId: user.uid, eventId: created.id })
    return created.id
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[events] save error', {
      ownerId: user.uid,
      eventId: eventId ?? 'new',
      error: errorMessage
    })
    throw new Error(`Failed to save event: ${errorMessage}`)
  }
}

export async function deleteEventById(db: Firestore, eventId: string) {
  try {
    await deleteDoc(doc(db, 'events', eventId))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to delete event: ${errorMessage}`)
  }
}
