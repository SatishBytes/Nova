import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import Navbar from '../components/Navbar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import usePageTitle from '../hooks/usePageTitle';

const RESEND_COOLDOWN = 60;

const CheckEmail = () => {
  const location = useLocation();
  const email = location.state?.email || window.sessionStorage.getItem('nova-confirm-email') || '';
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  usePageTitle('Check your email');

  useEffect(() => {
    if (location.state?.email) window.sessionStorage.setItem('nova-confirm-email', location.state.email);
  }, [location.state?.email]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (!email || cooldown > 0 || sending) return;
    setSending(true);
    setError('');
    setMessage('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (resendError) throw resendError;
      setMessage('If this address needs confirmation, a new link is on its way.');
      setCooldown(RESEND_COOLDOWN);
    } catch {
      setError('Unable to resend a confirmation email right now. Please try again later.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-page">
      <Navbar />
      <main className="page-container max-w-xl">
        <Card className="p-6 sm:p-8">
          <h1 className="page-heading">Check your email</h1>
          <p className="mt-2 text-sm text-muted">Use the confirmation link we sent to finish creating your NOVA account.</p>
          {email && <p className="mt-2 text-sm font-medium">{email}</p>}
          {message && <p className="mt-4 text-sm text-success" role="status">{message}</p>}
          {error && <p className="mt-4 alert-error" role="alert">{error}</p>}
          <Button className="mt-5" onClick={resend} disabled={!email || sending || cooldown > 0}>
            {sending ? 'Sending…' : cooldown ? `Resend available in ${cooldown}s` : 'Resend confirmation email'}
          </Button>
          <p className="mt-4 text-sm text-muted">Already confirmed? <Link className="font-medium text-primary hover:underline" to="/login">Sign in</Link></p>
        </Card>
      </main>
    </div>
  );
};

export default CheckEmail;
