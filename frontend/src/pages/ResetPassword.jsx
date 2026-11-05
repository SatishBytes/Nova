import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import Navbar from '../components/Navbar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import usePageTitle from '../hooks/usePageTitle';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  usePageTitle('Reset password');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirmation) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSaved(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (updateError) {
      setError(updateError.message || 'Unable to reset your password. Request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <Navbar />
      <main className="page-container max-w-xl">
        <Card className="p-6 sm:p-8">
          <h1 className="page-heading">Reset password</h1>
          {saved ? (
            <p className="mt-4 text-sm text-muted" role="status">Password updated. Taking you to sign in…</p>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={submit}>
              <label className="block space-y-1.5 text-sm font-medium">
                New password <span className="text-xs text-muted">(at least 8 characters)</span>
                <Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                Confirm password
                <Input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </label>
              {error && <p className="alert-error" role="alert">{error}</p>}
              <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save new password'}</Button>
            </form>
          )}
          <Link className="mt-5 inline-block text-sm font-medium text-primary hover:underline" to="/login">Back to sign in</Link>
        </Card>
      </main>
    </div>
  );
};

export default ResetPassword;
