export type SupplierRecord = {
  id: string
  role: string
  name?: string
  phone?: number
  hours?: string
  totalPayment?: number
  deposit?: number
  balance?: number
  paymentReceivedAmount?: number
  paymentReceivedHours?: string
  paymentReceivedDate?: string
  paymentReceivedName?: string
  paymentReceivedSignature?: string
  hasSigned?: boolean
}

export type EventRecord = {
  id: string
  ownerId?: string
  coupleName: string
  createdAt?: number
  groomName?: string
  brideName?: string
  groomFatherName?: string
  groomMotherName?: string
  groomFatherPhone?: number
  groomMotherPhone?: number
  brideFatherName?: string
  brideMotherName?: string
  brideFatherPhone?: number
  brideMotherPhone?: number
  brideNotes?: string
  suppliers?: SupplierRecord[]
  date: string
  hall: string
  notes?: string
  budget?: number | null
  guests?: number | null
  status?: string
  contactPhone?: number
  groomEscort?: string
  brideEscort?: string
  groomEntrySong?: string
  brideEntrySong?: string
  siblingsEntry?: string
  siblingsEntrySong?: string
  waitingAtChuppah?: string
  glassBreakSong?: string
  afterShoeshbinim?: string
  afterRings?: string
  wineAtChuppah?: string
  bridesBlessing?: string
  bridesBlessingNote?: string
  ushersOrPullCouple?: string
  witnesses?: string
  danceSeparationBarcodes?: string
  danceSeparationBarcodesNote?: string
  danceSeparationWedding?: string
  danceSeparationWeddingNote?: string
  slowDance?: string
  slowDanceNote?: string
  menus?: string
  menusNote?: string
  kippot?: string
  kippotNote?: string
  fans?: string
  organizationBaskets?: string
  grapeJuice?: string
  sunglasses?: string
  gummiesAndTools?: string
  fansNote?: string
  organizationBasketsNote?: string
  grapeJuiceNote?: string
  sunglassesNote?: string
  gummiesAndToolsNote?: string
  groomPrepLocation?: string
  groomEscortPhone?: number
  bridePrepLocation?: string
  brideEscortPhone?: number
  arrivalTimeToHall?: string
  brideLook1Makeup?: string
  brideLook1Hair?: string
  brideLook2Makeup?: string
  brideLook2Hair?: string
  brideLook3Makeup?: string
  brideLook3Hair?: string
}

export type MeetingRecord = {
  id: string
  ownerId?: string
  coupleName: string
  location: string
  date: string
  time: string
}

export type RecommendedSupplierRecord = {
  id: string
  ownerId?: string
  name: string
  category: string
  phone?: string
  city?: string
  notes?: string
}
