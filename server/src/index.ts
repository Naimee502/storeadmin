import express, { Application } from 'express';
import { ApolloServer } from 'apollo-server-express';

import dotenv from 'dotenv';
import { connectDB } from './config';
import { typeDefs } from './graphql/schema/branches';
import { resolvers } from './graphql/resolvers/branches';
import path from 'path';
dotenv.config();

const startServer = async () => {
  const app: Application = express();
  await connectDB();
  // Serve static files from uploads folder
  app.use('/uploads', express.static(path.join(__dirname, '.', 'uploads')));

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app : app as any });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
};

startServer();
