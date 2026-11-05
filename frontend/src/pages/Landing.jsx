import { m, useReducedMotion } from 'motion/react';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  Command,
  Kanban,
  LockKeyhole,
  Moon,
  Radio,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

const FEATURES = [
  { icon: Kanban, title: 'Kanban boards', text: 'Keep work moving through clear, flexible project boards.' },
  { icon: Radio, title: 'Real-time collaboration', text: 'See task and project updates as your team makes them.' },
  { icon: LockKeyhole, title: 'Roles and permissions', text: 'Invite teammates with the right level of access.' },
  { icon: Command, title: 'Shortcuts and commands', text: 'Find projects and create work without breaking focus.' },
  { icon: BarChart3, title: 'Project insights', text: 'Understand progress, upcoming work, and recent completions.' },
  { icon: Moon, title: 'Dark mode and PWA', text: 'Set your preferred theme and install NOVA on your device.' },
];

const MOCK_TASKS = [
  { title: 'Shape the project brief', status: 'Done', checked: true },
  { title: 'Review the new homepage', status: 'In progress', checked: false },
  { title: 'Share the launch plan', status: 'To do', checked: false },
];

const Landing = () => {
  usePageTitle('Plan. Collaborate. Deliver.');
  const reduceMotion = useReducedMotion();
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link to="/" className="app-sidebar-logo" aria-label="NOVA home">
            <span className="brand-mark" aria-hidden="true">N</span>
            <span className="brand-name">NOVA</span>
          </Link>
          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="landing-login-link">Log in</Link>
            <Link to="/login" className="ui-button button-primary landing-start-link">
              Get started <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-grid-pattern" aria-hidden="true" />
          <div className="landing-hero-content">
            <m.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28 }}
              className="landing-hero-copy"
            >
              <span className="landing-eyebrow"><Sparkles size={14} aria-hidden="true" />A calmer workspace for ambitious teams</span>
              <h1>Plan. Collaborate.<br /><span>Deliver.</span></h1>
              <p>Bring projects, tasks, and your team into one clear workspace. Spend less time coordinating and more time moving good work forward.</p>
              <div className="landing-hero-actions">
                <Link to="/login" className="ui-button button-primary">
                  Get started <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link to="/login" className="ui-button button-secondary">Sign in</Link>
              </div>
              <a className="landing-scroll-link" href="#features">Explore NOVA <ArrowDown size={14} aria-hidden="true" /></a>
            </m.div>

            <m.div
              initial={reduceMotion ? false : { opacity: 0, y: 16, rotate: 1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : 0.06, ease: 'easeOut' }}
              className="product-preview"
              aria-label="Preview of a NOVA project board"
            >
              <div className="product-preview-topbar">
                <span className="brand-mark !h-7 !w-7 !rounded-lg !text-xs" aria-hidden="true">N</span>
                <span className="text-sm font-semibold">Website refresh</span>
                <span className="preview-live"><span />Live</span>
              </div>
              <div className="preview-progress">
                <div className="flex items-center justify-between text-xs text-muted"><span>Project progress</span><strong>1 of 3 complete</strong></div>
                <div className="preview-progress-track"><span /></div>
              </div>
              <div className="preview-board">
                {[
                  { name: 'To do', dot: 'preview-dot-muted', task: MOCK_TASKS[2] },
                  { name: 'In progress', dot: 'preview-dot-warning', task: MOCK_TASKS[1] },
                  { name: 'Done', dot: 'preview-dot-success', task: MOCK_TASKS[0] },
                ].map((column) => (
                  <div className="preview-column" key={column.name}>
                    <div className="preview-column-heading"><span className={column.dot} />{column.name}<span className="preview-count">1</span></div>
                    <div className="preview-task">
                      <span className={`preview-task-check ${column.task.checked ? 'is-checked' : ''}`}>
                        {column.task.checked && <Check size={11} aria-hidden="true" />}
                      </span>
                      <span>{column.task.title}</span>
                      <span className="preview-task-priority" aria-label="Medium priority" />
                    </div>
                    <span className="preview-add-task"><span>+</span> Add a task</span>
                  </div>
                ))}
              </div>
              <div className="product-preview-footer">
                <span><span className="preview-avatar">S</span><span className="preview-avatar preview-avatar-alt">M</span> A focused view for the whole team</span>
                <span className="preview-command"><Command size={11} aria-hidden="true" /> K</span>
              </div>
            </m.div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Everything in one place</span>
            <h2>Less coordination. More momentum.</h2>
            <p>The essentials to plan clearly, collaborate confidently, and deliver together.</p>
          </div>
          <div className="landing-feature-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article className="landing-feature-card" key={title}>
                <span className="landing-feature-icon"><Icon size={19} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="landing-how">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">A simple rhythm</span>
            <h2>From first idea to done.</h2>
          </div>
          <div className="landing-steps">
            {[
              ['01', 'Create a project', 'Give the work a home and invite the people who make it happen.'],
              ['02', 'Make the next step clear', 'Add tasks, set priorities, and move work through your board.'],
              ['03', 'See progress together', 'Keep up with live updates and celebrate what your team completes.'],
            ].map(([number, title, text]) => (
              <article className="landing-step" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-tech-strip" aria-label="Built with">
          <span>Built for focused work</span>
          <strong>React</strong><strong>Supabase</strong><strong>Realtime</strong><strong>Progressive web app</strong>
        </section>

        <section className="landing-cta">
          <div>
            <p className="landing-section-kicker">Make room for good work</p>
            <h2>Your next project starts here.</h2>
            <p>Get your team aligned and take the next step with confidence.</p>
          </div>
          <Link to="/login" className="ui-button button-primary">Get started <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" className="app-sidebar-logo" aria-label="NOVA home"><span className="brand-mark" aria-hidden="true">N</span><span className="brand-name">NOVA</span></Link>
        <p>Built by Satish Yadav · {new Date().getFullYear()}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href="mailto:support@example.com">Support</a>
          <a href="https://github.com/SatishBytes/Nova" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
