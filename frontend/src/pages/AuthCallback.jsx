import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import Navbar from '../components/Navbar';
import Card from '../components/ui/Card';
import usePageTitle from '../hooks/usePageTitle';

const AuthCallback = () => {
  const [message, setMessage] = useState('Completing account confirmation…');
  const navigate = useNavigate();
  usePageTitle('Confirming account');

  useEffect(() => {
    let active = true;
    const complete = async () => {
      const query = new URLSearchParams(window.location.search);
      const tokenHash = query.get('token_hash');
      const type = query.get('type');
      if (tokenHash && (type === 'email' || type === 'signup')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) throw new Error('The confirmation link may have expired. Request a new one.');
      if (active) navigate('/dashboard', { replace: true });
    };
    complete().catch((error) => {
      if (active) setMessage(error.message || 'Unable to confirm your account.');
    });
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="app-page">
      <Navbar />
      <main className="page-container max-w-xl">
        <Card className="p-6 sm:p-8">
          <h1 className="page-heading">Account confirmation</h1>
          <p className="mt-2 text-sm text-muted" role="status">{message}</p>
          {message !== 'Completing account confirmation…' && <Link className="mt-4 inline-block text-sm font-medium text-primary hover:underline" to="/check-email">Request another confirmation email</Link>}
        </Card>
      </main>
    </div>
  );
};

export default AuthCallback;
