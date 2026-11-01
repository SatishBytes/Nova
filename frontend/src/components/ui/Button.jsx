const variants = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  ghost: 'button-ghost',
  danger: 'button-danger',
};

const Button = ({
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  children,
  ...props
}) => (
  <button
    type={type}
    className={`ui-button ${variants[variant] || variants.primary} button-${size} ${className}`.trim()}
    {...props}
  >
    {children}
  </button>
);

export default Button;
