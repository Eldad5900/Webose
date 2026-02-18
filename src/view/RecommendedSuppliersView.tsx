import React, { useMemo, useState } from 'react'
import type { RecommendedSupplierRecord } from '../controlers/types'
import PageHero from '../components/ui/PageHero'
import StatusMessages from '../components/ui/StatusMessages'

type SupplierFormState = {
  name: string
  category: string
  phone: string
}

const initialForm: SupplierFormState = {
  name: '',
  category: '',
  phone: ''
}

export default function RecommendedSuppliersView({
  suppliers,
  busy,
  error,
  onAdd
}: {
  suppliers: RecommendedSupplierRecord[]
  busy: boolean
  error: string
  onAdd: (payload: Omit<RecommendedSupplierRecord, 'id' | 'ownerId'>) => Promise<void>
}) {
  const [form, setForm] = useState<SupplierFormState>(initialForm)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const queryDigits = searchQuery.replace(/\D/g, '')

  const filteredSuppliers = useMemo(() => {
    if (!normalizedQuery) return suppliers

    return suppliers.filter((supplier) => {
      const nameValue = (supplier.name ?? '').toLowerCase()
      const categoryValue = (supplier.category ?? '').toLowerCase()
      const phoneValue = String(supplier.phone ?? '')
      const phoneDigits = phoneValue.replace(/\D/g, '')

      return (
        nameValue.includes(normalizedQuery) ||
        categoryValue.includes(normalizedQuery) ||
        phoneValue.includes(normalizedQuery) ||
        (queryDigits.length > 0 && phoneDigits.includes(queryDigits))
      )
    })
  }, [suppliers, normalizedQuery, queryDigits])

  const handleSubmit = async (eventInput: React.FormEvent) => {
    eventInput.preventDefault()
    setNotice('')
    setSaving(true)
    try {
      await onAdd({
        name: form.name.trim(),
        category: form.category.trim(),
        phone: form.phone.trim() || undefined
      })
      setForm(initialForm)
      setNotice('הספק נשמר בהצלחה ברשימת הספקים המומלצים שלך.')
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHero
        title="ספקים מומלצים"
        description="הרשימה מתחילה ריקה. ניתן להוסיף ספקים ידנית בלבד, וכל מה שמוצג כאן הוא רק מה שהוספת."
        actions={
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setNotice('')
              setShowForm((prev) => !prev)
            }}
          >
            {showForm ? 'סגירת טופס' : 'הוספת ספק'}
          </button>
        }
      />

      <StatusMessages busy={busy} error={error} notice={notice} />

      {showForm ? (
        <section className="detail-section recommended-form-panel">
          <h3 className="section-title">ספק חדש</h3>
          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              שם ספק
              <input
                className="input"
                placeholder="שם העסק או הספק"
                value={form.name}
                onChange={(eventInput) => setForm((prev) => ({ ...prev, name: eventInput.target.value }))}
                required
              />
            </label>
            <label className="field">
              תחום שירות
              <input
                className="input"
                placeholder="צילום / די-ג'יי / קייטרינג"
                value={form.category}
                onChange={(eventInput) =>
                  setForm((prev) => ({ ...prev, category: eventInput.target.value }))
                }
                required
              />
            </label>
            <label className="field">
              טלפון
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0501234567"
                value={form.phone}
                onChange={(eventInput) =>
                  setForm((prev) => ({ ...prev, phone: eventInput.target.value.replace(/\D/g, '') }))
                }
              />
            </label>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? 'שומר...' : 'שמירת ספק'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setShowForm(false)
                  setForm(initialForm)
                }}
              >
                ביטול
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="detail-section">
        <div className="section-head split">
          <h3 className="section-title">טבלת ספקים מומלצים</h3>
          <div className="recommended-table-tools">
            <p className="helper">סה״כ: {filteredSuppliers.length} מתוך {suppliers.length}</p>
            <input
              className="input recommended-search-input"
              placeholder="חיפוש לפי שם, תחום או טלפון"
              value={searchQuery}
              onChange={(eventInput) => setSearchQuery(eventInput.target.value)}
            />
          </div>
        </div>

        <div className="recommended-table-wrap">
          <table className="recommended-table">
            <thead>
              <tr>
                <th>שם ספק</th>
                <th>תחום</th>
                <th>טלפון</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length ? (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.name || '-'}</td>
                    <td>{supplier.category || '-'}</td>
                    <td>{supplier.phone || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr className="recommended-empty-row">
                  <td colSpan={3}>
                    {suppliers.length
                      ? 'לא נמצאו ספקים לפי החיפוש. נסה שם, תחום או טלפון אחר.'
                      : 'אין ספקים מומלצים עדיין. לחץ על “הוספת ספק” כדי להתחיל.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
