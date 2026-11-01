import { useRef } from 'react';

const Dropdown = ({ trigger, label, children }) => {
  const detailsRef = useRef(null);

  const closeMenu = () => {
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className="ui-dropdown">
      <summary aria-label={label} className="ui-dropdown-trigger">
        {trigger}
      </summary>
      <div className="ui-dropdown-menu" role="menu" onClick={closeMenu}>
        {children}
      </div>
    </details>
  );
};

export default Dropdown;
