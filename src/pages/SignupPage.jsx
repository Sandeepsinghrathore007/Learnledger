import { useState } from 'react'
import { mapFirebaseAuthError, signUpWithEmail } from '@/services/firebase/authService'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default function SignupPage({ onSwitchToLogin, onSignupSuccess = () => {} }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!fullName.trim() || !normalizedEmail || !password.trim() || !confirmPassword.trim()) {
      setError('Please complete all fields.')
      setNotice('')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setNotice('')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setNotice('')
      return
    }

    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      const user = await signUpWithEmail({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
      })

      setNotice('Account created successfully.')
      onSignupSuccess(user)
    } catch (authError) {
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
          Sign Up
        </h1>
        <p
          style={{
            margin: '0 0 18px',
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
          }}
        >
          Create your Learnledger account.
        </p>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            className="learnledger-input"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            autoComplete="name"
          />
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
            autoComplete="new-password"
          />
          <input
            className="learnledger-input"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
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
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 border-t pt-3" style={{ borderColor: BORDER }}>
          <p
            style={{
              margin: 0,
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
            }}
          >
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
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
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
