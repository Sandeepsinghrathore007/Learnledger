export default function PrimaryCtaButton({
  children,
  className = '',
  disabled = false,
  icon: Icon = null,
  onClick,
  style,
  type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={['learnledger-cta', className].filter(Boolean).join(' ')}
      style={style}
    >
      <span className="learnledger-cta__glow" aria-hidden="true" />
      {Icon ? (
        <span className="learnledger-cta__icon" aria-hidden="true">
          <span className="learnledger-cta__icon-svg">
            <Icon />
          </span>
        </span>
      ) : null}
      <span className="learnledger-cta__label">{children}</span>
    </button>
  )
}
