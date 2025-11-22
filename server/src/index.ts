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

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      const operationName = req.body?.operationName;
      const variables = req.body?.variables;

      console.log("📥 GraphQL Request:");
      console.log("Operation Name:", operationName);
      console.log("Variables:", JSON.stringify(variables, null, 2));

      const branchid = req.headers['x-branch-id'];
      return { branchid };
    },
  });
  await server.start();

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
