import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { EventRecord, SupplierRecord } from '../controlers/types'

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

type SupplierSignatureModalState = {
  supplierId: string
  supplierName: string
  amount: string
  startHour: string
  endHour: string
  signature: string
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
  const [signatureModal, setSignatureModal] = useState<SupplierSignatureModalState | null>(null)
  const [signatureSaving, setSignatureSaving] = useState(false)
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const signatureDrawingRef = useRef(false)
  const suppliers = event.suppliers ?? []
  const totalSuppliersAmount = suppliers.reduce((sum, supplier) => {
    return sum + (typeof supplier.totalPayment === 'number' ? supplier.totalPayment : 0)
  }, 0)
  const paidSuppliersAmount = suppliers.reduce((sum, supplier) => sum + supplierPaidAmount(supplier), 0)
  const remainingSuppliersAmount = Math.max(totalSuppliersAmount - paidSuppliersAmount, 0)
  const signedSuppliersCount = suppliers.filter((supplier) => supplier.hasSigned).length

  const timelineFields = [
    { label: 'הגעה לאולם', value: event.arrivalTimeToHall },
    { label: 'שיר כניסת חתן', value: event.groomEntrySong },
    { label: 'שיר כניסת כלה', value: event.brideEntrySong },
    { label: 'שבירת כוס', value: event.glassBreakSong },
    { label: 'אחרי טבעות', value: event.afterRings },
    { label: 'ריקוד סלואו', value: event.slowDance }
  ].filter((item) => hasValue(item.value))

  const selectedSupplier = useMemo(() => {
    if (!signatureModal) return null
    return suppliers.find((supplier) => supplier.id === signatureModal.supplierId) ?? null
  }, [suppliers, signatureModal])

  const openSupplierSignatureModal = (supplier: SupplierRecord) => {
    const nowHour = new Date().toTimeString().slice(0, 5)
    const remainingAmount = supplierRemainingAmount(supplier)
    setSignatureModal({
      supplierId: supplier.id,
      supplierName: supplier.name || '',
      amount: remainingAmount !== null ? String(remainingAmount) : '',
      startHour: supplier.hours || nowHour,
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

  const handleSupplierSignatureSubmit = async (eventInput: React.FormEvent) => {
    eventInput.preventDefault()
    if (!signatureModal || !selectedSupplier) return

    const remainingAmount = supplierRemainingAmount(selectedSupplier)
    const amountText = signatureModal.amount.replace(',', '.').trim()
    const normalizedAmount = amountText ? Number(amountText) : NaN
    const signerName = 'מנהל אירוע'
    const signatureValue = signatureModal.signature.trim() || `חתימה דיגיטלית: ${signerName}`

    const now = new Date()
    const workHoursText =
      signatureModal.startHour && signatureModal.endHour
        ? `${signatureModal.startHour} - ${signatureModal.endHour}`
        : signatureModal.startHour || signatureModal.endHour || ''

    const payload: {
      paymentReceivedAmount?: number
      paymentReceivedHours?: string
      paymentReceivedDate?: string
      paymentReceivedName?: string
      paymentReceivedSignature?: string
      hasSigned?: boolean
    } = {
      hasSigned: true,
      paymentReceivedDate: now.toISOString().split('T')[0],
      paymentReceivedName: signerName,
      paymentReceivedSignature: signatureValue
    }

    if (workHoursText) payload.paymentReceivedHours = workHoursText
    if (typeof remainingAmount === 'number') {
      payload.paymentReceivedAmount = remainingAmount
    } else if (Number.isFinite(normalizedAmount)) {
      payload.paymentReceivedAmount = normalizedAmount
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

  return (
    <div className="page">
      <section className="detail-head">
        <div>
          <h2 className="page-title">{event.coupleName || 'אירוע ללא שם'}</h2>
          <p className="helper">
            תצוגת שליטה מלאה על הזוג, תכנון הטקס, ספקים ותשלומים ביום האירוע.
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
          ) : null}
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

      <section className="detail-section">
        <h3 className="section-title">ספקים ותשלומים</h3>
        {suppliers.length ? (
          <div className="supplier-grid">
            {suppliers.map((supplier) => {
              const paidAmount = supplierPaidAmount(supplier)
              const totalAmount = supplier.totalPayment
              const remainingAmount = supplierRemainingAmount(supplier)

              return (
                <article key={supplier.id} className="supplier-card supplier-card-rich">
                  <div className="supplier-head">
                    <h4>{supplier.role || 'ספק ללא קטגוריה'}</h4>
                    <span className={`status-chip ${supplier.hasSigned ? 'status-ready' : 'status-plan'}`}>
                      {supplier.hasSigned ? 'אושר תשלום' : 'ממתין לאישור'}
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
                      <span>יתרה ביום האירוע</span>
                      <strong>{formatMoney(remainingAmount)}</strong>
                    </div>
                  </div>

                  <div className="supplier-signature-box">
                    <p className="supplier-line">
                      אישר: {supplier.paymentReceivedName || 'טרם נחתם'}
                    </p>
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
                      חתימת קבלת תשלום
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

      {hasValue(event.notes) ? (
        <section className="detail-section">
          <h3 className="section-title">הערות ניהול</h3>
          <div className="note-block">{event.notes}</div>
        </section>
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
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={clearSignatureDrawing}
                  >
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
