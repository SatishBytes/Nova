import { forwardRef } from 'react';

const Input = forwardRef(({ as: Component = 'input', className = '', ...props }, ref) => (
  <Component ref={ref} className={`ui-input ${className}`.trim()} {...props} />
));

export default Input;
