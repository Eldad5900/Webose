import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EventRecord, MeetingRecord } from '../controlers/types'

type AgendaSummary = {
  title: string
  notificationBody: string
  phoneMessage: string
  meetingsCount: number
  eventsCount: number
}

type AlertSettingsPayload = {
  phone?: string | null
  time?: string | null
}

const ALERTS_PHONE_STORAGE_KEY = 'webose:alerts:phone'
const ALERTS_TIME_STORAGE_KEY = 'webose:alerts:time'
const ALERTS_PERMISSION_PROMPTED_STORAGE_KEY = 'webose:alerts:permission-prompted'
const DEFAULT_ALERT_TIME = '08:00'

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateKey(rawValue: string) {
  if (!rawValue) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue
  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) return ''
  return formatDateKey(parsed)
}

function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeAlertTime(value?: string | null) {
  const candidate = value?.trim() ?? ''
  if (!/^\d{2}:\d{2}$/.test(candidate)) return DEFAULT_ALERT_TIME
  const [hourText, minuteText] = candidate.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return DEFAULT_ALERT_TIME
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return DEFAULT_ALERT_TIME
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function toWhatsAppPhone(phone?: string | null) {
  const digits = normalizePhoneInput(phone ?? '')
  if (!digits) return null
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return `972${digits.slice(1)}`
  if (digits.length >= 8) return `972${digits}`
  return null
}

function buildAgendaSummary({
  meetings,
  events,
  now,
  alertLabel
}: {
  meetings: MeetingRecord[]
  events: EventRecord[]
  now: Date
  alertLabel: string
}): AgendaSummary | null {
  const todayKey = formatDateKey(now)
  const meetingsToday = meetings
    .filter((meeting) => toDateKey(meeting.date) === todayKey)
    .sort((first, second) => `${first.time}`.localeCompare(`${second.time}`))
  const eventsToday = events.filter((event) => toDateKey(event.date) === todayKey)

  if (!meetingsToday.length && !eventsToday.length) return null

  const title = `תזכורת יומית ${alertLabel}`
  const notificationBody = `להיום: ${meetingsToday.length} פגישות, ${eventsToday.length} אירועים`

  const meetingLines = meetingsToday.map(
    (meeting) =>
      `• ${meeting.time || '--:--'} | ${meeting.coupleName || 'זוג ללא שם'} | ${meeting.location || 'מיקום לא הוגדר'}`
  )
  const eventLines = eventsToday.map(
    (event) => `• ${event.coupleName || 'אירוע ללא שם'} | ${event.hall || 'אולם לא הוגדר'}`
  )

  const phoneMessage = [
    `תזכורת יומית ${alertLabel}`,
    notificationBody,
    meetingsToday.length ? 'פגישות היום:' : '',
    ...meetingLines,
    eventsToday.length ? 'אירועים היום:' : '',
    ...eventLines
  ]
    .filter((line) => Boolean(line))
    .join('\n')

  return {
    title,
    notificationBody,
    phoneMessage,
    meetingsCount: meetingsToday.length,
    eventsCount: eventsToday.length
  }
}

export default function useHourlyAgendaAlerts({
  enabled,
  meetings,
  events,
  loadPersistedAlertSettings,
  savePersistedAlertSettings
}: {
  enabled: boolean
  meetings: MeetingRecord[]
  events: EventRecord[]
  loadPersistedAlertSettings?: () => Promise<AlertSettingsPayload | null>
  savePersistedAlertSettings?: (payload: Required<AlertSettingsPayload>) => Promise<void>
}) {
  const [alertsPhone, setAlertsPhone] = useState('')
  const [alertsTime, setAlertsTime] = useState(DEFAULT_ALERT_TIME)
  const [lastNotice, setLastNotice] = useState('')
  const [pendingPhoneAlertUrl, setPendingPhoneAlertUrl] = useState('')
  const lastTriggeredSlotRef = useRef('')
  const canUseNotifications = typeof window !== 'undefined' && 'Notification' in window

  const notificationPermission = useMemo(() => {
    if (!canUseNotifications) return 'unsupported' as const
    return window.Notification.permission
  }, [canUseNotifications])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedPhone = window.localStorage.getItem(ALERTS_PHONE_STORAGE_KEY) ?? ''
    const storedTime = window.localStorage.getItem(ALERTS_TIME_STORAGE_KEY)
    setAlertsPhone(normalizePhoneInput(storedPhone))
    setAlertsTime(normalizeAlertTime(storedTime))
  }, [])

  useEffect(() => {
    if (!loadPersistedAlertSettings || typeof window === 'undefined') return
    let cancelled = false

    const loadSettings = async () => {
      try {
        const persisted = await loadPersistedAlertSettings()
        if (!persisted || cancelled) return

        const normalizedPhone = normalizePhoneInput(persisted.phone ?? '')
        const normalizedTime = normalizeAlertTime(persisted.time)

        setAlertsPhone(normalizedPhone)
        setAlertsTime(normalizedTime)

        if (normalizedPhone) {
          window.localStorage.setItem(ALERTS_PHONE_STORAGE_KEY, normalizedPhone)
        } else {
          window.localStorage.removeItem(ALERTS_PHONE_STORAGE_KEY)
        }
        window.localStorage.setItem(ALERTS_TIME_STORAGE_KEY, normalizedTime)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'טעינת הגדרות התראה נכשלה'
        setLastNotice(message)
      }
    }

    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [loadPersistedAlertSettings])

  const requestNotificationsPermission = useCallback(async () => {
    if (!canUseNotifications) {
      setLastNotice('הדפדפן לא תומך בהתראות מערכת.')
      return
    }
    const result = await window.Notification.requestPermission()
    if (result === 'granted') {
      setLastNotice('התראות מערכת אושרו בהצלחה.')
      return
    }
    if (result === 'denied') {
      setLastNotice('התראות נחסמו. ניתן לאפשר אותן מהגדרות הדפדפן.')
      return
    }
    setLastNotice('הרשאת התראות עדיין לא אושרה.')
  }, [canUseNotifications])

  const saveAlertSettings = useCallback(async (phoneInput: string, alertTimeInput: string) => {
    if (typeof window === 'undefined') return
    const normalized = normalizePhoneInput(phoneInput)
    const normalizedTime = normalizeAlertTime(alertTimeInput)
    setAlertsTime(normalizedTime)
    window.localStorage.setItem(ALERTS_TIME_STORAGE_KEY, normalizedTime)

    if (!normalized) {
      setAlertsPhone('')
      window.localStorage.removeItem(ALERTS_PHONE_STORAGE_KEY)
      try {
        await savePersistedAlertSettings?.({ phone: '', time: normalizedTime })
        setLastNotice(`שעת ההתראה נשמרה ל-${normalizedTime}. טלפון ההתראות הוסר.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'שמירת הגדרות התראה נכשלה'
        setLastNotice(message)
      }
      return
    }
    setAlertsPhone(normalized)
    window.localStorage.setItem(ALERTS_PHONE_STORAGE_KEY, normalized)
    try {
      await savePersistedAlertSettings?.({ phone: normalized, time: normalizedTime })
      setLastNotice(`הגדרות נשמרו: טלפון ${normalized}, שעת התראה ${normalizedTime}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'שמירת הגדרות התראה נכשלה'
      setLastNotice(message)
    }
  }, [savePersistedAlertSettings])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !canUseNotifications) return
    if (window.Notification.permission !== 'default') return

    const wasPrompted = window.localStorage.getItem(ALERTS_PERMISSION_PROMPTED_STORAGE_KEY) === '1'
    if (wasPrompted) return

    window.localStorage.setItem(ALERTS_PERMISSION_PROMPTED_STORAGE_KEY, '1')
    void requestNotificationsPermission()
  }, [canUseNotifications, enabled, requestNotificationsPermission])

  const sendPendingPhoneAlert = useCallback(() => {
    if (!pendingPhoneAlertUrl) return
    window.open(pendingPhoneAlertUrl, '_blank', 'noopener,noreferrer')
  }, [pendingPhoneAlertUrl])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setPendingPhoneAlertUrl('')
      return
    }

    const triggerDailyAlerts = () => {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (currentTime !== alertsTime) return

      const slotKey = `${formatDateKey(now)}-${alertsTime}`
      if (lastTriggeredSlotRef.current === slotKey) return
      lastTriggeredSlotRef.current = slotKey

      const summary = buildAgendaSummary({ meetings, events, now, alertLabel: alertsTime })
      if (!summary) return

      setLastNotice(
        `תזכורת יומית ${alertsTime}: ${summary.meetingsCount} פגישות ו-${summary.eventsCount} אירועים מתוכננים להיום.`
      )

      if (canUseNotifications && window.Notification.permission === 'granted') {
        const notification = new window.Notification(summary.title, {
          body: summary.notificationBody
        })
        notification.onclick = () => window.focus()
      }

      const whatsappPhone = toWhatsAppPhone(alertsPhone)
      if (whatsappPhone) {
        const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(summary.phoneMessage)}`
        setPendingPhoneAlertUrl(url)
      } else {
        setPendingPhoneAlertUrl('')
      }
    }

    triggerDailyAlerts()
    const timer = window.setInterval(triggerDailyAlerts, 60_000)
    return () => {
      window.clearInterval(timer)
    }
  }, [alertsPhone, alertsTime, canUseNotifications, enabled, events, meetings])

  return {
    alertsPhone,
    alertsTime,
    lastNotice,
    pendingPhoneAlertUrl,
    notificationPermission,
    saveAlertSettings,
    sendPendingPhoneAlert
  }
}
