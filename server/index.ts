import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import { bodyLimit } from 'hono/body-limit';
import { errorBody, MAX_LOCKFILE_BYTES } from './security.ts';

export const app = new Hono<{ Variables: RequestIdVariables }>();

app.use(requestId());
// S5/S8: strict CSP, no framing, no referrer. No CORS middleware = same-origin only.
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: 'no-referrer',
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  }),
);
// S7: 5 MB for lockfile uploads, 8 KB everywhere else.
app.use('/api/*', (c, next) =>
  bodyLimit({
    maxSize: c.req.path === '/api/analyze' ? MAX_LOCKFILE_BYTES + 200_000 : 8 * 1024,
    onError: (c) => c.json({ error: 'Request body too large.', requestId: c.get('requestId') }, 413),
  })(c, next),
);
app.onError((err, c) => {
  const { status, body } = errorBody(err, c.get('requestId'));
  return c.json(body, status as 400);
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.use('/*', serveStatic({ root: './web/dist' }));
app.get('*', serveStatic({ path: './web/dist/index.html' }));

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 8080);
  serve({ fetch: app.fetch, port }, () => console.log(`patient-zero on :${port}`));
}
