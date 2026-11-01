import { FolderOpen } from 'lucide-react';

const EmptyState = ({ icon: Icon = FolderOpen, title, description, action }) => (
  <div className="empty-state">
    <span className="empty-state-icon">
      <Icon size={22} aria-hidden="true" />
    </span>
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
