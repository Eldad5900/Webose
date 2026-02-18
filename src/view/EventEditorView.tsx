import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  createQuestionnaireFormState,
  eventQuestionnaireSections,
  questionnaireNumberFields,
  type EditableEventField,
  type QuestionnaireField
} from '../controlers/eventQuestionnaire'
import type { EventRecord, SupplierRecord } from '../controlers/types'

type SupplierFormState = {
  id: string
  role: string
  name: string
  phone: string
  hours: string
  totalPayment: string
  deposit: string
  balance: string
}

const questionnaireFields = eventQuestionnaireSections.flatMap((section) => section.fields)
const questionnaireSectionsById = new Map(
  eventQuestionnaireSections.map((section) => [section.id, section] as const)
)

const editorSteps = [
  {
    id: 'step-1',
    title: 'פרטי בסיס',
    description: 'מידע ראשוני שחובה לפתיחת אירוע.',
    sectionIds: ['basics']
  },
  {
    id: 'step-2',
    title: 'פרטי זוג ומשפחה',
    description: 'שמות ופרטי קשר של המשפחה הקרובה.',
    sectionIds: ['family']
  },
  {
    id: 'step-3',
    title: 'לוגיסטיקה וחופה',
    description: 'הכנות תפעוליות וסדר טקס.',
    sectionIds: ['logistics', 'ceremony']
  },
  {
    id: 'step-4',
    title: 'רחבה ואירוח',
    description: 'הנחיות לרחבה, ציוד ואירוח.',
    sectionIds: ['dance', 'hospitality']
  },
  {
    id: 'step-5',
    title: 'מראה כלה',
    description: 'תכנון לוקים, שיער ואיפור.',
    sectionIds: ['bride_looks']
  },
  {
    id: 'step-6',
    title: 'ספקים ותשלומים',
    description: 'הוספת ספקים, תשלומים ושמירה.',
    sectionIds: [] as string[],
    includesSuppliers: true
  }
] as const

const totalSteps = editorSteps.length

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function stringifyNumber(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return ''
  return String(value)
}

function parseNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const decimalCandidate = trimmed.replace(',', '.')
  if (/^-?\d+(\.\d+)?$/.test(decimalCandidate)) {
    const parsedDecimal = Number(decimalCandidate)
    if (Number.isFinite(parsedDecimal)) return parsedDecimal
  }

  const digitsOnly = trimmed.replace(/\D/g, '')
  if (!digitsOnly) return null
  const parsedDigits = Number(digitsOnly)
  if (!Number.isFinite(parsedDigits)) return null
  return parsedDigits
}

function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, '')
}

function calculateGuestsMinusTwentyPercent(value: string) {
  const parsed = parseNumber(value)
  if (parsed === null) return ''
  return String(Math.max(0, Math.round(parsed * 0.8)))
}

function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => pruneUndefined(item)) as T
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype === Object.prototype || prototype === null) {
      const result: Record<string, unknown> = {}
      Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
        if (item !== undefined) {
          result[key] = pruneUndefined(item)
        }
      })
      return result as T
    }
  }
  return value
}

function eventWithoutId(event?: EventRecord): Partial<Omit<EventRecord, 'id'>> {
  if (!event) return {}
  const { id, ...rest } = event
  return rest
}

function mapSupplierToForm(supplier: SupplierRecord): SupplierFormState {
  return {
    id: supplier.id || makeId(),
    role: supplier.role || '',
    name: supplier.name || '',
    phone: stringifyNumber(supplier.phone),
    hours: supplier.hours || '',
    totalPayment: stringifyNumber(supplier.totalPayment),
    deposit: stringifyNumber(supplier.deposit),
    balance: stringifyNumber(supplier.balance)
  }
}

function defaultSupplier() {
  return {
    id: makeId(),
    role: '',
    name: '',
    phone: '',
    hours: '',
    totalPayment: '',
    deposit: '',
    balance: ''
  }
}

function isTrimField(kind: QuestionnaireField['kind']) {
  return kind === 'text' || kind === 'textarea' || kind === 'tel' || kind === 'select'
}

function inputTypeForField(kind: QuestionnaireField['kind']) {
  if (kind === 'textarea') return undefined
  if (kind === 'text') return 'text'
  return kind
}

