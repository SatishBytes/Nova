import { forwardRef } from 'react';

const variants = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  ghost: 'button-ghost',
  danger: 'button-danger',
};

const Button = forwardRef(({
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    className={`ui-button ${variants[variant] || variants.primary} button-${size} ${className}`.trim()}
    {...props}
  >
    {children}
  </button>
));

export default Button;
