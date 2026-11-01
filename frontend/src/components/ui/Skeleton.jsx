const Skeleton = ({ className = '', ...props }) => (
  <div className={`ui-skeleton ${className}`.trim()} aria-hidden="true" {...props} />
);

export default Skeleton;
