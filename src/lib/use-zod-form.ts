import { useCallback, useRef, useState } from 'react'
import type { z } from 'zod'
import { toApiError } from '@/api/errors'

type Errors<T> = Partial<Record<keyof T | '_form', string>>

/**
 * Minimal form state with zod validation:
 *  - validates a field on blur (after it was touched) and everything on submit;
 *  - maps API `fieldErrors` back onto the fields;
 *  - focuses the first invalid field on submit (keyboard/screen-reader UX).
 */
/** Form values: the schema input, where any field may also be '' (unselected). */
export type FormValues<S extends z.ZodType> = { [K in keyof z.input<S>]: z.input<S>[K] | '' }

export function useZodForm<S extends z.ZodType<Record<string, unknown>>, V extends FormValues<S> = FormValues<S>>(
  schema: S,
  initial: V,
) {
  const [values, setValues] = useState<V>(initial)
  const [errors, setErrors] = useState<Errors<V>>({})
  const touched = useRef(new Set<string>())
  const initialRef = useRef(initial)
  const formRef = useRef<HTMLFormElement>(null)

  const validateAll = useCallback(
    (v: V) => {
      const res = schema.safeParse(v)
      if (res.success) return { ok: true as const, data: res.data as z.output<S>, errors: {} as Errors<V> }
      const errs: Errors<V> = {}
      for (const issue of res.error.issues) {
        const key = String(issue.path[0] ?? '_form') as keyof V
        errs[key] ??= issue.message
      }
      return { ok: false as const, errors: errs }
    },
    [schema],
  )

  const setField = useCallback(
    <K extends keyof V>(key: K, value: V[K]) => {
      setValues((prev) => {
        const next = Object.assign({}, prev, { [key]: value }) as V
        if (touched.current.has(String(key))) {
          const { errors: errs } = validateAll(next)
          setErrors((e) => ({ ...e, [key]: errs[key], _form: undefined }))
        }
        return next
      })
    },
    [validateAll],
  )

  /** Validate on blur only fields the user actually changed. */
  const blur = useCallback(
    (key: keyof V) => {
      if (values[key] === initialRef.current[key] && !touched.current.has(String(key))) return
      touched.current.add(String(key))
      const { errors: errs } = validateAll(values)
      setErrors((e) => ({ ...e, [key]: errs[key] }))
    },
    [validateAll, values],
  )

  const focusFirstError = (errs: Errors<V>) => {
    const first = Object.keys(errs).find((k) => k !== '_form' && errs[k as keyof V])
    if (!first) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)
    el?.focus()
  }

  /** Validates everything; returns parsed data or null (and shows errors). */
  const validate = useCallback((): z.output<S> | null => {
    Object.keys(values as object).forEach((k) => touched.current.add(k))
    const res = validateAll(values)
    setErrors(res.errors)
    if (!res.ok) {
      requestAnimationFrame(() => focusFirstError(res.errors))
      return null
    }
    return res.data
  }, [validateAll, values])

  /** Show API validation errors next to fields. */
  const applyServerError = useCallback((err: unknown, fallback?: string) => {
    const e = toApiError(err)
    const errs: Errors<V> = {}
    // Nested API paths ("wallet.address") map to the leaf field name.
    for (const [k, msg] of Object.entries(e.fieldErrors)) errs[k.split('.').pop() as keyof V] = msg
    if (!Object.keys(errs).length || (e.code !== 'VALIDATION_ERROR' && e.code !== 'CONFLICT')) {
      errs._form = fallback ? `${fallback} ${e.message}` : e.message
    }
    setErrors(errs)
    requestAnimationFrame(() => focusFirstError(errs))
  }, [])

  const field = <K extends keyof V & string>(key: K) => ({
    name: key,
    value: (values[key] ?? '') as string,
    error: errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setField(key, e.target.value as V[K]),
    onBlur: () => blur(key),
  })

  return {
    values,
    setValues,
    setField,
    errors,
    setErrors,
    field,
    blur,
    validate,
    applyServerError,
    formRef,
    reset: (v: V) => {
      touched.current.clear()
      setErrors({})
      setValues(v)
    },
  }
}
