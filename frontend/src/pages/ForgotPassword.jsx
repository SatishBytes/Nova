import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import Navbar from '../components/Navbar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import usePageTitle from '../hooks/usePageTitle';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  usePageTitle('Forgot password');

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (requestError) throw requestError;
      setSent(true);
    } catch {
      setError('Unable to request a password reset right now. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <Navbar />
      <main className="page-container max-w-xl">
        <Card className="p-6 sm:p-8">
          <h1 className="page-heading">Forgot password</h1>
          <p className="mt-2 text-sm text-muted">Enter your email and we’ll send password reset instructions if an account matches.</p>
          {sent ? (
            <p className="mt-5 rounded-xl border border-border bg-background p-3 text-sm" role="status">
              If an account exists for that email, reset instructions are on the way.
            </p>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={submit}>
              <label className="block space-y-1.5 text-sm font-medium">
                Email address
                <Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              {error && <p className="alert-error" role="alert">{error}</p>}
              <Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
            </form>
          )}
          <Link className="mt-5 inline-block text-sm font-medium text-primary hover:underline" to="/login">Back to sign in</Link>
        </Card>
      </main>
    </div>
  );
};

export default ForgotPassword;
