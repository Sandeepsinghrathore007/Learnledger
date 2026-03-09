import { useState } from 'react'
import {
  handleGoogleLogin,
  loginWithEmail,
  mapFirebaseAuthError,
} from '@/services/firebase/authService'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { resetCachedDeployedApp } from '@/utils/runtimeRecovery'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.86-3a7.18 7.18 0 0 1-10.69-3.77H1.41v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.33a7.2 7.2 0 0 1 0-4.66V6.58H1.41a12 12 0 0 0 0 10.84l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.78l3.43-3.43A11.96 11.96 0 0 0 1.41 6.58l3.99 3.09A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
  )
}

export default function LoginPage({ onSwitchToSignup, onLoginSuccess = () => {} }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password.trim()) {
      setError('Please enter email and password.')
      setNotice('')
      return
    }

    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      const user = await loginWithEmail({
        email: normalizedEmail,
        password,
      })

      setNotice('Logged in successfully.')
      onLoginSuccess(user)
    } catch (authError) {
      setError(mapFirebaseAuthError(authError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      const user = await handleGoogleLogin()
      setNotice('Signed in with Google.')
      onLoginSuccess(user)
    } catch (authError) {
      if (authError?.code === 'auth/unauthorized-domain') {
        const didResetCache = await resetCachedDeployedApp()

        if (didResetCache) {
          return
        }
      }

      setError(mapFirebaseAuthError(authError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in flex min-h-[calc(100vh-150px)] items-center justify-center">
      <div
        className="w-full max-w-md rounded-2xl p-5 sm:p-6"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${BORDER}`,
        }}
      >
        <h1
          style={{
            margin: '0 0 6px',
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '26px',
            fontWeight: '800',
          }}
        >
          Login
        </h1>
        <p
          style={{
            margin: '0 0 18px',
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
          }}
        >
          Access your Learnledger account.
        </p>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            className="learnledger-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            autoComplete="email"
          />
          <input
            className="learnledger-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />

          {error && (
            <div
              style={{
                border: '1px solid rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.08)',
                borderRadius: '10px',
                color: '#fca5a5',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                padding: '8px 10px',
              }}
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              style={{
                border: '1px solid rgba(34,197,94,0.35)',
                background: 'rgba(34,197,94,0.08)',
                borderRadius: '10px',
                color: '#86efac',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                padding: '8px 10px',
              }}
            >
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              border: 'none',
              borderRadius: '10px',
              padding: '11px 14px',
              background: isSubmitting
                ? 'rgba(139,92,246,0.45)'
                : 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '700',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1" style={{ background: BORDER }} />
          <span
            style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
            }}
          >
            or
          </span>
          <span className="h-px flex-1" style={{ background: BORDER }} />
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleGoogleSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="mt-4 border-t pt-3" style={{ borderColor: BORDER }}>
          <p
            style={{
              margin: 0,
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
            }}
          >
            New user?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#a78bfa',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '700',
                padding: 0,
              }}
            >
              Create account
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
