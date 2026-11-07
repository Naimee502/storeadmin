// Builds the full GraphQL schema with all resolvers; fails fast on schema errors.
// Usage: npx ts-node --transpile-only src/scripts/check-schema.ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "../graphql/schema";
import { resolvers } from "../graphql/resolvers";

const schema = makeExecutableSchema({ typeDefs, resolvers: resolvers as any });
const queries = Object.keys(schema.getQueryType()?.getFields() || {}).length;
const mutations = Object.keys(schema.getMutationType()?.getFields() || {}).length;
console.log(`schema OK: ${queries} queries, ${mutations} mutations`);
process.exit(0);
