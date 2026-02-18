import React from 'react'

export default function StatCard({
  label,
  value,
  foot
}: {
  label: string
  value: React.ReactNode
  foot?: React.ReactNode
}) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {foot ? <p className="stat-foot">{foot}</p> : null}
    </article>
  )
}
