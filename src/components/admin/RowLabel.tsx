'use client'

import { useRowLabel, useTranslation } from '@payloadcms/ui'

import { pickLabel } from '@/i18n/label'
import type { Locale } from '@/i18n/locales'

/** Shows a row's own text (e.g. the price group name) instead of "Item 01" in collapsed arrays. */
export function RowLabel({ field, fallback }: { field: string; fallback: Record<Locale, string> }) {
  const { data, rowNumber } = useRowLabel<Record<string, unknown>>()
  const { i18n } = useTranslation()
  const value = data?.[field]
  if (typeof value === 'string' && value) return <>{value}</>
  return <>{`${pickLabel(i18n.language, fallback)} ${(rowNumber ?? 0) + 1}`}</>
}