export default function EventEditorView({
  event,
  onSave,
  onCancel,
  onDelete
}: {
  event?: EventRecord
  onSave: (payload: Omit<EventRecord, 'id'>) => Promise<void>
  onCancel: () => void
  onDelete: (eventId: string, coupleName: string) => Promise<void> | void
}) {
  const { eventId } = useParams()
  const [form, setForm] = useState<Record<EditableEventField, string>>(() =>
    createQuestionnaireFormState(event)
  )
  const [suppliers, setSuppliers] = useState<SupplierFormState[]>(
    event?.suppliers?.length ? event.suppliers.map((supplier) => mapSupplierToForm(supplier)) : [defaultSupplier()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [draftReady, setDraftReady] = useState(false)
  const draftKey = useMemo(
    () => `webose:event-draft:${eventId ?? event?.id ?? 'new'}`,
    [eventId, event?.id]
  )

  useEffect(() => {
    setDraftReady(false)
    if (typeof window === 'undefined') {
      setForm(createQuestionnaireFormState(event))
      setSuppliers(
        event?.suppliers?.length
          ? event.suppliers.map((supplier) => mapSupplierToForm(supplier))
          : [defaultSupplier()]
      )
      setCurrentStep(0)
      setError('')
      setDraftReady(true)
      return
    }

    const rawDraft = window.localStorage.getItem(draftKey)
    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft) as {
          form?: Record<EditableEventField, string>
          suppliers?: SupplierFormState[]
          currentStep?: number
        }
        const baseForm = createQuestionnaireFormState(event)
        if (draft.form) setForm({ ...baseForm, ...draft.form })
        else setForm(baseForm)

        if (Array.isArray(draft.suppliers) && draft.suppliers.length) {
          setSuppliers(draft.suppliers)
        } else {
          setSuppliers(
            event?.suppliers?.length
              ? event.suppliers.map((supplier) => mapSupplierToForm(supplier))
              : [defaultSupplier()]
          )
        }

        const nextStep =
          typeof draft.currentStep === 'number'
            ? Math.min(Math.max(draft.currentStep, 0), totalSteps - 1)
            : 0
        setCurrentStep(nextStep)
        setError('')
        setDraftReady(true)
        return
      } catch {
        window.localStorage.removeItem(draftKey)
      }
    }

    setForm(createQuestionnaireFormState(event))
    setSuppliers(
      event?.suppliers?.length
        ? event.suppliers.map((supplier) => mapSupplierToForm(supplier))
        : [defaultSupplier()]
    )
    setCurrentStep(0)
    setError('')
    setDraftReady(true)
  }, [event, draftKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !draftReady) return
    const payload = {
      form,
      suppliers,
      currentStep,
      updatedAt: Date.now()
    }
    window.localStorage.setItem(draftKey, JSON.stringify(payload))
  }, [form, suppliers, currentStep, draftKey, draftReady])

  const summaryQuestionsCount = useMemo(() => questionnaireFields.length, [])
  const activeStep = editorSteps[currentStep]
  const stepSections = useMemo(
    () =>
      activeStep.sectionIds
        .map((sectionId) => questionnaireSectionsById.get(sectionId))
        .filter((section): section is (typeof eventQuestionnaireSections)[number] => Boolean(section)),
    [activeStep]
  )
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  const updateField = (key: EditableEventField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateSupplier = (supplierId: string, key: keyof SupplierFormState, value: string) => {
    setSuppliers((prev) =>
      prev.map((supplier) => (supplier.id === supplierId ? { ...supplier, [key]: value } : supplier))
    )
  }

  const addSupplier = () => {
    setSuppliers((prev) => [...prev, defaultSupplier()])
  }

  const removeSupplier = (supplierId: string) => {
    setSuppliers((prev) => prev.filter((supplier) => supplier.id !== supplierId))
  }

  const goPrevStep = () => {
    if (isFirstStep) return
    setError('')
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }

  const goNextStep = () => {
    const nextStep = Math.min(currentStep + 1, totalSteps - 1)
    setError('')
    setCurrentStep(nextStep)
  }

  const goToStep = (targetStep: number) => {
    if (targetStep < 0 || targetStep > totalSteps - 1) return
    setError('')
    setCurrentStep(targetStep)
  }

  const canSaveFromAnyStep = form.coupleName.trim().length > 0

  const handleDelete = async () => {
    if (!event?.id) return
    const confirmed = window.confirm(`למחוק את האירוע של ${event.coupleName || 'הזוג'}?`)
    if (!confirmed) return
    try {
      await onDelete(event.id, event.coupleName || '')
      onCancel()
    } catch {
      window.alert('מחיקת האירוע נכשלה')
    }
  }

  const saveEvent = async ({ closeAfterSave }: { closeAfterSave: boolean }) => {
    if (!canSaveFromAnyStep) {
      setError('כדי לשמור צריך למלא קודם את שם הזוג.')
      return
    }

    setError('')

    const nextSuppliers: SupplierRecord[] = suppliers
      .filter((supplier) => supplier.role.trim() || supplier.name.trim())
      .map((supplier) => {
        const currentSupplier = event?.suppliers?.find((item) => item.id === supplier.id)
        const mappedSupplier: SupplierRecord = {
          ...(currentSupplier ?? {}),
          id: supplier.id,
          role: supplier.role.trim(),
          name: supplier.name.trim(),
          hours: supplier.hours.trim()
        }
        const phone = parseNumber(supplier.phone)
        if (phone !== null) mappedSupplier.phone = phone
        else delete mappedSupplier.phone
        const totalPayment = parseNumber(supplier.totalPayment)
        if (totalPayment !== null) mappedSupplier.totalPayment = totalPayment
        else delete mappedSupplier.totalPayment
        const deposit = parseNumber(supplier.deposit)
        if (deposit !== null) mappedSupplier.deposit = deposit
        else delete mappedSupplier.deposit
        const balance = parseNumber(supplier.balance)
        if (balance !== null) mappedSupplier.balance = balance
        else delete mappedSupplier.balance
        return mappedSupplier
      })

    const payloadDraft: Partial<Omit<EventRecord, 'id'>> = {
      ...eventWithoutId(event),
      suppliers: nextSuppliers
    }

    questionnaireFields.forEach((field) => {
      const currentValue = form[field.key] ?? ''
      if (questionnaireNumberFields.has(field.key)) {
        const parsed = parseNumber(currentValue)
        if (parsed !== null) payloadDraft[field.key] = parsed as never
        else payloadDraft[field.key] = undefined
        return
      }

      const normalized = isTrimField(field.kind) ? currentValue.trim() : currentValue
      payloadDraft[field.key] = normalized as never
    })

    setSaving(true)
    try {
      await onSave(pruneUndefined(payloadDraft) as Omit<EventRecord, 'id'>)
      if (typeof window !== 'undefined' && closeAfterSave) {
        window.localStorage.removeItem(draftKey)
      }
      window.alert('השמירה נשמרה בהצלחה')
      if (closeAfterSave) onCancel()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שמירה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (eventInput: React.FormEvent) => {
    // Keep the wizard manual: save only from explicit save button clicks.
    eventInput.preventDefault()
  }

  return (
    <form onSubmit={handleSubmit} className="page form wizard-flow">
      <section className="detail-head">
        <div>
          <h2 className="page-title">{event ? 'עריכת אירוע חתונה' : 'פתיחת אירוע חתונה חדש'}</h2>
          <p className="helper">
            מילוי השאלון מחולק ל־{totalSteps} שלבים ברורים. סך הכל {summaryQuestionsCount} שדות.
          </p>
        </div>
        <div className="form-actions">
          <button className="btn ghost" type="button" onClick={onCancel}>
            ביטול
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => saveEvent({ closeAfterSave: false })}
            disabled={saving || !canSaveFromAnyStep}
          >
            {saving ? 'שומר...' : 'שמירה'}
          </button>
          {event?.id ? (
            <button className="btn danger" type="button" onClick={handleDelete}>
              מחיקת אירוע
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="detail-section wizard-meta-panel">
        <div className="wizard-meta-head">
          <h3 className="section-title">
            שלב {currentStep + 1}: {activeStep.title}
          </h3>
          <p className="helper">{activeStep.description}</p>
        </div>
        <div className="wizard-step-grid">
          {editorSteps.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                type="button"
                className={`wizard-step-chip${index === currentStep ? ' active' : ''}${index < currentStep ? ' completed' : ''}`}
                onClick={() => goToStep(index)}
              >
                <span className="wizard-step-number">שלב {index + 1}</span>
                <span className="wizard-step-label">{step.title}</span>
              </button>
              {index < editorSteps.length - 1 ? (
                <span className="wizard-step-arrow" aria-hidden="true">
                  ←
                </span>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </section>

      <div className="wizard-stage-stack">
        {stepSections.map((section) => (
          <section key={section.id} className="detail-section wizard-stage-card">
            <div className="section-head split">
              <h3 className="section-title">{section.title}</h3>
              <p className="helper">{section.description}</p>
            </div>
            <div className="questionnaire-grid">
              {section.fields
                .filter(
                  (field) =>
                    !field.showWhen || (form[field.showWhen.key] ?? '') === field.showWhen.value
                )
                .map((field) => {
                  const commonProps = {
                    className: 'input',
                    value: form[field.key] ?? '',
                    onChange: (eventInput: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      updateField(field.key, eventInput.target.value),
                    placeholder: field.placeholder
                  }

                  const fieldInput =
                    field.kind === 'select' ? (
                      <label className="field">
                        {field.label}
                        <select
                          className="input"
                          value={form[field.key] ?? ''}
                          onChange={(eventInput) => updateField(field.key, eventInput.target.value)}
                        >
                          <option value="">בחר</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : field.kind === 'tel' ? (
                      <label className="field">
                        {field.label}
                        <input
                          className="input"
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={form[field.key] ?? ''}
                          placeholder={field.placeholder ?? '0501234567'}
                          onChange={(eventInput) =>
                            updateField(field.key, sanitizePhoneInput(eventInput.target.value))
                          }
                        />
                      </label>
                    ) : field.kind === 'textarea' ? (
                      <label className="field">
                        {field.label}
                        <textarea {...commonProps} rows={field.rows ?? 3} />
                      </label>
                    ) : (
                      <label className="field">
                        {field.label}
                        <input
                          {...commonProps}
                          type={inputTypeForField(field.kind)}
                          min={field.kind === 'number' ? 0 : undefined}
                        />
                      </label>
                    )

                  if (field.key !== 'guests') {
                    return <React.Fragment key={field.key}>{fieldInput}</React.Fragment>
                  }

                  return (
                    <React.Fragment key={field.key}>
                      {fieldInput}
                      <label className="field">
                        מספר אורחים משוער (20% פחות)
                        <input
                          className="input"
                          type="number"
                          value={calculateGuestsMinusTwentyPercent(form.guests ?? '')}
                          placeholder="מחושב אוטומטית"
                          readOnly
                        />
                      </label>
                    </React.Fragment>
                  )
                })}
            </div>
          </section>
        ))}
      </div>

      {'includesSuppliers' in activeStep && activeStep.includesSuppliers ? (
        <section className="detail-section">
          <div className="section-head split">
            <h3 className="section-title">ספקים ותשלומים</h3>
            <button type="button" className="btn ghost" onClick={addSupplier}>
              הוסף ספק
            </button>
          </div>
          <div className="editor-stack">
            {suppliers.map((supplier, index) => (
              <article key={supplier.id} className="supplier-editor-card">
                <div className="supplier-editor-head">
                  <h4>ספק #{index + 1}</h4>
                  <button type="button" className="btn danger" onClick={() => removeSupplier(supplier.id)}>
                    הסר
                  </button>
                </div>
                <div className="editor-grid">
                  <label className="field">
                    תחום
                    <input
                      className="input"
                      value={supplier.role}
                      placeholder="צילום / DJ / רב / בר"
                      onChange={(eventInput) => updateSupplier(supplier.id, 'role', eventInput.target.value)}
                    />
                  </label>
                  <label className="field">
                    שם ספק
                    <input
                      className="input"
                      value={supplier.name}
                      onChange={(eventInput) => updateSupplier(supplier.id, 'name', eventInput.target.value)}
                    />
                  </label>
                  <label className="field">
                    טלפון
                    <input
                      className="input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0501234567"
                      value={supplier.phone}
                      onChange={(eventInput) =>
                        updateSupplier(supplier.id, 'phone', sanitizePhoneInput(eventInput.target.value))
                      }
                    />
                  </label>
                  <label className="field">
                    שעת הגעה
                    <input
                      className="input"
                      type="time"
                      value={supplier.hours}
                      onChange={(eventInput) => updateSupplier(supplier.id, 'hours', eventInput.target.value)}
                    />
                  </label>
                  <label className="field">
                    עלות כוללת
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={supplier.totalPayment}
                      onChange={(eventInput) =>
                        updateSupplier(supplier.id, 'totalPayment', eventInput.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    מקדמה
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={supplier.deposit}
                      onChange={(eventInput) => updateSupplier(supplier.id, 'deposit', eventInput.target.value)}
                    />
                  </label>
                  <label className="field">
                    יתרה לתשום ביום האירוע
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={supplier.balance}
                      onChange={(eventInput) => updateSupplier(supplier.id, 'balance', eventInput.target.value)}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="detail-section wizard-actions-panel">
        <div className="wizard-actions-row">
          <button type="button" className="btn ghost" onClick={goPrevStep} disabled={isFirstStep || saving}>
            שלב קודם
          </button>
          {!isLastStep ? (
            <button type="button" className="btn primary" onClick={goNextStep} disabled={saving}>
              שלב הבא
            </button>
          ) : (
            <button
              className="btn primary"
              type="button"
              onClick={() => saveEvent({ closeAfterSave: true })}
              disabled={saving}
            >
              {saving ? 'שומר...' : 'שמירת אירוע'}
            </button>
          )}
        </div>
        <p className="helper">
          {isLastStep
            ? 'זה השלב האחרון. לאחר בדיקה אפשר לשמור את האירוע.'
            : `התקדמות: שלב ${currentStep + 1} מתוך ${totalSteps}.`}
        </p>
      </section>
    </form>
  )
}
