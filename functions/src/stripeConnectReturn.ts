import { onRequest } from 'firebase-functions/v2/https';

/**
 * Tiny HTTPS endpoint Stripe redirects to after Connect onboarding.
 * Two paths:
 *   /return  — user finished (or completed enough to return).
 *   /refresh — link expired or user backed out; we ask the app to start over.
 *
 * Both render a simple "you can return to the Payly app" page. The actual
 * "is the account active" status is driven by the connectWebhook listening
 * for `account.updated`, not by which path the user lands on.
 */
export const stripeConnectReturn = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    const isRefresh = req.path === '/refresh';
    const title = isRefresh ? 'Stripe setup paused' : 'Stripe setup complete';
    const body = isRefresh
      ? 'Your Stripe setup link expired or was cancelled. Return to the Payly app and tap “Connect Stripe” again.'
      : 'You can close this tab and return to the Payly app. Online payment links will start working on new invoices once Stripe finishes verifying your account.';

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Payly</title>
  <style>
    html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0f; color: #f4f4f5; }
    main { max-width: 480px; margin: 0 auto; padding: 60px 24px; text-align: center; }
    .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; color: #a78bfa; margin-bottom: 32px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; }
    p { font-size: 15px; line-height: 1.55; color: #a1a1aa; }
  </style>
</head>
<body>
  <main>
    <div class="logo">Payly</div>
    <h1>${title}</h1>
    <p>${body}</p>
  </main>
</body>
</html>`);
  },
);
