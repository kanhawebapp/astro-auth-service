import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import graphqlUploadExpress from "graphql-upload/graphqlUploadExpress.mjs";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import {
  ApolloServerPluginLandingPageLocalDefault,
} from "@apollo/server/plugin/landingPage/default";

import typeDefs from "./graphql/typeDefs.js";
import resolvers from "./graphql/resolvers.js";
import rateLimiter from "./middleware/rateLimiter.js";
import auth from "./middleware/auth.js";

async function startServer() {
  const app = express();

  // ================= MIDDLEWARE =================
app.use(cors({
    origin: ["https://astropanel.dhwaniastro.com/", "https://astro-panel-satge-git-main-tej-engs-projects.vercel.app","https://astro-panel-v2.vercel.app"],
  credentials: true,
}));
  app.use(express.json());
  app.use(cookieParser());
  
  app.use(
  graphqlUploadExpress({
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
  })
);
  app.use(rateLimiter);

  // ================= APOLLO SERVER =================
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginLandingPageLocalDefault()],
  });

  await server.start();

app.use(
  "/graphql",
  expressMiddleware(server, {
    context: async ({ req, res }) => {
      const user = await auth(req); 
      return { req, res, user };
    },
  })
);

  // ================= HEALTH CHECK =================
  app.get("/", (req, res) => {
    res.send("Astro Auth Service Running 🚀");
  });
const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(` Server running at http://192.168.1.10:${PORT}/graphql`);
});
}

startServer();
