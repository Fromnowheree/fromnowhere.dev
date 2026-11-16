'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef } from 'react'

import { Icon } from '@/components/fnw'
import { Link } from '@/i18n/navigation'
import { trackStatsEvent } from '@/lib/stats'
import { sendInquiry, type InquiryState } from './actions'
import { ProofOfWork } from './ProofOfWork'

const initialState: InquiryState = { status: 'idle' }

type FieldName = keyof NonNullable<InquiryState['errors']>

/** The system's Field (label above, error under), built from its `fnw-field` classes. */
export function ContactForm({
  privacyHref,
  formToken,
}: {
  /** The published privacy page, or null: then its name is plain text. */
  privacyHref: string | null
  /** The signed moment the page rendered the form, for the minimum fill-in time. */
  formToken: string
}) {
  const t = useTranslations('form')
  const locale = useLocale()
  const [state, action, pending] = useActionState(sendInquiry, initialState)
  const alertRef = useRef<HTMLParagraphElement>(null)
  const successRef = useRef<HTMLHeadingElement>(null)

  // Bring the result into view; keyed on the whole state, since two refusals in a row keep the
  // same status.
  useEffect(() => {
    if (state.status === 'success') trackStatsEvent('enquiry-sent')
    const target = state.status === 'success' ? successRef.current : alertRef.current
    if (state.status === 'idle' || !target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'start' })
  }, [state])

  if (state.status === 'success') {
    return (
      <div className="fnw-alert fnw-alert--success" role="status">
        <span className="fnw-alert__icon">
          <Icon name="check-circle" size={20} />
        </span>
        <div>
          <h2 ref={successRef} tabIndex={-1} className="fnw-alert__title">
            {t('sent')}
          </h2>
          <p className="fnw-alert__body">{state.message}</p>
        </div>
      </div>
    )
  }

  const values = state.values
  const alert = state.message ?? (state.status === 'error' ? t('fixFields') : undefined)
  const describedBy = (key: FieldName) => (state.errors?.[key] ? `${key}-error` : undefined)
  const error = (key: FieldName) =>
    state.errors?.[key] && (
      <span className="fnw-field__error" id={`${key}-error`}>
        {state.errors[key]}
      </span>
    )

  return (
    <form action={action} className="contact-form" noValidate>
      {/* The language the answers come back in. */}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="formStarted" value={formToken} />
      {alert && (
        <p className="fnw-alert fnw-alert--danger" role="alert" tabIndex={-1} ref={alertRef}>
          <span className="fnw-alert__icon">
            <Icon name="info" size={20} />
          </span>
          <span className="fnw-alert__body">{alert}</span>
        </p>
      )}
      <div className="contact-form__row">
        <div className="fnw-field">
          <label htmlFor="name" className="fnw-field__label">
            {t('name')}
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={values?.name}
            required
            aria-invalid={!!state.errors?.name}
            aria-describedby={describedBy('name')}
            className="fnw-input"
          />
          {error('name')}
        </div>
        <div className="fnw-field">
          <label htmlFor="email" className="fnw-field__label">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values?.email}
            required
            aria-invalid={!!state.errors?.email}
            aria-describedby={describedBy('email')}
            className="fnw-input"
          />
          {error('email')}
        </div>
      </div>
      <div className="fnw-field">
        <label htmlFor="message" className="fnw-field__label">
          {t('message')}
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          defaultValue={values?.message}
          aria-invalid={!!state.errors?.message}
          aria-describedby={describedBy('message')}
          className="fnw-input"
        />
        {error('message')}
      </div>
      {/* Honeypot: off screen for people, irresistible to bots. */}
      <div className="honeypot" aria-hidden>
        <label htmlFor="website">{t('website')}</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="fnw-field">
        <label className="fnw-check" htmlFor="consent">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            defaultChecked={values?.consent === 'on'}
            aria-invalid={!!state.errors?.consent}
            aria-describedby={describedBy('consent')}
          />
          <span className="fnw-check__box" aria-hidden>
            <svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
              <path
                d="M3.5 8.5l3 3 6-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            {t.rich('consent', {
              privacy: (chunks) =>
                privacyHref ? <Link href={privacyHref}>{chunks}</Link> : chunks,
            })}
          </span>
        </label>
        {error('consent')}
      </div>
      <ProofOfWork language={locale} />
      <div>
        <button className="fnw-btn fnw-btn--primary" type="submit" disabled={pending}>
          {pending ? t('sending') : t('submit')}
        </button>
      </div>
    </form>
  )
}
