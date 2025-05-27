import express, { Application } from 'express';
import { ApolloServer } from 'apollo-server-express';

import dotenv from 'dotenv';
import { connectDB } from './config';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import path from 'path';
import { graphqlUploadExpress } from 'graphql-upload';
import cors from 'cors';

dotenv.config();

const startServer = async () => {
  const app: Application = express();

  await connectDB();

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  // Apply upload middleware + cors ONLY on /graphql route BEFORE apollo middleware
  app.use(
    '/graphql',
    cors({
      origin: 'http://localhost:5173',
      credentials: true,
    }),
    graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1 })
  );

  // Serve uploads folder static files
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Attach Apollo middleware to express app at /graphql route
  server.applyMiddleware({ app: app as any });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
};

startServer();
