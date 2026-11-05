import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';

const PrivacyPolicy = () => {
  usePageTitle('Privacy policy');
  return (
    <div className="app-page">
      <Navbar />
      <main className="page-container max-w-3xl">
        <h1 className="page-heading">Privacy policy</h1>
        <p className="mt-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">Placeholder policy — have this reviewed and replace it before production use.</p>
        <section className="mt-6 space-y-3 text-sm leading-6 text-muted">
          <h2 className="text-base font-semibold text-foreground">Information NOVA processes</h2>
          <p>NOVA processes account details, project and task content, team membership, comments, and product activity to provide the workspace. Authentication and database hosting are provided by Supabase.</p>
          <h2 className="text-base font-semibold text-foreground">Use and retention</h2>
          <p>Workspace data is used to operate NOVA and is retained until deleted by the account owner or removed under the applicable service retention rules. Review this statement against actual hosting, backup, analytics, and incident-response practices.</p>
          <h2 className="text-base font-semibold text-foreground">Your choices</h2>
          <p>You may export available workspace data or request account deletion from Settings. For questions, contact <a className="text-primary underline" href="mailto:support@example.com">&lt;support email&gt;</a>.</p>
          <p>Last reviewed: &lt;date&gt;.</p>
        </section>
        <Link className="mt-6 inline-block text-sm font-medium text-primary hover:underline" to="/">Back to NOVA</Link>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
