import React, { useEffect, useMemo, useState } from 'react'
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth'
import { doc, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { firebaseConfig, getFirebaseApp, isFirebaseConfigReady } from './externalApi/firebase'
import {
  deleteEventById,
  saveEventForUser,
  subscribeToUserEvents
} from './externalApi/events'
import { addMeetingForUser, subscribeToUserMeetings } from './externalApi/meetings'
import {
  addRecommendedSupplierForUser,
  subscribeToUserRecommendedSuppliers
} from './externalApi/recommendedSuppliers'
import type { EventRecord, MeetingRecord, RecommendedSupplierRecord } from './controlers/types'
import LoginView from './view/LoginView'
import EventsHome from './view/EventsHome'
import EventDetailView from './view/EventDetailView'
import EventEditorView from './view/EventEditorView'
import AppShell from './view/AppShell'
import ProtectedRoute from './view/ProtectedRoute'
import MeetingsView from './view/MeetingsView'
import RecommendedSuppliersView from './view/RecommendedSuppliersView'

function useEvents(db: ReturnType<typeof getFirestore> | null, user: User | null) {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [eventsBusy, setEventsBusy] = useState(false)
  const [eventsError, setEventsError] = useState('')

  useEffect(() => {
    if (!db || !user) {
      setEvents([])
      setEventsBusy(false)
      setEventsError('')
      return
    }
    setEventsBusy(true)
    setEventsError('')
    return subscribeToUserEvents(
      db,
      user,
      (next) => {
        setEvents(next)
        setEventsBusy(false)
      },
      (error) => {
        setEventsError(error.message)
        setEventsBusy(false)
      }
    )
  }, [db, user])

  return { events, eventsBusy, eventsError }
}

function useMeetings(db: ReturnType<typeof getFirestore> | null, user: User | null) {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [meetingsBusy, setMeetingsBusy] = useState(false)
  const [meetingsError, setMeetingsError] = useState('')

  useEffect(() => {
    if (!db || !user) {
      setMeetings([])
      setMeetingsBusy(false)
      setMeetingsError('')
      return
    }
    setMeetingsBusy(true)
    setMeetingsError('')
    return subscribeToUserMeetings(
      db,
      user,
      (next) => {
        setMeetings(next)
        setMeetingsBusy(false)
      },
      (error) => {
        setMeetingsError(error.message)
        setMeetingsBusy(false)
      }
    )
  }, [db, user])

  return { meetings, meetingsBusy, meetingsError }
}

function useRecommendedSuppliers(db: ReturnType<typeof getFirestore> | null, user: User | null) {
  const [recommendedSuppliers, setRecommendedSuppliers] = useState<RecommendedSupplierRecord[]>([])
  const [recommendedBusy, setRecommendedBusy] = useState(false)
  const [recommendedError, setRecommendedError] = useState('')

  useEffect(() => {
    if (!db || !user) {
      setRecommendedSuppliers([])
      setRecommendedBusy(false)
      setRecommendedError('')
      return
    }
    setRecommendedBusy(true)
    setRecommendedError('')
    return subscribeToUserRecommendedSuppliers(
      db,
      user,
      (next) => {
        setRecommendedSuppliers(next)
        setRecommendedBusy(false)
      },
      (error) => {
        setRecommendedError(error.message)
        setRecommendedBusy(false)
      }
    )
  }, [db, user])

  return { recommendedSuppliers, recommendedBusy, recommendedError }
}

function EventDetailRoute({
  events,
  onBack,
  onEdit,
  onScheduleMeeting,
  eventMode,
  onSignSupplier
}: {
  events: EventRecord[]
  onBack: () => void
  onEdit: (eventId: string) => void
  onScheduleMeeting: (coupleName: string) => void
  eventMode: boolean
  onSignSupplier: (
    eventId: string,
    supplierId: string,
    payload: {
      paymentReceivedAmount?: number
      paymentReceivedHours?: string
      paymentReceivedDate?: string
      paymentReceivedName?: string
      paymentReceivedSignature?: string
      hasSigned?: boolean
    }
  ) => Promise<void>
}) {
  const { eventId } = useParams()
  const event = events.find((item) => item.id === eventId)

  if (!event) {
    return <div className="empty">לא נמצא אירוע</div>
  }

  return (
    <EventDetailView
      event={event}
      onBack={onBack}
      onEdit={() => onEdit(event.id)}
      onScheduleMeeting={() => onScheduleMeeting(event.coupleName || '')}
      eventMode={eventMode}
      onSignSupplier={onSignSupplier}
    />
  )
}

function EventEditRoute({
  events,
  onSave,
  onDelete,
  mode
}: {
  events: EventRecord[]
  onSave: (payload: Omit<EventRecord, 'id'>, eventId?: string) => Promise<void>
  onDelete: (eventId: string, coupleName: string) => Promise<void> | void
  mode: 'new' | 'edit'
}) {
  const { eventId } = useParams()
  const event = events.find((item) => item.id === eventId)
  const navigate = useNavigate()

  return (
    <EventEditorView
      event={event}
      onCancel={() => {
        if (mode === 'edit' && event?.id) navigate(`/events/${event.id}`)
        else navigate('/events')
      }}
      onSave={(payload) => onSave(payload, event?.id)}
      onDelete={(id, coupleName) => onDelete(id, coupleName)}
    />
  )
}

export default function App() {
  const app = getFirebaseApp()
  const [user, setUser] = useState<User | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authReady, setAuthReady] = useState(false)
  const [eventMode, setEventMode] = useState(false)
  const db = useMemo(() => (app ? getFirestore(app) : null), [app])
  const auth = useMemo(() => (app ? getAuth(app) : null), [app])
  const navigate = useNavigate()
  const location = useLocation()

  const { events, eventsBusy, eventsError } = useEvents(db, user)
  const { meetings, meetingsBusy, meetingsError } = useMeetings(db, user)
  const { recommendedSuppliers, recommendedBusy, recommendedError } = useRecommendedSuppliers(db, user)

  useEffect(() => {
    if (!auth) return
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // fallback to default in-memory if persistence fails
    })
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthBusy(false)
      setAuthReady(true)
    })
  }, [auth])


  const handleLogin = async (email: string, password: string) => {
    if (!auth) return
    setAuthBusy(true)
    setAuthError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/events', { replace: true })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    if (!auth) return
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  const handleSaveEvent = async (payload: Omit<EventRecord, 'id'>, eventId?: string) => {
    if (!db) {
      throw new Error('Firestore is not initialized. Check Firebase config/env.')
    }
    if (!user) {
      throw new Error('User not authenticated.')
    }
    try {
      await saveEventForUser(db, user, payload, eventId)
    } catch (error) {
      throw error
    }
  }

  const handleDeleteEvent = async (eventId: string, coupleName: string) => {
    if (!db) {
      throw new Error('Firestore is not initialized. Check Firebase config/env.')
    }
    if (!user) {
      throw new Error('User not authenticated.')
    }
    try {
      await deleteEventById(db, eventId)
      window.alert('האירוע נמחק בהצלחה')
    } catch (error) {
      throw error
    }
  }

  const handleAddMeeting = async (payload: Omit<MeetingRecord, 'id'>) => {
    if (!db) {
      throw new Error('Firestore is not initialized. Check Firebase config/env.')
    }
    if (!user) {
      throw new Error('User not authenticated.')
    }
    try {
      await addMeetingForUser(db, user, payload)
    } catch (error) {
      throw error
    }
  }

  const handleSignSupplier = async (
    eventId: string,
    supplierId: string,
    payload: {
      paymentReceivedAmount?: number
      paymentReceivedHours?: string
      paymentReceivedDate?: string
      paymentReceivedName?: string
      paymentReceivedSignature?: string
      hasSigned?: boolean
    }
  ) => {
    if (!db) {
      throw new Error('Firestore is not initialized. Check Firebase config/env.')
    }
    try {
      const targetEvent = events.find((item) => item.id === eventId)
      if (!targetEvent || !targetEvent.suppliers) {
        throw new Error('Event or suppliers not found.')
      }
      const updatedSuppliers = targetEvent.suppliers.map((supplier) =>
        supplier.id === supplierId ? { ...supplier, ...payload } : supplier
      )
      await updateDoc(doc(db, 'events', eventId), {
        suppliers: updatedSuppliers,
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      throw error
    }
  }

  const handleAddRecommendedSupplier = async (
    payload: Omit<RecommendedSupplierRecord, 'id' | 'ownerId'>
  ) => {
    if (!db) {
      throw new Error('Firestore is not initialized. Check Firebase config/env.')
    }
    if (!user) {
      throw new Error('User not authenticated.')
    }
    try {
      await addRecommendedSupplierForUser(db, user, payload)
    } catch (error) {
      throw error
    }
  }

  if (!isFirebaseConfigReady(firebaseConfig)) {
    return (
      <div className="shell">
        <div className="panel">
          <h1>צריך להגדיר Firebase</h1>
          <p>
            כדי להתחיל, הוסף ערכי <code>.env</code> ל-Vite (למשל{' '}
            <code>VITE_FIREBASE_API_KEY</code>). לאחר מכן רענן את הדף.
          </p>
          <div className="hint">
            <p>משתנים נדרשים:</p>
            <ul>
              <li><code>VITE_FIREBASE_API_KEY</code></li>
              <li><code>VITE_FIREBASE_AUTH_DOMAIN</code></li>
              <li><code>VITE_FIREBASE_PROJECT_ID</code></li>
              <li><code>VITE_FIREBASE_STORAGE_BUCKET</code></li>
              <li><code>VITE_FIREBASE_MESSAGING_SENDER_ID</code></li>
              <li><code>VITE_FIREBASE_APP_ID</code></li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginView onLogin={handleLogin} busy={authBusy} error={authError} />}
      />

      <Route element={<ProtectedRoute user={user} ready={authReady} redirectTo="/login" />}>
        <Route
          element={
            <AppShell
              userEmail={user?.email}
              eventsCount={events.length}
              meetingsCount={meetings.length}
              eventsBusy={eventsBusy}
              onLogout={handleLogout}
              onNewEvent={() => {
                if (location.pathname === '/events/new') return
                navigate('/events/new')
              }}
              eventMode={eventMode}
              onToggleEventMode={() => setEventMode((prev) => !prev)}
            />
          }
        >
          <Route
            path="/events"
            element={
              <EventsHome
                events={events}
                busy={eventsBusy}
                error={eventsError}
                onSelect={(eventId) => navigate(`/events/${eventId}`)}
                eventMode={eventMode}
              />
            }
          />
          <Route
            path="/events/:eventId"
            element={
              <EventDetailRoute
                events={events}
                onBack={() => navigate('/events')}
                onEdit={(eventId) => navigate(`/events/${eventId}/edit`)}
                onScheduleMeeting={(coupleName) =>
                  navigate('/meetings', { state: { presetCoupleName: coupleName } })
                }
                eventMode={eventMode}
                onSignSupplier={handleSignSupplier}
              />
            }
          />
          <Route
            path="/events/new"
            element={
              <EventEditRoute
                events={events}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                mode="new"
              />
            }
          />
          <Route
            path="/meetings"
            element={
              <MeetingsView
                meetings={meetings}
                busy={meetingsBusy}
                error={meetingsError}
                onAdd={handleAddMeeting}
              />
            }
          />
          <Route
            path="/recommended"
            element={
              <RecommendedSuppliersView
                suppliers={recommendedSuppliers}
                busy={recommendedBusy}
                error={recommendedError}
                onAdd={handleAddRecommendedSupplier}
              />
            }
          />
          <Route
            path="/events/:eventId/edit"
            element={
              <EventEditRoute
                events={events}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                mode="edit"
              />
            }
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={user ? '/events' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/events' : '/login'} replace />} />
    </Routes>
  )
}
