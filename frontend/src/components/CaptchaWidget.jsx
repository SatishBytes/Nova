import { useEffect, useRef } from 'react';

const siteKey = import.meta.env.VITE_CAPTCHA_SITE_KEY;

const CaptchaWidget = ({ onVerify }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!siteKey) return undefined;
    let active = true;
    let widgetId;
    const renderWidget = () => {
      if (!active || !window.turnstile || !containerRef.current || widgetId) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': () => onVerify(''),
        'error-callback': () => onVerify(''),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector('script[data-nova-turnstile]');
      if (existing) existing.addEventListener('load', renderWidget);
      else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.novaTurnstile = 'true';
        script.addEventListener('load', renderWidget);
        document.head.appendChild(script);
      }
    }

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onVerify]);

  return siteKey ? <div ref={containerRef} className="my-3" aria-label="Human verification" /> : null;
};

export default CaptchaWidget;
