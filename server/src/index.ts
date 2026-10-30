import express, { Application } from 'express';
import { ApolloServer } from 'apollo-server-express';

import dotenv from 'dotenv';
import { connectDB } from './config';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import path from 'path';
import { graphqlUploadExpress } from 'graphql-upload';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { generateTokens, sendRefreshToken } from './utils/auth';
import { Admin } from './models/admin';
import { startReminderScheduler } from './utils/reminderscheduler';
import { startAutoPunchOutScheduler } from './utils/autopunchout';
import { imageResizer } from './utils/imagecache';
import { warmUpMail } from './utils/mail';
import { isCustomDomainOrigin, getCustomDomains } from './utils/customdomain';

dotenv.config();

const startServer = async () => {
  const app: Application = express();
  // Behind a reverse proxy (production), this makes req.protocol/req.get('host')
  // reflect the real public scheme/host (https://rudra...) instead of the
  // internal http/localhost the node process actually listens on — needed so
  // uploadImage can build a URL the app/browser can actually reach.
  app.set('trust proxy', true);

  await connectDB();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req, res }) => {
      const authHeader = req.headers['authorization'] || '';
      let user = null;

      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          user = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
        } catch (err) {
          // Token expired or invalid
        }
      }

      const branchid = req.headers['x-branch-id'];
      return { req, res, user, branchid };
    },
  });
  await server.start();

  app.use(cookieParser());

  // Allowed browser origins: the live site plus the local dev servers.
  const STATIC_ORIGINS = [
    'https://rudra.digisysindiatech.com',
    'http://localhost:5173', // client (admin panel)
    'http://localhost:5174', // clientweb (customer website, dev)
    'http://localhost:5175', // clientweb fallback port if 5174 is busy
  ];
  // Plus every business's own website domain (Business Settings -> Website
  // Storefront -> Custom Domain), with or without "www.", so a storefront on
  // dkmarketing.com can call this API. No code change per new client.
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || STATIC_ORIGINS.includes(origin)) return callback(null, true);
      isCustomDomainOrigin(origin)
        .then((ok) => callback(null, ok))
        .catch(() => callback(null, false));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id'],
  };

  // The admin panel calls this directly (dev: localhost:4000 from :5173).
  app.use('/refresh_token', cors(corsOptions));

  // List of every business's custom domain, for deploy/sync-custom-domains.sh
  // (cron on the VPS) which creates the nginx site + SSL for each one. Only
  // answers a request made on the machine itself — checked on the raw socket
  // address, not req.ip, because 'trust proxy' would let a forged
  // X-Forwarded-For header pass as localhost. nginx does not proxy this path
  // either, so it is not reachable from outside through the website.
  app.get('/internal/custom-domains', async (req, res) => {
    const ra = req.socket.remoteAddress || '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ra)) return res.status(404).end();
    try {
      const domains = await getCustomDomains();
      // First line "OK" so the script can tell "no domains" from "server down".
      res.type('text/plain').send(['OK', ...Array.from(domains)].join('\n') + '\n');
    } catch {
      res.status(500).end();
    }
  });

  app.post("/refresh_token", async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) return res.send({ ok: false, accessToken: "" });

    let payload: any = null;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!);
    } catch (err) {
      return res.send({ ok: false, accessToken: "" });
    }

    // Token is valid, find user (Admin/Staff/Branch - simplified to Admin for now)
    const admin = await Admin.findById(payload.id);
    if (!admin) return res.send({ ok: false, accessToken: "" });

    const tokens = generateTokens({ id: admin.id, email: admin.email, type: 'admin' });
    sendRefreshToken(res, tokens.refreshToken);

    return res.send({ ok: true, accessToken: tokens.accessToken });
  });

  // Apply upload middleware + cors ONLY on /graphql route BEFORE apollo middleware
  app.use(
    '/graphql',
    cors(corsOptions),
    // 50 MB: room for a short hero banner video. Images are compressed in the
    // browser before upload, so they stay far below this.
    graphqlUploadExpress({ maxFileSize: 50 * 1024 * 1024, maxFiles: 1 })
  );

  // Serve uploads folder static files.
  //
  // Two layers, in this order:
  //
  //   imageResizer  answers "?w=480" with a WebP re-encode of the stored file
  //                 at that width, generated once and cached on disk. This is
  //                 what makes the app's product grids paint immediately: the
  //                 originals are untouched phone photos of several megabytes,
  //                 and a card only ever needed about 25 KB of that. Nothing
  //                 has to be re-uploaded — it reads the files already here.
  //
  //   express.static serves the original for every URL without "?w=", which is
  //                 every URL stored in the database and every older build.
  //
  // The long, immutable Cache-Control matters as much as the resizing. Upload
  // names carry Date.now(), so a given URL's bytes never change; with the
  // previous default (max-age=0) every image was re-validated over the network
  // on every app launch before anything could be drawn.
  const uploadsPath = path.join(__dirname, 'uploads');

  // "?download=1" on an upload URL sends the ORIGINAL file as an attachment,
  // so the browser / phone saves it instead of just showing it. Used by the
  // product-image download button on the website and the app. Any other URL
  // (no ?download) falls straight through to the resizer + static below,
  // exactly as before. Only flat file names inside the uploads folder are
  // served — same traversal guard the resizer uses.
  app.use('/uploads', (req, res, next) => {
    if (req.method !== 'GET' || !req.query.download) return next();
    let name = '';
    try {
      name = decodeURIComponent(req.path.replace(/^\/+/, ''));
    } catch {
      return next();
    }
    if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return next();
    const dir = path.resolve(uploadsPath);
    const file = path.resolve(dir, name);
    if (!file.startsWith(dir + path.sep)) return next();
    // Product photos are public anyway (served by express.static below); the
    // header lets the website fetch the file in the background and save it,
    // instead of navigating the tab to the file URL.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.download(file, name, (err) => {
      if (err && !res.headersSent) next();
    });
  });

  app.use(
    '/uploads',
    imageResizer(uploadsPath),
    express.static(uploadsPath, { maxAge: '365d', immutable: true }),
  );

  // Attach Apollo middleware to express app at /graphql route.
  //
  // The JSON body limit is raised from body-parser's 100kb default on purpose:
  // updateAdminSettings carries the About Us / Privacy / Terms rich text, the
  // banner slide list and the product pick lists in one payload, and a business
  // that writes a real policy page passes 100kb without trying. Past that the
  // save fails with a 413 the client cannot explain.
  //
  // File uploads do not travel this path — graphqlUploadExpress above handles
  // multipart before Apollo sees it, capped separately at 50 MB.
  server.applyMiddleware({
    app: app as any,
    bodyParserConfig: { limit: '5mb' },
  });

  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, '0.0.0.0', () => {
    warmUpMail();
    console.log(`🚀 Server ready at http://0.0.0.0:${PORT}${server.graphqlPath}`);
  });

  // Month-end outstanding reminders (in-app, customers only).
  startReminderScheduler();
  // Punch out anyone who forgot, at the business's cut-off (default 22:00 IST).
  startAutoPunchOutScheduler();
};

startServer();
