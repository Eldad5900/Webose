import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EventRecord, SupplierRecord } from '../controlers/types'
import type { SupplierSignaturePayload } from '../types/supplierSigning'

type SupplierSignatureModalState = {
  supplierId: string
  supplierName: string
  amount: string
  startHour: string
  endHour: string
  signature: string
}

type LabeledValue = {
  label: string
  value: string
}

type WakeLockSentinelLike = {
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

function hasValue(value?: string | null) {
  return Boolean(value && value.trim() !== '')
}

function formatDate(value: string) {
  if (!value) return 'לא נקבע'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(parsed)
}

function formatMoney(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'לא הוגדר'
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0
  }).format(value)
}

function formatPhone(phone?: number) {
  if (!phone || phone <= 0) return 'לא הוגדר'
  return `${phone}`
}

function supplierPaidAmount(supplier: SupplierRecord) {
  if (typeof supplier.paymentReceivedAmount === 'number') return supplier.paymentReceivedAmount
  if (typeof supplier.deposit === 'number') return supplier.deposit
  return 0
}

function supplierRemainingAmount(supplier: SupplierRecord) {
  const paidAmount = supplierPaidAmount(supplier)
  if (typeof supplier.totalPayment === 'number') {
    return Math.max(supplier.totalPayment - paidAmount, 0)
  }
  if (typeof supplier.balance === 'number') {
    return Math.max(supplier.balance, 0)
  }
  return null
}

function supplierSignatureDefaultAmount(supplier: SupplierRecord) {
  if (typeof supplier.balance === 'number') return Math.max(supplier.balance, 0)
  return supplierRemainingAmount(supplier)
}

function normalizeChoice(value?: string | null) {
  return value?.trim() ?? ''
}

function checklistDisplay(value?: string | null, note?: string | null) {
  const normalized = normalizeChoice(value)
  if (!normalized || normalized === 'לא' || normalized === 'לא קיים') return ''
  if (normalized === 'כן אבל') {
    return hasValue(note) ? `כן אבל · ${note?.trim()}` : 'כן אבל'
  }
  return normalized
}

function toTimeSortValue(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return Number.MAX_SAFE_INTEGER
  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER
  return hour * 60 + minute
}

