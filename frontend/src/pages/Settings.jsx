import { useState } from 'react';
import { Download, Monitor, Moon, Sun, LogOut, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import api from '../api/axiosInstance';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import usePageTitle from '../hooks/usePageTitle';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const Settings = () => {
  usePageTitle('Settings');
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [accountError, setAccountError] = useState('');

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setSigningOut(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    setAccountError('');
    try {
      const { data } = await api.get('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'nova-data-export.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setAccountError(error.response?.data?.error || 'Unable to export account data.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    if (deleteEmail.trim().toLowerCase() !== user?.email?.toLowerCase()) {
      setAccountError('Enter your account email exactly to confirm deletion.');
      return;
    }
    setDeleting(true);
    setAccountError('');
    try {
      await api.delete('/account', { data: { email: deleteEmail.trim() } });
      await logout({ scope: 'local' });
      navigate('/login', { replace: true });
    } catch (error) {
      setAccountError(error.response?.data?.error || 'Unable to delete your account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-page">
      <Navbar pageTitle="Settings" />
      <main className="page-container">
        <header className="page-header">
          <div>
            <h1 className="page-heading">Settings</h1>
            <p className="mt-1 text-sm text-muted">Personalize your NOVA workspace.</p>
          </div>
        </header>

        <div className="settings-layout">
          <Card className="settings-card">
            <div className="settings-section-heading">
              <span className="settings-icon"><UserRound size={18} aria-hidden="true" /></span>
              <div>
                <h2>Profile</h2>
                <p>Account details associated with your workspace.</p>
              </div>
            </div>
            <div className="settings-profile">
              <Avatar name={user?.user_metadata?.display_name} email={user?.email} className="!h-12 !w-12" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.user_metadata?.display_name || 'NOVA member'}</p>
                <p className="truncate text-sm text-muted">{user?.email}</p>
              </div>
            </div>
            <p className="settings-note">Profile editing isn’t available yet. Your account email is managed by Supabase Auth.</p>
          </Card>

          <Card className="settings-card">
            <div className="settings-section-heading">
              <span className="settings-icon"><Monitor size={18} aria-hidden="true" /></span>
              <div>
                <h2>Appearance</h2>
                <p>Choose how NOVA looks on this device.</p>
              </div>
            </div>
            <div className="theme-options" role="group" aria-label="Theme preference">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={theme === value ? 'primary' : 'secondary'}
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="settings-card">
            <div className="settings-section-heading">
              <span className="settings-icon"><LogOut size={18} aria-hidden="true" /></span>
              <div>
                <h2>Account</h2>
                <p>Signed in as <span className="font-medium text-foreground">{user?.email}</span></p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleLogout} disabled={signingOut}>
              <LogOut size={16} aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportData} disabled={exporting}>
                <Download size={16} aria-hidden="true" />
                {exporting ? 'Preparing export…' : 'Export my data'}
              </Button>
            </div>
            <form className="mt-6 border-t border-border pt-5" onSubmit={deleteAccount}>
              <h3 className="font-semibold text-danger">Delete my account</h3>
              <p className="mt-1 text-sm text-muted">This permanently removes projects you own, related tasks and team access, and your account. This cannot be undone.</p>
              <label className="mt-3 block space-y-1.5 text-sm font-medium">
                Type {user?.email} to confirm
                <Input type="email" autoComplete="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} />
              </label>
              <Button type="submit" variant="danger" className="mt-3" disabled={deleting || !deleteEmail.trim()}>
                <Trash2 size={16} aria-hidden="true" />
                {deleting ? 'Deleting account…' : 'Delete my account'}
              </Button>
            </form>
            {accountError && <p className="alert-error mt-3" role="alert">{accountError}</p>}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
