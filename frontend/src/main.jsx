import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeProvider.jsx';
import App from './App.jsx';
import './index.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  const redactText = (value) => typeof value === 'string'
    ? value
      .replace(/Bearer\s+\S+/gi, '[redacted-token]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    : value;
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.url) {
          try {
            const url = new URL(event.request.url);
            url.search = '';
            url.hash = '';
            event.request.url = url.toString();
          } catch {
            delete event.request.url;
          }
        }
      }
      event.breadcrumbs = event.breadcrumbs
        ?.filter((crumb) => !['http', 'xhr', 'fetch'].includes(crumb.category))
        .map((crumb) => ({ ...crumb, message: redactText(crumb.message), data: undefined }));
      for (const exception of event.exception?.values || []) {
        exception.value = redactText(exception.value);
        for (const frame of exception.stacktrace?.frames || []) delete frame.vars;
      }
      if (event.message) event.message = redactText(event.message);
      if (event.tags) {
        event.tags = Object.fromEntries(Object.entries(event.tags).map(([key, value]) => [key, redactText(value)]));
      }
      delete event.extra;
      return event;
    },
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);