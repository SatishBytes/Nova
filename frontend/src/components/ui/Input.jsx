const Input = ({ as: Component = 'input', className = '', ...props }) => (
  <Component className={`ui-input ${className}`.trim()} {...props} />
);

export default Input;
