import { useId } from 'react';

const Tooltip = ({ label, children, align = 'center' }) => {
  const id = useId();

  return (
    <span className="ui-tooltip-wrap" aria-describedby={id}>
      {children}
      <span className={`ui-tooltip tooltip-${align}`} role="tooltip" id={id}>{label}</span>
    </span>
  );
};

export default Tooltip;
