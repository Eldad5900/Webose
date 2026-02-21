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

type EventStageOverviewItem = {
  id: string
  title: string
  subtitle: string
  count: number
}

type BrideLookTableRow = {
  lookLabel: string
  makeup: string
  hair: string
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

function isParentsContactLabel(label: string) {
  return label === 'אב החתן' || label === 'אם החתן' || label === 'אב הכלה' || label === 'אם הכלה'
}

function hasMeaningfulValue(value?: string | null) {
  if (!hasValue(value)) return false
  const normalized = value!.trim()
  return normalized !== 'לא הוגדר' && normalized !== 'לא נקבע'
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
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const [highlightedStageId, setHighlightedStageId] = useState('')
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
    { label: 'מיקום האירוע', value: event.hall || 'לא הוגדר' },
    { label: 'מיקום התארגנות חתן', value: event.groomPrepLocation || 'לא הוגדר' },
    { label: 'מיקום התארגנות כלה', value: event.bridePrepLocation || 'לא הוגדר' },
    { label: 'שעת הגעה לאולם', value: event.arrivalTimeToHall || 'לא הוגדר' },
    {
      label: 'כמות אורחים',
      value: typeof event.guests === 'number' && event.guests > 0 ? String(event.guests) : 'לא הוגדר'
    }
  ]

  const liveContactsByPhase = useMemo(() => {
    const preparation: LabeledValue[] = []
    const ceremony: LabeledValue[] = []
    const reception: LabeledValue[] = []
    const operations: LabeledValue[] = []

    const pushContact = (target: LabeledValue[], label: string, name?: string, phone?: number) => {
      const parts: string[] = []
      if (hasValue(name)) parts.push(name!.trim())
      if (phone && phone > 0) parts.push(formatPhone(phone))
      if (!parts.length) return
      target.push({ label, value: parts.join(' · ') })
    }

    const pushValue = (target: LabeledValue[], label: string, value?: string) => {
      if (!hasValue(value)) return
      target.push({ label, value: value!.trim() })
    }

    if (event.contactPhone && event.contactPhone > 0) {
      preparation.push({ label: 'טלפון קשר ראשי', value: formatPhone(event.contactPhone) })
    }
    pushContact(preparation, 'מלווה חתן', event.groomEscort, event.groomEscortPhone)
    pushContact(preparation, 'מלווה כלה', event.brideEscort, event.brideEscortPhone)

    pushContact(ceremony, 'אב החתן', event.groomFatherName, event.groomFatherPhone)
    pushContact(ceremony, 'אם החתן', event.groomMotherName, event.groomMotherPhone)
    pushContact(ceremony, 'אב הכלה', event.brideFatherName, event.brideFatherPhone)
    pushContact(ceremony, 'אם הכלה', event.brideMotherName, event.brideMotherPhone)
    pushValue(ceremony, 'חתן בליווי', event.groomWithEscort)
    pushValue(ceremony, 'כלה בליווי', event.brideWithEscort)
    pushValue(ceremony, 'עדים', event.witnesses)
    pushValue(ceremony, 'יין לחופה', event.wineAtChuppah)
    suppliers.forEach((supplier) => {
      const role = supplier.role?.trim() ?? ''
      if (!role.includes('רב')) return
      pushContact(ceremony, role || 'רב', supplier.name, supplier.phone)
    })

    pushValue(reception, 'מנהל אירוע', event.eventManager)
    pushValue(reception, 'חתימה מורשית', event.authorizedSigner)
    pushValue(reception, 'אלכוהול', event.alcoholSource)
    return {
      preparationContacts: preparation,
      ceremonyContacts: ceremony,
      receptionContacts: reception,
      operationsContacts: operations
    }
  }, [event])

  const liveCeremonyFlow = useMemo(() => {
    const items: LabeledValue[] = [
      {
        label: 'מי מלווה את החתן לחופה',
        value: event.groomEscort || event.groomWithEscort || ''
      },
      {
        label: 'מי מלווה את הכלה לחופה',
        value: event.brideEscort || event.brideWithEscort || ''
      },
      { label: 'מי ממתין בחופה', value: event.waitingAtChuppah || '' },
      { label: 'כניסת אחים/אחיות', value: checklistDisplay(event.siblingsEntry) },
      { label: 'שיר כניסת אחים/אחיות', value: event.siblingsEntrySong || '' },
      { label: 'שיר כניסת חתן', value: event.groomEntrySong || '' },
      { label: 'שיר כניסת כלה', value: event.brideEntrySong || '' },
      { label: 'שיר שבירת כוס', value: event.glassBreakSong || '' },
      { label: 'שם אחרי טבעות', value: event.afterRings || '' },
      { label: 'נשארים לברך / לשלוף את הזוג', value: event.ushersOrPullCouple || '' }
    ]

    const blessingValue = checklistDisplay(event.bridesBlessing, event.bridesBlessingNote)
    if (blessingValue) {
      items.push({ label: 'ברכת כלה', value: blessingValue })
    }

    return items.filter((item) => hasValue(item.value))
  }, [event])

  const liveOperations = useMemo(() => {
    const checklist: LabeledValue[] = [
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
      { label: 'מיץ גת', value: checklistDisplay(event.grapeJuice, event.grapeJuiceNote) },
      { label: 'משקפי שמש', value: checklistDisplay(event.sunglasses, event.sunglassesNote) },
      {
        label: 'גומיות וכלי חירום',
        value: checklistDisplay(event.gummiesAndTools, event.gummiesAndToolsNote)
      },
      { label: 'סלואו', value: checklistDisplay(event.slowDance, event.slowDanceNote) }
    ]

    return checklist.filter((item) => hasValue(item.value))
  }, [event])

  const seatingDetails = useMemo(() => {
    const details: LabeledValue[] = []
    if (hasValue(event.seatingCompany)) {
      details.push({ label: 'הושבת משפחות', value: event.seatingCompany!.trim() })
    }
    if (event.seatingManagerPhone && event.seatingManagerPhone > 0) {
      details.push({ label: 'טלפון מנהל הושבה', value: formatPhone(event.seatingManagerPhone) })
    }
    return details
  }, [event])

  const hasSeatingSketch = hasValue(event.seatingAllocationFileData)
  const seatingSketchIsImage = event.seatingAllocationFileData?.startsWith('data:image') ?? false

  const liveBrideLooksTable = useMemo<BrideLookTableRow[]>(() => {
    const rows: BrideLookTableRow[] = [
      {
        lookLabel: 'לוק 1',
        makeup: checklistDisplay(event.brideLook1Makeup),
        hair: checklistDisplay(event.brideLook1Hair)
      },
      {
        lookLabel: 'לוק 2',
        makeup: checklistDisplay(event.brideLook2Makeup),
        hair: checklistDisplay(event.brideLook2Hair)
      },
      {
        lookLabel: 'לוק 3',
        makeup: checklistDisplay(event.brideLook3Makeup),
        hair: checklistDisplay(event.brideLook3Hair)
      }
    ]

    return rows.filter((row) => hasValue(row.makeup) || hasValue(row.hair))
  }, [event])

  const eventStageOverview = useMemo<EventStageOverviewItem[]>(() => {
    const prepCount =
      [
        event.hall,
        event.groomPrepLocation,
        event.bridePrepLocation,
        event.arrivalTimeToHall
      ].filter((value) => hasMeaningfulValue(value)).length +
      (typeof event.guests === 'number' && event.guests > 0 ? 1 : 0) +
      liveContactsByPhase.preparationContacts.length

    return [
      {
        id: 'event-stage-preparation',
        title: '1. התארגנות',
        subtitle: 'פתיחה ואנשי קשר',
        count: prepCount
      },
      {
        id: 'event-stage-reception',
        title: '2. קבלת פנים',
        subtitle: 'ניהול קבלת אורחים',
        count: liveContactsByPhase.receptionContacts.length
      },
      {
        id: 'event-stage-ceremony',
        title: '3. טקס וחופה',
        subtitle: 'מהלך חופה וקידושין',
        count: liveCeremonyFlow.length + liveContactsByPhase.ceremonyContacts.length
      },
      {
        id: 'event-stage-seating',
        title: '4. הושבה',
        subtitle: 'טבלה וסקיצה',
        count: seatingDetails.length + (hasSeatingSketch ? 1 : 0)
      },
      {
        id: 'event-stage-operations',
        title: '5. רחבה ותפעול',
        subtitle: 'תפעול בזמן אמת',
        count: liveOperations.length + liveContactsByPhase.operationsContacts.length
      },
      {
        id: 'event-stage-bride-looks',
        title: '6. מראה כלה',
        subtitle: 'לוקים, שיער ואיפור',
        count: liveBrideLooksTable.reduce((count, row) => {
          const makeupCount = hasValue(row.makeup) ? 1 : 0
          const hairCount = hasValue(row.hair) ? 1 : 0
          return count + makeupCount + hairCount
        }, 0)
      },
      {
        id: 'event-stage-suppliers',
        title: '7. ספקים וסגירות',
        subtitle: 'סגירת תשלומים',
        count: suppliers.length
      }
    ]
  }, [
    event,
    hasSeatingSketch,
    liveBrideLooksTable,
    liveCeremonyFlow.length,
    liveContactsByPhase,
    liveOperations.length,
    seatingDetails.length,
    suppliers.length
  ])

  const jumpToStage = (stageId: string) => {
    const section = document.getElementById(stageId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedStageId('')
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => setHighlightedStageId(stageId))
    } else {
      setHighlightedStageId(stageId)
    }
  }

  useEffect(() => {
    if (!highlightedStageId) return
    const timeoutId = window.setTimeout(() => setHighlightedStageId(''), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [highlightedStageId])

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

  const handleBackClick = () => {
    if (eventMode) {
      setExitConfirmOpen(true)
      return
    }
    onBack()
  }

  const handleConfirmExit = () => {
    setExitConfirmOpen(false)
    onBack()
  }

  const renderSuppliersSection = ({
    title,
    subtitle,
    stepNumber,
    sectionId
  }: {
    title: string
    subtitle: string
    stepNumber?: string
    sectionId?: string
  }) => {
    const suppliersToShow = eventMode ? sortedSuppliers : suppliers

    return (
      <section
        id={sectionId}
        className={`detail-section${eventMode ? ' event-mode-section' : ''}${
          sectionId && sectionId === highlightedStageId ? ' stage-target-highlight' : ''
        }`}
      >
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
              const remainingAmount =
                eventMode && typeof supplier.balance === 'number'
                  ? Math.max(supplier.balance, 0)
                  : supplierRemainingAmount(supplier)

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
              : 'מצב לא אירוע: תצוגת שליטה מלאה על הזוג, תכנון הטקס, ספקים ותשלומים.'}
          </p>
        </div>
        <div className="form-actions">
          <button className="btn ghost" onClick={handleBackClick}>
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
        {!eventMode ? (
          <>
            <article className="stat-card">
              <p className="stat-label">סטטוס</p>
              <p className="stat-value">{event.status || 'בתהליך'}</p>
              <p className="stat-foot">מצב לא אירוע: ניתן לערוך</p>
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
          </>
        ) : null}
      </section>

      {eventMode ? (
        <>
          <section className="detail-section event-mode-overview">
            <div className="section-head split">
              <h3 className="section-title">לוח שלבי החתונה</h3>
              <p className="helper">לחיצה על שלב תעביר אותך ישירות אליו.</p>
            </div>
            <div className="event-mode-overview-grid">
              {eventStageOverview.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  className="event-mode-overview-item"
                  onClick={() => jumpToStage(stage.id)}
                >
                  <span className="event-mode-overview-title">{stage.title}</span>
                  <span className="event-mode-overview-subtitle">{stage.subtitle}</span>
                  <span
                    className={`status-chip ${stage.count > 0 ? 'status-done' : 'status-plan'} event-mode-overview-status`}
                  >
                    {stage.count > 0 ? `${stage.count} פריטים` : 'חסר מידע'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section
            id="event-stage-preparation"
            className={`detail-section event-mode-section${
              highlightedStageId === 'event-stage-preparation' ? ' stage-target-highlight' : ''
            }`}
          >
            <div className="section-head split">
              <h3 className="section-title">1. התארגנות</h3>
              <p className="helper">נתוני בסיס לשלב ההתארגנות.</p>
            </div>
            <div className="kv-grid">
              {liveOpeningFields.map((field) => (
                <div key={field.label} className="kv">
                  <p className="kv-label">{field.label}</p>
                  <p className="kv-value">{field.value}</p>
                </div>
              ))}
            </div>

            {liveContactsByPhase.preparationContacts.length ? (
              <>
                <h4 className="section-title event-mode-subtitle">אנשי קשר להתארגנות</h4>
                <div className="timeline-list">
                  {liveContactsByPhase.preparationContacts.map((item) => (
                    <div key={`prep-${item.label}`} className="timeline-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section
            id="event-stage-reception"
            className={`detail-section event-mode-section${
              highlightedStageId === 'event-stage-reception' ? ' stage-target-highlight' : ''
            }`}
          >
            <div className="section-head split">
              <h3 className="section-title">2. קבלת פנים</h3>
              <p className="helper">פרטי אנשי קשר ותפעול בשלב קבלת הפנים.</p>
            </div>
            {liveContactsByPhase.receptionContacts.length ? (
              <div className="timeline-list">
                {liveContactsByPhase.receptionContacts.map((item) => (
                  <div key={`reception-${item.label}`} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">אין נתונים שהוגדרו לקבלת פנים.</p>
            )}
          </section>

          <section
            id="event-stage-ceremony"
            className={`detail-section event-mode-section${
              highlightedStageId === 'event-stage-ceremony' ? ' stage-target-highlight' : ''
            }`}
          >
            <div className="section-head split">
              <h3 className="section-title">3. טקס וחופה</h3>
              <p className="helper">מהלכי הטקס ואנשי קשר רלוונטיים לשלב החופה.</p>
            </div>
            {liveContactsByPhase.ceremonyContacts.length ? (
              <>
                <h4 className="section-title event-mode-subtitle">אנשי קשר לחופה וקידושין</h4>
                {liveContactsByPhase.ceremonyContacts.filter((item) => isParentsContactLabel(item.label))
                  .length ? (
                  <>
                    <div className="timeline-list">
                  {liveContactsByPhase.ceremonyContacts
                        .filter((item) => isParentsContactLabel(item.label))
                        .map((item, index) => (
                          <div key={`ceremony-parents-${item.label}-${index}`} className="timeline-item">
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                    </div>
                  </>
                ) : null}
                {liveContactsByPhase.ceremonyContacts.filter((item) => !isParentsContactLabel(item.label))
                  .length ? (
                  <>
                    <h4 className="section-title event-mode-subtitle">חופה וקידושין</h4>
                    <div className="timeline-list">
                      {liveContactsByPhase.ceremonyContacts
                        .filter((item) => !isParentsContactLabel(item.label))
                        .map((item, index) => (
                          <div key={`ceremony-other-${item.label}-${index}`} className="timeline-item">
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
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

          <section
            id="event-stage-seating"
            className={`detail-section event-mode-section${
              highlightedStageId === 'event-stage-seating' ? ' stage-target-highlight' : ''
            }`}
          >
            <div className="section-head split">
              <h3 className="section-title">4. הושבה</h3>
              <p className="helper">טבלת הושבה, מנהל הושבה וסקיצת הושבה.</p>
            </div>
            {seatingDetails.length ? (
              <div className="timeline-list">
                {seatingDetails.map((item) => (
                  <div key={`seating-${item.label}`} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">אין פרטי הושבה שהוגדרו.</p>
            )}
            {hasSeatingSketch ? (
              <div className="seating-sketch-wrap">
                <h4 className="section-title event-mode-subtitle">סקיצת הושבה</h4>
                {seatingSketchIsImage ? (
                  <img
                    className="seating-sketch-image"
                    src={event.seatingAllocationFileData}
                    alt={event.seatingAllocationFileName || 'סקיצת הושבה'}
                  />
                ) : (
                  <a
                    className="btn ghost seating-sketch-link"
                    href={event.seatingAllocationFileData}
                    target="_blank"
                    rel="noreferrer"
                  >
                    פתיחת סקיצת הושבה
                  </a>
                )}
              </div>
            ) : (
              <p className="helper">לא הועלתה סקיצת הושבה.</p>
            )}
          </section>

          <section
            id="event-stage-operations"
            className={`detail-section event-mode-section${
              highlightedStageId === 'event-stage-operations' ? ' stage-target-highlight' : ''
            }`}
          >
            <div className="section-head split">
              <h3 className="section-title">5. רחבה ותפעול</h3>
              <p className="helper">משימות תפעול ואנשי קשר לביצוע בזמן אמת.</p>
            </div>
            {liveContactsByPhase.operationsContacts.length ? (
              <>
                <h4 className="section-title event-mode-subtitle">אנשי קשר לתפעול</h4>
                <div className="timeline-list">
                  {liveContactsByPhase.operationsContacts.map((item) => (
                    <div key={`operations-${item.label}`} className="timeline-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
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
          </section>

          <section
            id="event-stage-bride-looks"
            className={`detail-section event-mode-section${
              highlightedStageId === 'event-stage-bride-looks' ? ' stage-target-highlight' : ''
            }`}
          >
            <div className="section-head split">
              <h3 className="section-title">6. מראה כלה</h3>
              <p className="helper">פירוט לוקים ושיער/איפור ליום האירוע.</p>
            </div>
            {liveBrideLooksTable.length ? (
              <div className="bride-looks-table-wrap">
                <table className="bride-looks-table">
                  <thead>
                    <tr>
                      <th>לוק</th>
                      <th>איפור</th>
                      <th>שיער</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveBrideLooksTable.map((row) => (
                      <tr key={row.lookLabel}>
                        <td>{row.lookLabel}</td>
                        <td>{row.makeup || 'לא הוגדר'}</td>
                        <td>{row.hair || 'לא הוגדר'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {renderSuppliersSection({
            title: 'ספקים וסגירות תשלום',
            subtitle: 'מסודר לפי שעות הגעה, עם גישה מיידית לחתימה.',
            stepNumber: '7',
            sectionId: 'event-stage-suppliers'
          })}
        </>
      ) : (
        <>
          <section className="detail-section">
            <div className="section-head split">
              <h3 className="section-title">1. התארגנות</h3>
              <p className="helper">כל נתוני הפתיחה וההתארגנות.</p>
            </div>
            <div className="kv-grid">
              {liveOpeningFields.map((field) => (
                <div key={field.label} className="kv">
                  <p className="kv-label">{field.label}</p>
                  <p className="kv-value">{field.value}</p>
                </div>
              ))}
            </div>
            {liveContactsByPhase.preparationContacts.length ? (
              <>
                <h4 className="section-title event-mode-subtitle">אנשי קשר להתארגנות</h4>
                <div className="timeline-list">
                  {liveContactsByPhase.preparationContacts.map((item) => (
                    <div key={`plan-prep-${item.label}`} className="timeline-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="detail-section">
            <div className="section-head split">
              <h3 className="section-title">2. קבלת פנים</h3>
              <p className="helper">נתוני קבלת פנים מלאים.</p>
            </div>
            {liveContactsByPhase.receptionContacts.length ? (
              <div className="timeline-list">
                {liveContactsByPhase.receptionContacts.map((item) => (
                  <div key={`plan-reception-${item.label}`} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">אין נתונים שהוגדרו לקבלת פנים.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="section-head split">
              <h3 className="section-title">3. טקס וחופה</h3>
              <p className="helper">כל פרטי הטקס, חופה וקידושין.</p>
            </div>
            {liveContactsByPhase.ceremonyContacts.length ? (
              <>
                <h4 className="section-title event-mode-subtitle">אנשי קשר לחופה וקידושין</h4>
                <div className="timeline-list">
                  {liveContactsByPhase.ceremonyContacts.map((item, index) => (
                    <div key={`plan-ceremony-${item.label}-${index}`} className="timeline-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {liveCeremonyFlow.length ? (
              <div className="timeline-list">
                {liveCeremonyFlow.map((item) => (
                  <div key={`plan-ceremony-flow-${item.label}`} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">עדיין לא הוזן תוכן לציר הטקס.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="section-head split">
              <h3 className="section-title">4. הושבה</h3>
              <p className="helper">פרטי הושבה וסקיצה.</p>
            </div>
            {seatingDetails.length ? (
              <div className="timeline-list">
                {seatingDetails.map((item) => (
                  <div key={`plan-seating-${item.label}`} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">אין פרטי הושבה שהוגדרו.</p>
            )}
            {hasSeatingSketch ? (
              <div className="seating-sketch-wrap">
                <h4 className="section-title event-mode-subtitle">סקיצת הושבה</h4>
                {seatingSketchIsImage ? (
                  <img
                    className="seating-sketch-image"
                    src={event.seatingAllocationFileData}
                    alt={event.seatingAllocationFileName || 'סקיצת הושבה'}
                  />
                ) : (
                  <a
                    className="btn ghost seating-sketch-link"
                    href={event.seatingAllocationFileData}
                    target="_blank"
                    rel="noreferrer"
                  >
                    פתיחת סקיצת הושבה
                  </a>
                )}
              </div>
            ) : (
              <p className="helper">לא הועלתה סקיצת הושבה.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="section-head split">
              <h3 className="section-title">5. רחבה ותפעול</h3>
              <p className="helper">משימות תפעול מלאות.</p>
            </div>
            {liveContactsByPhase.operationsContacts.length ? (
              <>
                <h4 className="section-title event-mode-subtitle">אנשי קשר לתפעול</h4>
                <div className="timeline-list">
                  {liveContactsByPhase.operationsContacts.map((item) => (
                    <div key={`plan-operations-${item.label}`} className="timeline-item">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {liveOperations.length ? (
              <div className="timeline-list">
                {liveOperations.map((item) => (
                  <div key={`plan-operations-flow-${item.label}`} className="timeline-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper">אין משימות תפעול מסומנות.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="section-head split">
              <h3 className="section-title">6. מראה כלה</h3>
              <p className="helper">לוקים, איפור ושיער.</p>
            </div>
            {liveBrideLooksTable.length ? (
              <div className="bride-looks-table-wrap">
                <table className="bride-looks-table">
                  <thead>
                    <tr>
                      <th>לוק</th>
                      <th>איפור</th>
                      <th>שיער</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveBrideLooksTable.map((row) => (
                      <tr key={`plan-${row.lookLabel}`}>
                        <td>{row.lookLabel}</td>
                        <td>{row.makeup || 'לא הוגדר'}</td>
                        <td>{row.hair || 'לא הוגדר'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="helper">לא הוגדר מידע למראה כלה.</p>
            )}
          </section>

          {renderSuppliersSection({
            title: 'ספקים ותשלומים',
            subtitle: 'סטטוס ספקים מלא לצורכי תכנון.',
            stepNumber: '7'
          })}
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

      {exitConfirmOpen ? (
        <section className="signature-modal-backdrop" role="dialog" aria-modal="true">
          <div className="signature-modal-card">
            <h3 className="section-title">יציאה ממצב אירוע</h3>
            <p className="helper">האם אתה בטוח שאתה רוצה לצאת מהאירוע?</p>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setExitConfirmOpen(false)}>
                ביטול
              </button>
              <button type="button" className="btn danger" onClick={handleConfirmExit}>
                כן, יציאה
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
