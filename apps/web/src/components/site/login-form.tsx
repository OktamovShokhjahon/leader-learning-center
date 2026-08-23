'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { LogIn, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { loginSchema, formatPhone, type LoginInput } from '@leader/shared/schemas'
import { HOME_PANEL, type Role } from '@leader/shared/permissions'
import { useRouter } from '@/i18n/navigation'
import { Field, inputClass } from './form-field'
import { cn } from '@/lib/utils'
import { describeDevice } from '@/lib/auth/device-name'

type Status = 'idle' | 'submitting' | 'error'

/**
 * TZ §8 — sign in with phone + password. A TOTP field appears only if the
 * account has opted into 2FA (see docs/adr/0002-optional-two-factor.md).
 *
 * The refresh token arrives as an httpOnly cookie via the BFF, and nothing is
 * kept here: §8 puts the access token in memory, and the panel mints its own
 * from the cookie when it mounts, so the token never crosses route groups.
 *
 * Error copy is resolved from the API's error *code*, never from its message:
 * the API must not send a user-facing sentence it cannot translate (§21.2).
 */
export function LoginForm() {
  const t = useTranslations('pages.login')
  const router = useRouter()

  const [status, setStatus] = useState<Status>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [totpRequired, setTotpRequired] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  /**
   * The API's error codes are an open set — a code we have no copy for must not
   * render a raw identifier at the user, so it falls back to the generic line.
   */
  const errorMessage = (code: string) =>
    t.has(`errors.${code}` as 'errors.UNKNOWN') ? t(`errors.${code}` as 'errors.UNKNOWN') : t('errors.UNKNOWN')

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting')
    setErrorCode(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...values,
          deviceName: describeDevice(navigator.userAgent),
        }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const code: string = body?.error?.code ?? 'UNKNOWN'
        // §8 — a SuperAdmin without a code gets a second field, not a failure.
        if (code === 'TOTP_REQUIRED') {
          setTotpRequired(true)
          setStatus('idle')
          return
        }
        setErrorCode(code)
        setStatus('error')
        return
      }

      const role: Role | undefined = body?.data?.user?.roles?.[0]?.role
      router.replace((role && HOME_PANEL[role]) || '/')
    } catch {
      setErrorCode('UPSTREAM_UNAVAILABLE')
      setStatus('error')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label={t('phone')} htmlFor="login-phone" error={errors.phone?.message}>
        <input
          id="login-phone"
          type="tel"
          inputMode="tel"
          autoComplete="username tel"
          placeholder="+998 90 123 45 67"
          className={cn(inputClass(!!errors.phone), 'font-mono')}
          {...register('phone', {
            onChange: (event) => setValue('phone', formatPhone(event.target.value)),
          })}
        />
      </Field>

      <Field label={t('password')} htmlFor="login-password" error={errors.password?.message}>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className={inputClass(!!errors.password)}
          {...register('password')}
        />
      </Field>

      {totpRequired ? (
        <Field
          label={t('totp')}
          htmlFor="login-totp"
          hint={t('totpHint')}
          error={errors.totpCode?.message}
        >
          <input
            id="login-totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            autoFocus
            className={cn(inputClass(!!errors.totpCode), 'font-mono tracking-[0.4em]')}
            {...register('totpCode')}
          />
        </Field>
      ) : null}

      {totpRequired && !errorCode ? (
        <p className="flex items-start gap-2 rounded-input border border-info/30 bg-info/5 p-3 text-xs text-info">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('totpPrompt')}
        </p>
      ) : null}

      {status === 'error' && errorCode ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger/5 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorMessage(errorCode)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="gradient-glaze mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-pill text-sm font-medium text-white shadow-raise transition-all hover:shadow-float hover:brightness-110 disabled:opacity-60"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('submitting')}
          </>
        ) : (
          <>
            <LogIn className="size-4" aria-hidden />
            {t('submit')}
          </>
        )}
      </button>

      <p className="text-center text-2xs text-ink-muted">{t('forgotHint')}</p>
    </form>
  )
}