export default function EventDetailView({
  event,
  onBack,
  onEdit,
  onScheduleMeeting,
  eventMode,
  onSignSupplier
}: {
  event: EventRecord
  onBack: () => void
  onEdit: () => void
  onScheduleMeeting: () => void
  eventMode: boolean
  onSignSupplier: (
    eventId: string,
    supplierId: string,
    payload: SupplierSignaturePayload
  ) => Promise<void>
}) {
  const [signatureModal, setSignatureModal] = useState<SupplierSignatureModalState | null>(null)
  const [signatureSaving, setSignatureSaving] = useState(false)
  const [liveScreenLocked, setLiveScreenLocked] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [wakeLockError, setWakeLockError] = useState('')
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const signatureDrawingRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)

  const suppliers = event.suppliers ?? []
  const sortedSuppliers = useMemo(
    () =>
      [...suppliers].sort(
        (first, second) => toTimeSortValue(first.hours) - toTimeSortValue(second.hours)
      ),
    [suppliers]
  )

  const totalSuppliersAmount = suppliers.reduce((sum, supplier) => {
    return sum + (typeof supplier.totalPayment === 'number' ? supplier.totalPayment : 0)
  }, 0)
  const paidSuppliersAmount = suppliers.reduce((sum, supplier) => sum + supplierPaidAmount(supplier), 0)
  const remainingSuppliersAmount = Math.max(totalSuppliersAmount - paidSuppliersAmount, 0)
  const signedSuppliersCount = suppliers.filter((supplier) => supplier.hasSigned).length

  const timelineFields = [
    { label: 'הגעה לאולם', value: event.arrivalTimeToHall },
    { label: 'מי ממתין בחופה', value: event.waitingAtChuppah },
    { label: 'שיר כניסת חתן', value: event.groomEntrySong },
    { label: 'שיר כניסת כלה', value: event.brideEntrySong },
    { label: 'שבירת כוס', value: event.glassBreakSong },
    { label: 'אחרי טבעות', value: event.afterRings },
    { label: 'ריקוד סלואו', value: event.slowDance }
  ].filter((item) => hasValue(item.value))

  const liveOpeningFields = [
    { label: 'תאריך האירוע', value: formatDate(event.date) },
    { label: 'מיקום האירוע', value: event.hall || 'לא הוגדר' },
    { label: 'שעת הגעה לאולם', value: event.arrivalTimeToHall || 'לא הוגדר' },
    { label: 'סטטוס', value: event.status || 'בתהליך' },
    {
      label: 'כמות אורחים',
      value: typeof event.guests === 'number' && event.guests > 0 ? String(event.guests) : 'לא הוגדר'
    }
  ]

  const liveContacts = useMemo(() => {
    const contacts: LabeledValue[] = []

    if (event.contactPhone && event.contactPhone > 0) {
      contacts.push({ label: 'טלפון קשר ראשי', value: formatPhone(event.contactPhone) })
    }

    const pushContact = (label: string, name?: string, phone?: number) => {
      const parts: string[] = []
      if (hasValue(name)) parts.push(name!.trim())
      if (phone && phone > 0) parts.push(formatPhone(phone))
      if (!parts.length) return
      contacts.push({ label, value: parts.join(' · ') })
    }

    pushContact('חתן', event.groomName)
    pushContact('כלה', event.brideName)
    pushContact('מלווה חתן', event.groomEscort, event.groomEscortPhone)
    pushContact('מלווה כלה', event.brideEscort, event.brideEscortPhone)
    pushContact('אב החתן', event.groomFatherName, event.groomFatherPhone)
    pushContact('אם החתן', event.groomMotherName, event.groomMotherPhone)
    pushContact('אב הכלה', event.brideFatherName, event.brideFatherPhone)
    pushContact('אם הכלה', event.brideMotherName, event.brideMotherPhone)

    return contacts
  }, [event])

  const liveCeremonyFlow = useMemo(() => {
    const items: LabeledValue[] = [
      { label: 'חתן - מיקום התארגנות', value: event.groomPrepLocation || '' },
      { label: 'כלה - מיקום התארגנות', value: event.bridePrepLocation || '' },
      { label: 'הגעה לאולם', value: event.arrivalTimeToHall || '' },
      { label: 'מי ממתין בחופה', value: event.waitingAtChuppah || '' },
      { label: 'שיר כניסת חתן', value: event.groomEntrySong || '' },
      { label: 'שיר כניסת כלה', value: event.brideEntrySong || '' },
      { label: 'שיר שבירת כוס', value: event.glassBreakSong || '' },
      { label: 'לאחר טבעות', value: event.afterRings || '' },
      { label: 'נשארים לברך / לשלוף את הזוג', value: event.ushersOrPullCouple || '' },
      { label: 'עדים', value: event.witnesses || '' },
      { label: 'סלואו', value: checklistDisplay(event.slowDance, event.slowDanceNote) }
    ]

    const siblingsValue = checklistDisplay(event.siblingsEntry, event.siblingsEntrySong)
    if (siblingsValue) {
      items.push({ label: 'כניסת אחים/אחיות', value: siblingsValue })
    }

    const blessingValue = checklistDisplay(event.bridesBlessing, event.bridesBlessingNote)
    if (blessingValue) {
      items.push({ label: 'ברכת כלה', value: blessingValue })
    }

    return items.filter((item) => hasValue(item.value))
  }, [event])

  const liveOperations = useMemo(() => {
    const checklist: LabeledValue[] = [
      {
        label: 'אלכוהול',
        value: event.alcoholSource || ''
      },
      {
        label: 'הפרדה ברקודים',
        value: event.danceSeparationBarcodes || ''
      },
      { label: 'תפריטים', value: checklistDisplay(event.menus, event.menusNote) },
      { label: 'כיפות', value: checklistDisplay(event.kippot, event.kippotNote) },
      { label: 'מניפות', value: checklistDisplay(event.fans, event.fansNote) },
      {
        label: 'סלי התארגנות',
        value: checklistDisplay(event.organizationBaskets, event.organizationBasketsNote)
      },
      { label: 'מיץ ענבים', value: checklistDisplay(event.grapeJuice, event.grapeJuiceNote) },
      { label: 'משקפי שמש', value: checklistDisplay(event.sunglasses, event.sunglassesNote) },
      {
        label: 'גומיות וכלי חירום',
        value: checklistDisplay(event.gummiesAndTools, event.gummiesAndToolsNote)
      }
    ]

    return checklist.filter((item) => hasValue(item.value))
  }, [event])

  const liveBrideLooks = useMemo(() => {
    const looks: LabeledValue[] = [
      { label: 'לוק 1 - איפור', value: checklistDisplay(event.brideLook1Makeup) },
      { label: 'לוק 1 - שיער', value: checklistDisplay(event.brideLook1Hair) },
      { label: 'לוק 2 - איפור', value: checklistDisplay(event.brideLook2Makeup) },
      { label: 'לוק 2 - שיער', value: checklistDisplay(event.brideLook2Hair) },
      { label: 'לוק 3 - איפור', value: checklistDisplay(event.brideLook3Makeup) },
      { label: 'לוק 3 - שיער', value: checklistDisplay(event.brideLook3Hair) }
    ]

    return looks.filter((item) => hasValue(item.value))
  }, [event])

  const selectedSupplier = useMemo(() => {
    if (!signatureModal) return null
    return suppliers.find((supplier) => supplier.id === signatureModal.supplierId) ?? null
  }, [suppliers, signatureModal])

  const openSupplierSignatureModal = (supplier: SupplierRecord) => {
    const nowHour = new Date().toTimeString().slice(0, 5)
    const defaultAmount = supplierSignatureDefaultAmount(supplier)
    const safeStartHour =
      typeof supplier.hours === 'string' && /^\d{2}:\d{2}$/.test(supplier.hours)
        ? supplier.hours
        : nowHour
    setSignatureModal({
      supplierId: supplier.id,
      supplierName: supplier.name || '',
      amount: defaultAmount !== null ? String(defaultAmount) : '',
      startHour: safeStartHour,
      endHour: nowHour,
      signature: supplier.paymentReceivedSignature || ''
    })
  }

  const closeSupplierSignatureModal = () => {
    if (signatureSaving) return
    setSignatureModal(null)
  }

  const getCanvasPoint = (eventInput: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (eventInput.clientX - rect.left) * scaleX,
      y: (eventInput.clientY - rect.top) * scaleY
    }
  }

  const startSignatureDrawing = (eventInput: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const point = getCanvasPoint(eventInput)
    if (!point) return
    const context = canvas.getContext('2d')
    if (!context) return
    signatureDrawingRef.current = true
    canvas.setPointerCapture(eventInput.pointerId)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  const moveSignatureDrawing = (eventInput: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureDrawingRef.current) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const point = getCanvasPoint(eventInput)
    if (!point) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const endSignatureDrawing = (eventInput: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureDrawingRef.current) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    signatureDrawingRef.current = false
    try {
      canvas.releasePointerCapture(eventInput.pointerId)
    } catch {
      // pointer may already be released
    }
    const signatureDataUrl = canvas.toDataURL('image/png')
    setSignatureModal((prev) => (prev ? { ...prev, signature: signatureDataUrl } : prev))
  }

  const clearSignatureDrawing = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    setSignatureModal((prev) => (prev ? { ...prev, signature: '' } : prev))
  }

  useEffect(() => {
    if (!signatureModal) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#1e2b28'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (!signatureModal.signature.startsWith('data:image')) return
    const image = new Image()
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    image.src = signatureModal.signature
  }, [signatureModal])

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return
    try {
      await wakeLockRef.current.release()
    } catch {
      // ignore release errors to avoid blocking UI
    } finally {
      wakeLockRef.current = null
      setWakeLockActive(false)
    }
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined') return
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock
    if (!navigatorWithWakeLock.wakeLock) {
      setWakeLockError('הדפדפן לא תומך במניעת כיבוי מסך.')
      return
    }

    try {
      const sentinel = await navigatorWithWakeLock.wakeLock.request('screen')
      wakeLockRef.current = sentinel
      setWakeLockActive(true)
      setWakeLockError('')
      sentinel.addEventListener?.('release', () => {
        if (wakeLockRef.current === sentinel) {
          wakeLockRef.current = null
          setWakeLockActive(false)
        }
      })
    } catch {
      setWakeLockActive(false)
      setWakeLockError('לא ניתן להשאיר את המסך דולק כרגע.')
    }
  }, [])

  const handleLiveLockToggle = async () => {
    if (liveScreenLocked) {
      setLiveScreenLocked(false)
      return
    }
    setLiveScreenLocked(true)
    await requestWakeLock()
  }

  useEffect(() => {
    if (eventMode) return
    setLiveScreenLocked(false)
  }, [eventMode])

  useEffect(() => {
    if (!eventMode || !liveScreenLocked) {
      setWakeLockError('')
      void releaseWakeLock()
      return
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [eventMode, liveScreenLocked, requestWakeLock, releaseWakeLock])

  useEffect(() => {
    if (!eventMode || !liveScreenLocked) return
    const body = document.body
    const html = document.documentElement
    const scrollY = window.scrollY

    const previousStyles = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width
    }

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      html.style.overflow = previousStyles.htmlOverflow
      body.style.overflow = previousStyles.bodyOverflow
      body.style.position = previousStyles.bodyPosition
      body.style.top = previousStyles.bodyTop
      body.style.width = previousStyles.bodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [eventMode, liveScreenLocked])

  useEffect(() => {
    return () => {
      void releaseWakeLock()
    }
  }, [releaseWakeLock])

  const handleSupplierSignatureSubmit = async (eventInput: React.FormEvent) => {
    eventInput.preventDefault()
    if (!signatureModal || !selectedSupplier) return

    const defaultAmount = supplierSignatureDefaultAmount(selectedSupplier)
    const amountText = signatureModal.amount.replace(',', '.').trim()
    const normalizedAmount = amountText ? Number(amountText) : NaN
    const signerName = 'מנהל אירוע'
    const signatureValue = signatureModal.signature.trim() || `חתימה דיגיטלית: ${signerName}`

    const now = new Date()
    const workHoursText =
      signatureModal.startHour && signatureModal.endHour
        ? `${signatureModal.startHour} - ${signatureModal.endHour}`
        : signatureModal.startHour || signatureModal.endHour || ''

    const payload: SupplierSignaturePayload = {
      hasSigned: true,
      paymentReceivedDate: now.toISOString().split('T')[0],
      paymentReceivedName: signerName,
      paymentReceivedSignature: signatureValue
    }

    if (workHoursText) payload.paymentReceivedHours = workHoursText
    if (Number.isFinite(normalizedAmount)) {
      payload.paymentReceivedAmount = normalizedAmount
    } else if (typeof defaultAmount === 'number') {
      payload.paymentReceivedAmount = defaultAmount
    }

    setSignatureSaving(true)
    try {
      await onSignSupplier(event.id, selectedSupplier.id, payload)
      window.alert('האישור נשמר בהצלחה')
      setSignatureModal(null)
    } catch {
      window.alert('שמירת האישור נכשלה')
    } finally {
      setSignatureSaving(false)
    }
  }

  const renderSuppliersSection = ({
    title,
    subtitle,
    stepNumber
  }: {
    title: string
    subtitle: string
    stepNumber?: string
  }) => {
    const suppliersToShow = eventMode ? sortedSuppliers : suppliers

    return (
      <section className={`detail-section${eventMode ? ' event-mode-section' : ''}`}>
        <div className="section-head split">
          <h3 className="section-title">
            {stepNumber ? `${stepNumber}. ${title}` : title}
          </h3>
          <p className="helper">{subtitle}</p>
        </div>

        {suppliersToShow.length ? (
          <div className={`supplier-grid${eventMode ? ' compact' : ''}`}>
            {suppliersToShow.map((supplier) => {
              const paidAmount = supplierPaidAmount(supplier)
              const totalAmount = supplier.totalPayment
              const remainingAmount = supplierRemainingAmount(supplier)

              return (
                <article key={supplier.id} className="supplier-card supplier-card-rich">
                  <div className="supplier-head">
                    <h4>{supplier.role || 'ספק ללא קטגוריה'}</h4>
                    <span
                      className={`status-chip ${
                        supplier.hasSigned ? 'status-done' : eventMode ? 'status-alert' : 'status-plan'
                      }`}
                    >
                      {supplier.hasSigned ? 'נסגר' : 'ממתין לסגירה'}
                    </span>
                  </div>

                  <p className="supplier-line supplier-name-line">
                    <strong>{supplier.name || 'שם לא הוגדר'}</strong>
                  </p>
                  <p className="supplier-line">טלפון: {formatPhone(supplier.phone)}</p>
                  <p className="supplier-line">שעת הגעה: {supplier.hours || 'לא הוגדר'}</p>

                  <div className={`supplier-finance-grid${eventMode ? ' event-mode-only-remaining' : ''}`}>
                    {!eventMode ? (
                      <div className="supplier-finance-item">
                        <span>עלות כוללת</span>
                        <strong>{formatMoney(totalAmount)}</strong>
                      </div>
                    ) : null}
                    {!eventMode ? (
                      <div className="supplier-finance-item">
                        <span>מקדמה</span>
                        <strong>{formatMoney(supplier.deposit)}</strong>
                      </div>
                    ) : null}
                    {!eventMode ? (
                      <div className="supplier-finance-item">
                        <span>שולם בפועל</span>
                        <strong>{formatMoney(paidAmount)}</strong>
                      </div>
                    ) : null}
                    <div className="supplier-finance-item">
                      <span>יתרה לסגירה</span>
                      <strong>{formatMoney(remainingAmount)}</strong>
                    </div>
                  </div>

                  <div className="supplier-signature-box">
                    <p className="supplier-line">אישר: {supplier.paymentReceivedName || 'טרם נחתם'}</p>
                    <p className="supplier-line">
                      תאריך/שעה: {supplier.paymentReceivedDate || '---'} {supplier.paymentReceivedHours || ''}
                    </p>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => openSupplierSignatureModal(supplier)}
                    >
                      {eventMode ? 'סגירת ספק וחתימה' : 'חתימת קבלת תשלום'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="helper">לא הוגדרו ספקים לאירוע הזה.</p>
        )}
      </section>
    )
  }

  return (
    <div className={`page${eventMode ? ' event-live-page' : ''}`}>
      <section className="detail-head">
        <div>
          <h2 className="page-title">{event.coupleName || 'אירוע ללא שם'}</h2>
          <p className="helper">
            {eventMode
              ? 'מצב אירוע פעיל: מוצגים רק נתונים קריטיים לזמן אמת בסדר ביצוע קבוע.'
              : 'תצוגת שליטה מלאה על הזוג, תכנון הטקס, ספקים ותשלומים ביום האירוע.'}
          </p>
        </div>
        <div className="form-actions">
          <button className="btn ghost" onClick={onBack}>
            חזרה ללוח האירועים
          </button>
          {!eventMode ? (
            <button className="btn ghost" onClick={onScheduleMeeting}>
              קביעת פגישה עם הזוג
            </button>
          ) : null}
          {!eventMode ? (
            <button className="btn primary" onClick={onEdit}>
              עריכת אירוע
            </button>
          ) : (
            <span className="status-chip status-alert">מצב יום אירוע</span>
          )}
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">תאריך חתונה</p>
          <p className="stat-value">{formatDate(event.date)}</p>
          <p className="stat-foot">{event.hall || 'אולם לא הוגדר'}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">סטטוס</p>
          <p className="stat-value">{event.status || 'בתהליך'}</p>
          <p className="stat-foot">
            {eventMode ? 'מצב אירוע פעיל: עריכה נעולה' : 'מצב תכנון: ניתן לערוך'}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">תקציב ספקים</p>
          <p className="stat-value">{formatMoney(totalSuppliersAmount)}</p>
          <p className="stat-foot">שולם: {formatMoney(paidSuppliersAmount)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">סגירת ספקים</p>
          <p className="stat-value">
            {signedSuppliersCount}/{suppliers.length}
          </p>
          <p className="stat-foot">יתרה ביום האירוע: {formatMoney(remainingSuppliersAmount)}</p>
        </article>
      </section>

      {eventMode ? (
        <>
          <section className="detail-section event-mode-flow-card">
            <div className="section-head split">
              <h3 className="section-title">סדר עבודה נעול ליום האירוע</h3>
              <p className="helper">הסעיפים מוצגים לפי רצף תפעולי קבוע.</p>
            </div>
            <ol className="event-mode-stepper">
              <li className="event-mode-step">
                <span className="event-mode-step-index">1</span>
                <span className="event-mode-step-title">פתיחת אירוע</span>
              </li>
              <li className="event-mode-step">
                <span className="event-mode-step-index">2</span>
                <span className="event-mode-step-title">אנשי קשר</span>
              </li>
              <li className="event-mode-step">
                <span className="event-mode-step-index">3</span>
                <span className="event-mode-step-title">טקס וחופה</span>
              </li>
              <li className="event-mode-step">
                <span className="event-mode-step-index">4</span>
                <span className="event-mode-step-title">רחבה ותפעול</span>
              </li>
              <li className="event-mode-step">
                <span className="event-mode-step-index">5</span>
                <span className="event-mode-step-title">ספקים וסגירות</span>
              </li>
            </ol>
          </section>

          <section className="detail-section event-mode-section">
            <div className="section-head split">
              <h3 className="section-title">1. פתיחת אירוע</h3>
              <p className="helper">נתוני בסיס לתחילת עבודה באירוע.</p>
            </div>
            <div className="kv-grid">
              {liveOpeningFields.map((field) => (
                <div key={field.label} className="kv">
                  <p className="kv-label">{field.label}</p>
                  <p className="kv-value">{field.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="detail-section event-mode-section">
            <div className="section-head split">
              <h3 className="section-title">2. אנשי קשר</h3>
              <p className="helper">כל אנשי הקשר הרלוונטיים ליום האירוע.</p>
            </div>
            {liveContacts.length ? (
              <div className="timeline-list">
                {liveContacts.map((item) => (
                  <div key={item.label} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">אין אנשי קשר זמינים להצגה.</p>
            )}
          </section>

          <section className="detail-section event-mode-section">
            <div className="section-head split">
              <h3 className="section-title">3. טקס וחופה</h3>
              <p className="helper">מהלכי הטקס לפי הסדר שהוזן מראש.</p>
            </div>
            {liveCeremonyFlow.length ? (
              <div className="timeline-list">
                {liveCeremonyFlow.map((item) => (
                  <div key={item.label} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">עדיין לא הוזן תוכן לציר הטקס.</p>
            )}
          </section>

          <section className="detail-section event-mode-section">
            <div className="section-head split">
              <h3 className="section-title">4. רחבה ותפעול</h3>
              <p className="helper">מוצגים רק סעיפים שמסומנים כפעילים או דורשים טיפול.</p>
            </div>
            {liveOperations.length ? (
              <div className="timeline-list">
                {liveOperations.map((item) => (
                  <div key={item.label} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">אין משימות תפעול מסומנות ליום האירוע.</p>
            )}

            {liveBrideLooks.length ? (
              <>
                <h4 className="section-title event-mode-subtitle">מראה כלה</h4>
                <div className="timeline-list">
                  {liveBrideLooks.map((item) => (
                    <div key={item.label} className="timeline-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          {renderSuppliersSection({
            title: 'ספקים וסגירות תשלום',
            subtitle: 'מסודר לפי שעות הגעה, עם גישה מיידית לחתימה.',
            stepNumber: '5'
          })}
        </>
      ) : (
        <>
          <section className="kv-grid">
            <div className="kv">
              <p className="kv-label">שם חתן</p>
              <p className="kv-value">{event.groomName || 'לא הוגדר'}</p>
            </div>
            <div className="kv">
              <p className="kv-label">שם כלה</p>
              <p className="kv-value">{event.brideName || 'לא הוגדר'}</p>
            </div>
            <div className="kv">
              <p className="kv-label">מספר אורחים</p>
              <p className="kv-value">
                {typeof event.guests === 'number' && event.guests > 0 ? event.guests : 'לא הוגדר'}
              </p>
            </div>
            <div className="kv">
              <p className="kv-label">טלפון קשר</p>
              <p className="kv-value">{formatPhone(event.contactPhone)}</p>
            </div>
            <div className="kv">
              <p className="kv-label">מלווה חתן</p>
              <p className="kv-value">{event.groomEscort || 'לא הוגדר'}</p>
            </div>
            <div className="kv">
              <p className="kv-label">מלווה כלה</p>
              <p className="kv-value">{event.brideEscort || 'לא הוגדר'}</p>
            </div>
          </section>

          <section className="detail-section">
            <h3 className="section-title">ציר טקס ותוכן</h3>
            {timelineFields.length ? (
              <div className="timeline-list">
                {timelineFields.map((item) => (
                  <div key={item.label} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">עדיין לא הוזן תוכן לציר הטקס.</p>
            )}
          </section>

          {renderSuppliersSection({ title: 'ספקים ותשלומים', subtitle: 'סטטוס ספקים מלא לצורכי תכנון.' })}
        </>
      )}

      {hasValue(event.notes) ? (
        <section className={`detail-section${eventMode ? ' event-mode-section' : ''}`}>
          <h3 className="section-title">{eventMode ? 'הערות מנהל בזמן אמת' : 'הערות ניהול'}</h3>
          <div className="note-block">{event.notes}</div>
        </section>
      ) : null}

      {eventMode ? (
        <button
          type="button"
          className={`event-live-lock-button${liveScreenLocked ? ' is-locked' : ''}`}
          onClick={handleLiveLockToggle}
          aria-pressed={liveScreenLocked}
          aria-label={liveScreenLocked ? 'שחרור נעילת מסך' : 'נעילת מסך'}
          title={liveScreenLocked ? 'המנעול סגור - גלילה נעולה' : 'המנעול פתוח - גלילה פעילה'}
        >
          <span className="event-live-lock-icon" aria-hidden="true">
            {liveScreenLocked ? '🔒' : '🔓'}
          </span>
        </button>
      ) : null}

      {signatureModal ? (
        <section className="signature-modal-backdrop" role="dialog" aria-modal="true">
          <div className="signature-modal-card">
            <h3 className="section-title">חתימת קבלן / ספק</h3>
            <form className="form" onSubmit={handleSupplierSignatureSubmit}>
              <label className="field">
                שם הספק
                <input
                  className="input"
                  value={signatureModal.supplierName}
                  onChange={(eventInput) =>
                    setSignatureModal((prev) =>
                      prev ? { ...prev, supplierName: eventInput.target.value } : prev
                    )
                  }
                  placeholder="שם ספק"
                />
              </label>

              <div className="editor-grid">
                <label className="field">
                  שעת התחלה
                  <input
                    className="input"
                    type="time"
                    value={signatureModal.startHour}
                    onChange={(eventInput) =>
                      setSignatureModal((prev) =>
                        prev ? { ...prev, startHour: eventInput.target.value } : prev
                      )
                    }
                  />
                </label>
                <label className="field">
                  שעת סיום
                  <input
                    className="input"
                    type="time"
                    value={signatureModal.endHour}
                    onChange={(eventInput) =>
                      setSignatureModal((prev) =>
                        prev ? { ...prev, endHour: eventInput.target.value } : prev
                      )
                    }
                  />
                </label>
              </div>

              <label className="field">
                סכום שקיבל
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={signatureModal.amount}
                  readOnly
                  placeholder="0"
                />
              </label>

              <label className="field">
                חתימה על המסמך
                <div className="signature-pad">
                  <canvas
                    ref={signatureCanvasRef}
                    className="signature-canvas"
                    width={460}
                    height={170}
                    onPointerDown={startSignatureDrawing}
                    onPointerMove={moveSignatureDrawing}
                    onPointerUp={endSignatureDrawing}
                    onPointerLeave={endSignatureDrawing}
                    onPointerCancel={endSignatureDrawing}
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn ghost" onClick={clearSignatureDrawing}>
                    ניקוי חתימה
                  </button>
                </div>
              </label>

              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={closeSupplierSignatureModal}>
                  ביטול
                </button>
                <button type="submit" className="btn primary" disabled={signatureSaving}>
                  {signatureSaving ? 'שומר...' : 'שמירת חתימה'}
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}
