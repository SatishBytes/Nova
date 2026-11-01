import { UserRound } from 'lucide-react';

const Avatar = ({ name, email, className = '' }) => {
  const initials = (name || email || '')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  return (
    <span className={`ui-avatar ${className}`.trim()} aria-label={name || email || 'User'}>
      {initials || <UserRound size={17} aria-hidden="true" />}
    </span>
  );
};

export default Avatar;
