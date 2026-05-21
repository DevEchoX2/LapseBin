import { useMemo, useState } from 'react'
import { submitWaitlist } from '../api'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function PremiumHub() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isValid = useMemo(() => EMAIL_REGEX.test(email.trim()), [email])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!isValid) {
      setError('Please enter a valid email address.')
      return
    }

    try {
      await submitWaitlist(email.trim())
      setMessage('Added to premium waitlist.')
      setEmail('')
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Premium Tier / Coming Soon</h2>
      </header>
      <ul className="feature-list">
        <li>Unlimited session length</li>
        <li>4K resolution upscaling</li>
        <li>Dedicated GPU priority allocation</li>
      </ul>

      <form className="waitlist" onSubmit={onSubmit}>
        <label htmlFor="waitlist-email">Join waitlist</label>
        <input
          id="waitlist-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ops@company.com"
          autoComplete="email"
          required
        />
        <p className={`validation ${email.length === 0 || isValid ? 'ok' : 'bad'}`}>
          {email.length === 0 || isValid ? 'Email format valid' : 'Email format invalid'}
        </p>
        <button className="action-btn" type="submit">
          Reserve Spot
        </button>
      </form>

      {message && <p className="success-msg">{message}</p>}
      {error && <p className="error-msg">{error}</p>}
    </section>
  )
}
