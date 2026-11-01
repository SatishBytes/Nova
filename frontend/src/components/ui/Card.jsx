const Card = ({ as: Component = 'div', className = '', children, ...props }) => (
  <Component className={`ui-card ${className}`.trim()} {...props}>
    {children}
  </Component>
);

export default Card;
