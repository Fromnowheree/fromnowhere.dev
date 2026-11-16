import type { Locale } from '../i18n/locales'

/** Admin config for array fields: label collapsed rows with the value of `field`, or with
 * `fallback` (in the editor's language) and the row number while it is empty. */
export const rowLabel = (field: string, fallback: Record<Locale, string>) => ({
  components: {
    RowLabel: {
      path: '/components/admin/RowLabel#RowLabel',
      clientProps: { field, fallback },
    },
  },
})
