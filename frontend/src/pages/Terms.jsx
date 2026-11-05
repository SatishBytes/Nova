import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';

const Terms = () => {
  usePageTitle('Terms');
  return (
    <div className="app-page">
      <Navbar />
      <main className="page-container max-w-3xl">
        <h1 className="page-heading">Terms of service</h1>
        <p className="mt-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">Placeholder terms — have these reviewed and replace them before production use.</p>
        <section className="mt-6 space-y-3 text-sm leading-6 text-muted">
          <h2 className="text-base font-semibold text-foreground">Using NOVA</h2>
          <p>Use NOVA only for lawful work you are authorized to manage. Keep your sign-in details secure and ensure you have permission to share content with invited collaborators.</p>
          <h2 className="text-base font-semibold text-foreground">Workspace content</h2>
          <p>You retain responsibility for the content you add. Project owners control access and may archive or delete their projects. Account deletion removes the user's owned workspace data as described in the Privacy Policy.</p>
          <h2 className="text-base font-semibold text-foreground">Availability and support</h2>
          <p>NOVA is provided as-is during this preview. For support, contact <a className="text-primary underline" href="mailto:support@example.com">&lt;support email&gt;</a>. Replace this placeholder with reviewed terms and the operator's legal identity.</p>
          <p>Effective date: &lt;date&gt;.</p>
        </section>
        <Link className="mt-6 inline-block text-sm font-medium text-primary hover:underline" to="/">Back to NOVA</Link>
      </main>
    </div>
  );
};

export default Terms;
