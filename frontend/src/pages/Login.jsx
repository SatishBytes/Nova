import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, ListChecks, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import Navbar from '../components/Navbar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

const demoEnabled = import.meta.env.VITE_DEMO_LOGIN_ENABLED === 'true'
  && Boolean(import.meta.env.VITE_DEMO_EMAIL)
  && Boolean(import.meta.env.VITE_DEMO_PASSWORD);

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const authenticate = async (emailValue, passwordValue, signup = isSignup) => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { data, error: authError } = signup
        ? await supabase.auth.signUp({ email: emailValue, password: passwordValue })
        : await supabase.auth.signInWithPassword({ email: emailValue, password: passwordValue });

      if (authError) {
        setError(authError.message);
      } else if (signup && !data.session) {
        setMessage('Check your email to confirm your account.');
      } else {
        navigate('/dashboard');
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    await authenticate(trimmedEmail, password);
  };

  const handleDemoLogin = () => {
    authenticate(
      import.meta.env.VITE_DEMO_EMAIL,
      import.meta.env.VITE_DEMO_PASSWORD,
      false,
    );
  };

  return (
    <div className="app-page">
      <Navbar />
      <main className="login-shell">
        <section className="login-brand-panel" aria-label="NOVA product preview">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium">
              <Sparkles size={15} aria-hidden="true" />
              A calmer way to get work done
            </div>
            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
              className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-5xl"
            >
              Make space for your best work.
            </motion.h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white">
              Bring projects, tasks, and your team into one focused workspace. Plan clearly and keep momentum.
            </p>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.08 }}
            className="login-preview-card w-full max-w-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Website refresh</p>
                <p className="mt-0.5 text-xs text-white">A clear view of what matters</p>
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs text-white">This week</span>
            </div>
            <div className="space-y-2">
              <div className="login-preview-row">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">✓</span>
                <span className="flex-1 text-sm">Shape the project brief</span>
                <span className="text-xs text-white">Done</span>
              </div>
              <div className="login-preview-row">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">2</span>
                <span className="flex-1 text-sm">Review the new homepage</span>
                <span className="text-xs text-white">In progress</span>
              </div>
              <div className="login-preview-row">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">3</span>
                <span className="flex-1 text-sm">Share with the team</span>
                <span className="text-xs text-white">To do</span>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-2/3 rounded-full bg-white" />
              </div>
              <span className="text-xs font-semibold">67%</span>
              <ListChecks size={17} aria-hidden="true" />
            </div>
          </motion.div>
        </section>

        <section className="login-form-panel">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <p className="text-sm font-semibold text-primary">WELCOME TO NOVA</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {isSignup
                  ? 'Start organizing your work in one place.'
                  : 'Sign in to pick up where you left off.'}
              </p>
            </div>

            <Card className="p-5 shadow-card sm:p-7">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    aria-invalid={Boolean(error)}
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </label>
                    <span className="text-xs text-muted">6 characters minimum</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      aria-invalid={Boolean(error)}
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((shown) => !shown)}
                    >
                      {showPassword
                        ? <EyeOff size={17} aria-hidden="true" />
                        : <Eye size={17} aria-hidden="true" />}
                    </Button>
                  </div>
                </div>

                {error && <p role="alert" className="alert-error">{error}</p>}
                {message && (
                  <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
                    {message}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
                  {!loading && <ArrowRight size={16} aria-hidden="true" />}
                </Button>
              </form>

              {demoEnabled && (
                <div className="mt-4 border-t border-border pt-4">
                  <Button variant="secondary" className="w-full" onClick={handleDemoLogin} disabled={loading}>
                    Continue as demo user
                  </Button>
                </div>
              )}
            </Card>

            <p className="mt-5 text-center text-sm text-muted">
              {isSignup ? 'Already have an account?' : 'New to NOVA?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignup((current) => !current);
                  setError('');
                  setMessage('');
                }}
                className="rounded font-semibold text-primary hover:underline"
              >
                {isSignup ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Login;
