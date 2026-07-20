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
    cors({
      origin: ['https://rudra.digisysindiatech.com', 'http://localhost:5173'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id'],
    }),
    graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1 })
  );

  // Serve uploads folder static files
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Attach Apollo middleware to express app at /graphql route
  server.applyMiddleware({ app: app as any });

  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server ready at http://0.0.0.0:${PORT}${server.graphqlPath}`);
  });
};

startServer();
