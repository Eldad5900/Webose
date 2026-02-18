import type { EventRecord } from './types'

export type EditableEventField = Exclude<
  keyof EventRecord,
  'id' | 'ownerId' | 'createdAt' | 'suppliers'
>

export type QuestionKind = 'text' | 'tel' | 'number' | 'date' | 'time' | 'textarea' | 'select'

export type QuestionnaireField = {
  key: EditableEventField
  label: string
  kind: QuestionKind
  placeholder?: string
  required?: boolean
  rows?: number
  options?: string[]
  showWhen?: {
    key: EditableEventField
    value: string
  }
}

export type QuestionnaireSection = {
  id: string
  title: string
  description: string
  defaultOpen?: boolean
  fields: QuestionnaireField[]
}

const yesNoMaybeOptions = ['כן', 'לא', 'כן אבל']
const existsNotExistsOptions = ['קיים', 'לא קיים']
const parentsEscortDefaultValue = 'על ידי ההורים'

export const eventQuestionnaireSections: QuestionnaireSection[] = [
  {
    id: 'basics',
    title: 'פרטי בסיס',
    description: 'נתונים שחייבים לכל אירוע כדי להתחיל עבודה מסודרת.',
    defaultOpen: true,
    fields: [
      { key: 'coupleName', label: 'שם אירוע', kind: 'text', required: true },
      { key: 'date', label: 'תאריך האירוע', kind: 'date', required: true },
      { key: 'hall', label: 'אולם / גן אירועים', kind: 'text', required: true },
      { key: 'status', label: 'סטטוס הפקה', kind: 'text', placeholder: 'לדוגמה: סגירת ספקים' },
      { key: 'guests', label: 'מספר אורחים משוער', kind: 'number' },
      { key: 'budget', label: 'תקציב כולל', kind: 'number' },
      { key: 'contactPhone', label: 'טלפון קשר ראשי', kind: 'tel' }
    ]
  },
  {
    id: 'family',
    title: 'פרטי זוג ומשפחה',
    description: 'שמות וטלפונים למשפחה קרובה.',
    fields: [
      { key: 'groomName', label: 'שם חתן', kind: 'text' },
      { key: 'brideName', label: 'שם כלה', kind: 'text' },
      { key: 'groomFatherName', label: 'שם אב החתן', kind: 'text' },
      { key: 'groomMotherName', label: 'שם אם החתן', kind: 'text' },
      { key: 'groomFatherPhone', label: 'טלפון אב החתן', kind: 'tel' },
      { key: 'groomMotherPhone', label: 'טלפון אם החתן', kind: 'tel' },
      { key: 'brideFatherName', label: 'שם אב הכלה', kind: 'text' },
      { key: 'brideMotherName', label: 'שם אם הכלה', kind: 'text' },
      { key: 'brideFatherPhone', label: 'טלפון אב הכלה', kind: 'tel' },
      { key: 'brideMotherPhone', label: 'טלפון אם הכלה', kind: 'tel' }
    ]
  },
  {
    id: 'logistics',
    title: 'לוגיסטיקה והכנות',
    description: 'הכנות מקדימות וליווי יום האירוע.',
    fields: [
      { key: 'groomPrepLocation', label: 'מיקום התארגנות חתן', kind: 'text' },
      { key: 'bridePrepLocation', label: 'מיקום התארגנות כלה', kind: 'text' },
      { key: 'groomEscort', label: 'מלווה חתן', kind: 'text' },
      { key: 'groomEscortPhone', label: 'טלפון מלווה חתן', kind: 'tel' },
      { key: 'brideEscort', label: 'מלווה כלה', kind: 'text' },
      { key: 'brideEscortPhone', label: 'טלפון מלווה כלה', kind: 'tel' },
      { key: 'arrivalTimeToHall', label: 'שעת הגעה לאולם', kind: 'time' },
      { key: 'eventHours', label: 'שעות האירוע', kind: 'text' },
      { key: 'eventManager', label: 'מנהל אירוע', kind: 'text' },
      { key: 'chairsCommitment', label: 'התחייבות כיסאות', kind: 'text' },
      { key: 'spareChairs', label: 'כיסאות רזרבה', kind: 'text' },
      { key: 'authorizedSigner', label: 'מורשה חתימה', kind: 'text' },
      { key: 'arrivalConfirmationsCompany', label: 'חברת אישורי הגעה', kind: 'text' },
      { key: 'seatingCompany', label: 'חברת הושבה', kind: 'text' },
      { key: 'seatingManagerPhone', label: 'טלפון מנהל הושבה', kind: 'tel' }
    ]
  },
  {
    id: 'ceremony',
    title: 'חופה וטקס',
    description: 'סדר האירוע, שירים ונקודות טקס.',
    fields: [
      { key: 'groomWithEscort', label: 'חתן בליווי', kind: 'text' },
      { key: 'brideWithEscort', label: 'כלה בליווי', kind: 'text' },
      { key: 'groomEntrySong', label: 'שיר כניסת חתן', kind: 'text' },
      { key: 'brideEntrySong', label: 'שיר כניסת כלה', kind: 'text' },
      { key: 'siblingsEntry', label: 'כניסת אחים/אחיות', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'siblingsEntrySong',
        label: 'שיר כניסת אחים/אחיות',
        kind: 'text',
        showWhen: { key: 'siblingsEntry', value: 'כן' }
      },
      { key: 'waitingAtChuppah', label: 'מי ממתין בחופה', kind: 'text' },
      { key: 'glassBreakSong', label: 'שיר שבירת כוס', kind: 'text' },
      { key: 'afterShoeshbinim', label: 'אחרי שושבינים', kind: 'text' },
      { key: 'afterRings', label: 'אחרי טבעות', kind: 'text' },
      { key: 'wineAtChuppah', label: 'יין בחופה', kind: 'select', options: ['אדום', 'לבן'] },
      { key: 'bridesBlessing', label: 'ברכת כלה', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'bridesBlessingNote',
        label: 'הערת ברכת כלה',
        kind: 'text',
        showWhen: { key: 'bridesBlessing', value: 'כן אבל' }
      },
      {
        key: 'ushersOrPullCouple',
        label: 'נשארים לברך / לשלוף את הזוג',
        kind: 'select',
        options: ['נשארים לברך', 'לשלוף את הזוג']
      },
      { key: 'witnesses', label: 'עדים', kind: 'text' }
    ]
  },
  {
    id: 'dance',
    title: 'רחבה ומסיבה',
    description: 'הנחיות לרחבה ולהפרדה במידת הצורך.',
    fields: [
      {
        key: 'alcoholSource',
        label: 'אלכוהול',
        kind: 'select',
        options: ['חברה חיצונית', 'אישית']
      },
      {
        key: 'danceSeparationBarcodes',
        label: 'הפרדה ברקודים',
        kind: 'text'
      },
      { key: 'slowDance', label: 'ריקוד סלואו', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'slowDanceNote',
        label: 'הערת ריקוד סלואו',
        kind: 'text',
        showWhen: { key: 'slowDance', value: 'כן אבל' }
      }
    ]
  },
  {
    id: 'hospitality',
    title: 'ציוד ואירוח',
    description: 'ציוד לחלוקה והערות לוגיסטיות.',
    fields: [
      { key: 'menus', label: 'תפריטים', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'menusNote',
        label: 'הערת תפריטים',
        kind: 'text',
        showWhen: { key: 'menus', value: 'כן אבל' }
      },
      { key: 'kippot', label: 'כיפות', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'kippotNote',
        label: 'הערת כיפות',
        kind: 'text',
        showWhen: { key: 'kippot', value: 'כן אבל' }
      },
      { key: 'fans', label: 'מניפות', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'fansNote',
        label: 'הערת מניפות',
        kind: 'text',
        showWhen: { key: 'fans', value: 'כן אבל' }
      },
      {
        key: 'organizationBaskets',
        label: 'סלי התארגנות',
        kind: 'select',
        options: yesNoMaybeOptions
      },
      {
        key: 'organizationBasketsNote',
        label: 'הערת סלי התארגנות',
        kind: 'text',
        showWhen: { key: 'organizationBaskets', value: 'כן אבל' }
      },
      { key: 'grapeJuice', label: 'מיץ ענבים', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'grapeJuiceNote',
        label: 'הערת מיץ ענבים',
        kind: 'text',
        showWhen: { key: 'grapeJuice', value: 'כן אבל' }
      },
      { key: 'sunglasses', label: 'משקפי שמש', kind: 'select', options: yesNoMaybeOptions },
      {
        key: 'sunglassesNote',
        label: 'הערת משקפי שמש',
        kind: 'text',
        showWhen: { key: 'sunglasses', value: 'כן אבל' }
      },
      {
        key: 'gummiesAndTools',
        label: 'גומיות וכלי חירום',
        kind: 'select',
        options: yesNoMaybeOptions
      },
      {
        key: 'gummiesAndToolsNote',
        label: 'הערת גומיות וכלים',
        kind: 'text',
        showWhen: { key: 'gummiesAndTools', value: 'כן אבל' }
      }
    ]
  },
  {
    id: 'bride_looks',
    title: 'מראה כלה',
    description: 'תכנון לוקים ואנשי מקצוע.',
    fields: [
      { key: 'brideLook1Makeup', label: 'לוק 1 - איפור', kind: 'select', options: existsNotExistsOptions },
      { key: 'brideLook1Hair', label: 'לוק 1 - שיער', kind: 'select', options: existsNotExistsOptions },
      { key: 'brideLook2Makeup', label: 'לוק 2 - איפור', kind: 'select', options: existsNotExistsOptions },
      { key: 'brideLook2Hair', label: 'לוק 2 - שיער', kind: 'select', options: existsNotExistsOptions },
      { key: 'brideLook3Makeup', label: 'לוק 3 - איפור', kind: 'select', options: existsNotExistsOptions },
      { key: 'brideLook3Hair', label: 'לוק 3 - שיער', kind: 'select', options: existsNotExistsOptions },
      {
        key: 'brideNotes',
        label: 'הערות ודגשים למנהל האירוע',
        kind: 'textarea',
        rows: 3,
        placeholder: 'רגישויות, דגשים, סדר החלפות...'
      }
    ]
  }
]

const allFields = eventQuestionnaireSections.flatMap((section) => section.fields)

export const questionnaireNumberFields = new Set<EditableEventField>(
  allFields.filter((field) => field.kind === 'number' || field.kind === 'tel').map((field) => field.key)
)

export const questionnaireRequiredFields = new Set<EditableEventField>(
  allFields.filter((field) => field.required).map((field) => field.key)
)

export function createQuestionnaireFormState(event?: EventRecord) {
  const initialState: Record<EditableEventField, string> = {} as Record<EditableEventField, string>

  allFields.forEach((field) => {
    const rawValue = event?.[field.key]
    if (typeof rawValue === 'number') {
      initialState[field.key] = rawValue > 0 ? String(rawValue) : ''
      return
    }
    if (typeof rawValue === 'string') {
      if (
        (field.key === 'groomWithEscort' || field.key === 'brideWithEscort') &&
        !rawValue.trim()
      ) {
        initialState[field.key] = parentsEscortDefaultValue
        return
      }
      initialState[field.key] = rawValue
      return
    }
    if (field.key === 'groomWithEscort' || field.key === 'brideWithEscort') {
      initialState[field.key] = parentsEscortDefaultValue
      return
    }
    initialState[field.key] = ''
  })

  return initialState
}
