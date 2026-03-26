import { memo } from 'react'
import { NAV_ITEMS } from '@/constants/navigation'
import { ACCENT, BG, BORDER, BORDER2, BUTTON_GRADIENT, CONTROL_BG, SURF2, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import {
  AnalyticsIcon,
  BackIcon,
  MockTestsIcon,
  NoteIcon,
  QuestionBankIcon,
  SubjectsIcon,
} from '@/components/ui/Icons'

const NAV_ICONS = {
  subjects: SubjectsIcon,
  notes: NoteIcon,
  tests: MockTestsIcon,
  questionBank: QuestionBankIcon,
  analytics: AnalyticsIcon,
}

const DESKTOP_SIDEBAR_WIDTH = 228
const DESKTOP_COLLAPSED_WIDTH = 68

function getUserInitial(user) {
  const source = user?.displayName || user?.email || 'User'
  return source.trim().charAt(0).toUpperCase()
}

function getUserLabel(user) {
  if (!user) return 'Guest User'
  return user.displayName || user.email || 'User'
}

function Sidebar({
  collapsed,
  setCollapsed,
  activePage,
  setActivePage,
  onOpenLogin = () => {},
  onOpenSignup = () => {},
  onLogout = () => {},
  user = null,
  isMobile = false,
  mobileOpen = false,
  ultraLite = false,
  setMobileOpen = () => {},
}) {
  const isCompact = isMobile ? false : collapsed
  const width = isMobile
    ? '250px'
    : isCompact
      ? `${DESKTOP_COLLAPSED_WIDTH}px`
      : `${DESKTOP_SIDEBAR_WIDTH}px`
  const transform = isMobile
    ? (mobileOpen ? 'translate3d(0,0,0)' : 'translate3d(calc(-100% - 14px),0,0)')
    : 'translate3d(0,0,0)'
  const userInitial = getUserInitial(user)
  const itemTransition = ultraLite
    ? 'background 0.12s ease, color 0.12s ease'
    : 'background 0.16s ease, color 0.16s ease'

  return (
    <aside style={{
      width,
      flexShrink: 0,
      transition: ultraLite
        ? 'none'
        : isMobile
          ? 'transform 0.24s cubic-bezier(0.4,0,0.2,1)'
          : 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
      background: ultraLite ? 'rgba(6,11,20,0.98)' : BG,
      borderRight: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 50,
      overflow: isMobile ? 'hidden' : 'visible',
      transform,
      boxShadow: 'none',
      willChange: isMobile ? 'transform' : 'width',
      backfaceVisibility: 'hidden',
      contain: 'layout paint size',
      pointerEvents: isMobile && !mobileOpen ? 'none' : 'auto',
    }}>
      <div style={{
        padding: '17px 13px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderBottom: `1px solid ${BORDER}`,
        minHeight: '62px',
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          flexShrink: 0,
          background: BUTTON_GRADIENT,
          borderRadius: '9px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: '800',
          color: '#fff',
          boxShadow: 'var(--ll-shadow-soft)',
        }}>
          {userInitial}
        </div>
        {!isCompact && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ color: TEXT1, fontWeight: '700', fontSize: '14.5px', fontFamily: "'DM Sans',sans-serif", letterSpacing: '-0.3px' }}>
              Learnledger
            </div>
            <div style={{ color: TEXT3, fontSize: '10px', fontFamily: "'DM Sans',sans-serif" }}>
              Knowledge Hub
            </div>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: '9px 6px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ id, label, icon, iconColor, iconBg, iconBorder }) => {
          const isActive = activePage === id
          const Icon = NAV_ICONS[icon] || NoteIcon
          return (
            <button
              key={id}
              onClick={() => {
                setActivePage(id)
                if (isMobile) setMobileOpen(false)
              }}
              title={isCompact ? label : ''}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '2px',
                borderRadius: '9px',
                padding: isCompact ? '10px 16px' : '9px 11px',
                background: isActive
                  ? 'var(--ll-accent-soft)'
                  : 'transparent',
                color: isActive ? ACCENT : TEXT3,
                border: 'none',
                justifyContent: isCompact ? 'center' : 'flex-start',
                transition: itemTransition,
                position: 'relative',
              }}
              onMouseEnter={(event) => {
                if (!isActive) {
                  event.currentTarget.style.background = 'var(--ll-accent-soft)'
                  event.currentTarget.style.color = TEXT2
                }
              }}
              onMouseLeave={(event) => {
                if (!isActive) {
                  event.currentTarget.style.background = 'transparent'
                  event.currentTarget.style.color = TEXT3
                }
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  height: '60%',
                  width: '3px',
                  background: ACCENT,
                  borderRadius: '0 4px 4px 0',
                }} />
              )}
              <span style={{
                width: '28px',
                height: '28px',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '9px',
                background: isActive
                  ? ultraLite
                    ? iconBg
                    : `linear-gradient(135deg,${iconBg},rgba(255,255,255,0.03))`
                  : iconBg,
                border: `1px solid ${iconBorder}`,
                color: iconColor,
                boxShadow: isMobile || !isActive ? 'none' : `0 10px 24px ${iconBg}`,
              }}>
                <span style={{ width: '15px', height: '15px', display: 'inline-flex' }}>
                  <Icon />
                </span>
              </span>
              {!isCompact && (
                <span style={{
                  fontSize: '13px',
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: isActive ? '600' : '500',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '9px 6px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px',
          borderRadius: '9px',
          justifyContent: isCompact ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            flexShrink: 0,
            borderRadius: '50%',
            background: BUTTON_GRADIENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '700',
          }}>
            {userInitial}
          </div>
          {!isCompact && (
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: TEXT1,
                fontSize: '12.5px',
                fontWeight: '600',
                fontFamily: "'DM Sans',sans-serif",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {getUserLabel(user)}
              </div>
              <div style={{
                color: TEXT3,
                fontSize: '10px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user ? 'Firebase session active' : 'Not logged in'}
              </div>
            </div>
          )}
        </div>

        {!isCompact ? (
          user ? (
            <button
              type="button"
              onClick={() => {
                onLogout()
                if (isMobile) setMobileOpen(false)
              }}
              style={{
                width: '100%',
                marginTop: '7px',
                border: `1px solid ${BORDER2}`,
                background: 'rgba(239,68,68,0.1)',
                color: '#fca5a5',
                borderRadius: '8px',
                padding: '8px 9px',
                fontSize: '11.5px',
                fontWeight: '700',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Logout
            </button>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '7px' }}>
              <button
                type="button"
                onClick={() => {
                  onOpenLogin()
                  if (isMobile) setMobileOpen(false)
                }}
                style={{
                  border: `1px solid ${BORDER2}`,
                  background: 'var(--ll-accent-soft)',
                  color: TEXT1,
                  borderRadius: '8px',
                  padding: '8px 9px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenSignup()
                  if (isMobile) setMobileOpen(false)
                }}
                style={{
                  border: `1px solid ${BORDER2}`,
                  background: BUTTON_GRADIENT,
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 9px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Sign Up
              </button>
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '7px' }}>
            {user ? (
              <button
                type="button"
                title="Logout"
                onClick={() => {
                  onLogout()
                  if (isMobile) setMobileOpen(false)
                }}
                style={{
                  border: `1px solid ${BORDER2}`,
                  background: 'rgba(239,68,68,0.12)',
                  color: '#fca5a5',
                  borderRadius: '8px',
                  padding: '7px 0',
                  fontSize: '10px',
                  fontWeight: '700',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Out
              </button>
            ) : (
              <>
                <button
                  type="button"
                  title="Login"
                  onClick={() => {
                    onOpenLogin()
                    if (isMobile) setMobileOpen(false)
                  }}
                  style={{
                    border: `1px solid ${BORDER2}`,
                    background: 'var(--ll-accent-soft)',
                    color: TEXT1,
                    borderRadius: '8px',
                    padding: '7px 0',
                    fontSize: '10px',
                    fontWeight: '700',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Log
                </button>
                <button
                  type="button"
                  title="Sign Up"
                  onClick={() => {
                    onOpenSignup()
                    if (isMobile) setMobileOpen(false)
                  }}
                  style={{
                    border: `1px solid ${BORDER2}`,
                    background: BUTTON_GRADIENT,
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '7px 0',
                    fontSize: '10px',
                    fontWeight: '700',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Up
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!isMobile && (
        <button
          onClick={() => setCollapsed((value) => !value)}
          style={{
            position: 'absolute',
            top: '19px',
            right: '-11px',
            width: '22px',
            height: '22px',
            background: SURF2,
            border: `1px solid ${BORDER2}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT2,
            zIndex: 10,
            transition: 'background 0.2s ease, color 0.2s ease',
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = CONTROL_BG)}
          onMouseLeave={(event) => (event.currentTarget.style.background = SURF2)}
        >
          <span style={{
            width: '10px',
            height: '10px',
            display: 'block',
            transform: isCompact ? 'rotate(0)' : 'rotate(180deg)',
            transition: 'transform 0.3s',
          }}>
            <BackIcon />
          </span>
        </button>
      )}
    </aside>
  )
}

export default memo(Sidebar)
