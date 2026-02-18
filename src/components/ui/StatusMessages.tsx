import React from 'react'

export default function StatusMessages({
  busy,
  busyLabel = 'טוען...',
  error,
  notice
}: {
  busy?: boolean
  busyLabel?: string
  error?: string
  notice?: string
}) {
  return (
    <>
      {busy ? <div className="helper">{busyLabel}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="helper notice">{notice}</div> : null}
    </>
  )
}
