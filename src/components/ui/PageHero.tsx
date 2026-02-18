import React from 'react'

export default function PageHero({
  title,
  description,
  actions
}: {
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <section className="hero-block">
      <div>
        <h2 className="page-title">{title}</h2>
        <p className="helper hero-copy">{description}</p>
      </div>
      {actions ? <div className="hero-right">{actions}</div> : null}
    </section>
  )
}
