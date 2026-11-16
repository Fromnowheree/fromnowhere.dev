'use client'

import type {} from 'altcha/types/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

/** The route that hands out puzzles: src/app/(frontend)/api/contact/challenge/route.ts. */
const CHALLENGE_PATH = '/api/contact/challenge'

/**
 * The self-hosted proof-of-work check (ALTCHA, decision 18). The widget fetches a puzzle from this
 * site, solves it in the visitor's browser and puts the answer in a hidden `altcha` field; it talks
 * to nothing else. With `auto="onsubmit"` the visitor need not do anything: pressing Send solves
 * the puzzle first and then sends. Ticking the box earlier solves it while they finish typing.
 *
 * The widget is a web component that needs `window`, so it is loaded in the browser only, and its
 * words come from this site's messages (form.proof) rather than its own translations. Human
 * interaction collection is switched off: nothing about the visitor's pointer or keyboard goes
 * anywhere. React resets the form after every answer from the action, and the widget resets with
 * it, so a refused send always gets a fresh puzzle.
 */
export function ProofOfWork({ language }: { language: string }) {
  const t = useTranslations('form.proof')
  const [loaded, setLoaded] = useState(false)

  const strings = {
    label: t('label'),
    loading: t('loading'),
    verify: t('verify'),
    verifying: t('verifying'),
    verified: t('verified'),
    verificationRequired: t('verificationRequired'),
    waitAlert: t('waitAlert'),
    error: t('error'),
    expired: t('expired'),
    reload: t('reload'),
  }
  const stringsKey = JSON.stringify(strings)

  useEffect(() => {
    let cancelled = false
    void import('altcha').then(() => {
      // The widget reads its words from a global registry, per language; set ours before it mounts,
      // over its English for the few it shows only in modes this site does not use.
      const registry = globalThis.$altcha.i18n
      registry.set(language, { ...registry.get('en'), ...JSON.parse(stringsKey) })
      if (!cancelled) setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [language, stringsKey])

  // The placeholder holds the widget's box (12px padding round a 22px box, 1px border), so the
  // button below does not jump when it loads. Both take their look from `.proof` in site.css.
  if (!loaded) return <div className="proof proof--placeholder" aria-hidden />
  return (
    <altcha-widget
      // The widget's look comes from its CSS variables, set from the system's tokens on `.proof`
      // (site.css), so it reads as one of the form's fields in both themes.
      className="proof"
      challenge={CHALLENGE_PATH}
      name="altcha"
      language={language}
      auto="onsubmit"
      configuration={JSON.stringify({
        hideFooter: true,
        hideLogo: true,
        humanInteractionSignature: false,
      })}
    />
  )
}
