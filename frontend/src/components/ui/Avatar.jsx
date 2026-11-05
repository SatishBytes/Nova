import { UserRound } from 'lucide-react';

const Avatar = ({ name, email, color, className = '' }) => {
  const initials = (name || email || '')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const identity = name || email || 'user';
  const hue = [...identity].reduce((value, character) => (
    (value * 31 + character.charCodeAt(0)) % 360
  ), 0);

  return (
    <span
      className={`ui-avatar ${className}`.trim()}
      aria-label={name || email || 'User'}
      style={{ backgroundColor: color || `hsl(${hue} 52% 38%)`, color: '#ffffff' }}
    >
      {initials || <UserRound size={17} aria-hidden="true" />}
    </span>
  );
};

export default Avatar;
