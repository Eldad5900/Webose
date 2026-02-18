import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { EventRecord, MeetingRecord, RecommendedSupplierRecord } from './controlers/types'
import { deleteEventById, saveEventForUser, subscribeToUserEvents } from './externalApi/events'
import { addMeetingForUser, subscribeToUserMeetings } from './externalApi/meetings'
import {
  addRecommendedSupplierForUser,
  subscribeToUserRecommendedSuppliers
} from './externalApi/recommendedSuppliers'
import { firebaseConfig, getFirebaseApp, isFirebaseConfigReady } from './externalApi/firebase'
import useRealtimeCollection from './hooks/useRealtimeCollection'
import useHourlyAgendaAlerts from './hooks/useHourlyAgendaAlerts'
import LoginView from './view/LoginView'
import EventsHome from './view/EventsHome'
import AppShell from './view/AppShell'
import ProtectedRoute from './view/ProtectedRoute'
import MeetingsView from './view/MeetingsView'
import RecommendedSuppliersView from './view/RecommendedSuppliersView'
import EventDetailRoute from './routes/EventDetailRoute'
import EventEditRoute from './routes/EventEditRoute'
import type { SupplierSignaturePayload } from './types/supplierSigning'

type ThemeMode = 'light' | 'dark'
const THEME_STORAGE_KEY = 'webose:theme-mode'

function ensureFirestore(db: ReturnType<typeof getFirestore> | null) {
  if (!db) {
    throw new Error('Firestore is not initialized. Check Firebase config/env.')
  }
  return db
}

function ensureAuthenticatedUser(user: User | null) {
  if (!user) {
    throw new Error('User not authenticated.')
  }
  return user
}

export default function App() {
  const app = getFirebaseApp()
  const [user, setUser] = useState<User | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authReady, setAuthReady] = useState(false)
  const [eventMode, setEventMode] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })

  const db = useMemo(() => (app ? getFirestore(app) : null), [app])
  const auth = useMemo(() => (app ? getAuth(app) : null), [app])
  const navigate = useNavigate()
  const location = useLocation()

  const subscribeEvents = useCallback(
    (onNext: (items: EventRecord[]) => void, onError: (error: Error) => void) => {
      if (!db || !user) return
      return subscribeToUserEvents(db, user, onNext, onError)
    },
    [db, user]
  )

  const subscribeMeetings = useCallback(
    (onNext: (items: MeetingRecord[]) => void, onError: (error: Error) => void) => {
      if (!db || !user) return
      return subscribeToUserMeetings(db, user, onNext, onError)
    },
    [db, user]
  )

  const subscribeRecommendedSuppliers = useCallback(
    (
      onNext: (items: RecommendedSupplierRecord[]) => void,
      onError: (error: Error) => void
    ) => {
      if (!db || !user) return
      return subscribeToUserRecommendedSuppliers(db, user, onNext, onError)
    },
    [db, user]
  )

  const {
    items: events,
    busy: eventsBusy,
    error: eventsError
  } = useRealtimeCollection<EventRecord>({
    enabled: Boolean(db && user),
    subscribe: subscribeEvents
  })

  const {
    items: meetings,
    busy: meetingsBusy,
    error: meetingsError
  } = useRealtimeCollection<MeetingRecord>({
    enabled: Boolean(db && user),
    subscribe: subscribeMeetings
  })

  const {
    items: recommendedSuppliers,
    busy: recommendedBusy,
    error: recommendedError
  } = useRealtimeCollection<RecommendedSupplierRecord>({
    enabled: Boolean(db && user),
    subscribe: subscribeRecommendedSuppliers
  })

  const {
    alertsPhone,
    alertsTime,
    lastNotice: alertsNotice,
    pendingPhoneAlertUrl,
    notificationPermission,
    saveAlertSettings,
    sendPendingPhoneAlert
  } = useHourlyAgendaAlerts({
    enabled: Boolean(user && authReady),
    meetings,
    events
  })

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

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    document.documentElement.setAttribute('data-theme', themeMode)
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

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
    const safeDb = ensureFirestore(db)
    const safeUser = ensureAuthenticatedUser(user)
    await saveEventForUser(safeDb, safeUser, payload, eventId)
  }

  const handleDeleteEvent = async (eventId: string, _coupleName: string) => {
    const safeDb = ensureFirestore(db)
    ensureAuthenticatedUser(user)
    await deleteEventById(safeDb, eventId)
    window.alert('האירוע נמחק בהצלחה')
  }

  const handleAddMeeting = async (payload: Omit<MeetingRecord, 'id'>) => {
    const safeDb = ensureFirestore(db)
    const safeUser = ensureAuthenticatedUser(user)
    await addMeetingForUser(safeDb, safeUser, payload)
  }

  const handleSignSupplier = async (
    eventId: string,
    supplierId: string,
    payload: SupplierSignaturePayload
  ) => {
    const safeDb = ensureFirestore(db)

    const targetEvent = events.find((item) => item.id === eventId)
    if (!targetEvent || !targetEvent.suppliers) {
      throw new Error('Event or suppliers not found.')
    }

    const updatedSuppliers = targetEvent.suppliers.map((supplier) =>
      supplier.id === supplierId ? { ...supplier, ...payload } : supplier
    )

    await updateDoc(doc(safeDb, 'events', eventId), {
      suppliers: updatedSuppliers,
      updatedAt: serverTimestamp()
    })
  }

  const handleAddRecommendedSupplier = async (
    payload: Omit<RecommendedSupplierRecord, 'id' | 'ownerId'>
  ) => {
    const safeDb = ensureFirestore(db)
    const safeUser = ensureAuthenticatedUser(user)
    await addRecommendedSupplierForUser(safeDb, safeUser, payload)
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
              <li>
                <code>VITE_FIREBASE_API_KEY</code>
              </li>
              <li>
                <code>VITE_FIREBASE_AUTH_DOMAIN</code>
              </li>
              <li>
                <code>VITE_FIREBASE_PROJECT_ID</code>
              </li>
              <li>
                <code>VITE_FIREBASE_STORAGE_BUCKET</code>
              </li>
              <li>
                <code>VITE_FIREBASE_MESSAGING_SENDER_ID</code>
              </li>
              <li>
                <code>VITE_FIREBASE_APP_ID</code>
              </li>
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
              alertsPhone={alertsPhone}
              alertsTime={alertsTime}
              alertsNotice={alertsNotice}
              hasPendingPhoneAlert={Boolean(pendingPhoneAlertUrl)}
              notificationsPermission={notificationPermission}
              onSaveAlertSettings={saveAlertSettings}
              onSendPendingPhoneAlert={sendPendingPhoneAlert}
              themeMode={themeMode}
              onToggleTheme={() =>
                setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))
              }
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
                onScheduleMeeting={({ eventId, coupleName, contactPhone }) =>
                  navigate('/meetings', {
                    state: {
                      presetEventId: eventId,
                      presetCoupleName: coupleName,
                      presetContactPhone: contactPhone ?? null
                    }
                  })
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

          <Route
            path="/meetings"
            element={
              <MeetingsView
                meetings={meetings}
                events={events}
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
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={user ? '/events' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/events' : '/login'} replace />} />
    </Routes>
  )
}
