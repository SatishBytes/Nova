import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';

const NotFound = () => {
  usePageTitle('Page not found');
  return (
    <div className="app-page">
      <Navbar />
      <main className="page-container">
        <div className="empty-state">
          <span className="empty-state-icon"><Compass size={22} aria-hidden="true" /></span>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">404</p>
          <h1 className="mt-2 text-xl font-semibold">This page wandered off</h1>
          <p className="mt-1 max-w-sm text-sm text-muted">The link may be old, or the page may have moved.</p>
          <Link to="/dashboard" className="mt-5 ui-button button-primary">Go to dashboard</Link>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
