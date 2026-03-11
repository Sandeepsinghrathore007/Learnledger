import { NAV_ITEMS } from '@/constants/navigation'
import { BG, BORDER, BORDER2, SURF2, TEXT1, TEXT2, TEXT3, ACCENT } from '@/constants/theme'
import {
  AIAssistantIcon,
  AnalyticsIcon,
  BackIcon,
  MockTestsIcon,
  NoteIcon,
  SubjectsIcon,
} from '@/components/ui/Icons'

const NAV_ICONS = {
  subjects: SubjectsIcon,
  notes: NoteIcon,
  tests: MockTestsIcon,
  ai: AIAssistantIcon,
  analytics: AnalyticsIcon,
}

function getUserInitial(user) {
  const source = user?.displayName || user?.email || 'User'
  return source.trim().charAt(0).toUpperCase()
}

function getUserLabel(user) {
  if (!user) return 'Guest User'
  return user.displayName || user.email || 'User'
}

export default function Sidebar({
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
  setMobileOpen = () => {},
}) {
  const isCompact = isMobile ? false : collapsed
  const width = isMobile ? '250px' : (isCompact ? '68px' : '228px')
  const transform = isMobile
    ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
    : 'translateX(0)'

  return (
    <aside style={{
      width,
      flexShrink: 0,
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      background: BG,
      borderRight: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 50,
      overflow: 'hidden',
      transform,
      boxShadow: isMobile ? '6px 0 30px rgba(0,0,0,0.45)' : 'none',
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
          background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
          borderRadius: '9px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: '800',
          color: '#fff',
          boxShadow: '0 0 16px rgba(124,58,237,0.4)',
        }}>
          S
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
                  ? 'linear-gradient(135deg,rgba(124,58,237,0.22),rgba(79,70,229,0.12))'
                  : 'transparent',
                color: isActive ? '#c4b5f5' : TEXT3,
                border: 'none',
                justifyContent: isCompact ? 'center' : 'flex-start',
                transition: 'all 0.16s',
                position: 'relative',
              }}
              onMouseEnter={(event) => {
                if (!isActive) {
                  event.currentTarget.style.background = 'rgba(139,92,246,0.08)'
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
                  ? `linear-gradient(135deg,${iconBg},rgba(255,255,255,0.03))`
                  : iconBg,
                border: `1px solid ${iconBorder}`,
                color: iconColor,
                boxShadow: isActive ? `0 10px 24px ${iconBg}` : 'none',
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
            background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '700',
          }}>
            {getUserInitial(user)}
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
                  background: 'rgba(139,92,246,0.1)',
                  color: '#c4b5f5',
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
                  background: 'linear-gradient(135deg,rgba(124,58,237,0.24),rgba(109,40,217,0.2))',
                  color: '#e9ddff',
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
                    background: 'rgba(139,92,246,0.1)',
                    color: '#c4b5f5',
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
                    background: 'linear-gradient(135deg,rgba(124,58,237,0.24),rgba(109,40,217,0.2))',
                    color: '#e9ddff',
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
            transition: 'all 0.2s',
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = '#2d2645')}
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
