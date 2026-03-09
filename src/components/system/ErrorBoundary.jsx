/**
 * ErrorBoundary.jsx — Prevents full app blank screens on runtime errors.
 *
 * Displays a lightweight fallback with the actual error message so issues
 * can be diagnosed without opening browser devtools.
 */

import React from 'react'
import { BG, BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error, info) {
    // Keep full details in console for debugging.
    console.error('Learnledger runtime error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          background: BG,
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: 'min(680px, 100%)',
            border: `1px solid ${BORDER}`,
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.02)',
            padding: '18px 20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 8px',
              color: TEXT1,
              fontSize: '18px',
              fontWeight: '800',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              margin: '0 0 12px',
              color: TEXT2,
              fontSize: '13px',
              lineHeight: 1.6,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            The page crashed due to a runtime error. You can reload and continue.
          </p>
          <div
            style={{
              marginBottom: '14px',
              border: `1px solid ${BORDER}`,
              borderRadius: '10px',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 12px',
              color: '#fca5a5',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              fontFamily: "'Fira Code', monospace",
            }}
          >
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              border: 'none',
              borderRadius: '9px',
              padding: '9px 14px',
              background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '700',
            }}
          >
            Reload App
          </button>
          <div
            style={{
              marginTop: '10px',
              color: TEXT3,
              fontSize: '11px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Tip: open browser Console for full stack trace.
          </div>
        </div>
      </div>
    )
  }
}
