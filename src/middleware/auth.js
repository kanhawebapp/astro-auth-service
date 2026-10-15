import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { GraphQLError } from "graphql";

const auth = async (req) => {
  try {
   const token =
  req.cookies?.accessToken ||
  req.headers?.authorization?.replace("Bearer ", "");


const decoded = jwt.verify(token, process.env.JWT_SECRET);

const session = await redis.get(`astro:session:${decoded.id}`);

if (session) {
  console.log("PARSED:", JSON.parse(session));
}

    const { sessionId } = JSON.parse(session);

    if (sessionId !== decoded.sessionId) {
  throw new GraphQLError(
    "Unauthorized: Session expired or logged in from another device",
    {
      extensions: {
        code: "UNAUTHENTICATED",
      },
    }
  );
}

    const user = await prisma.astrologer.findUnique({
      where: {
        id: decoded.id,
      },
    });

    return user;
  } catch (err) {
  console.error("AUTH ERROR:", err.message);
  return null;
}
};

export default auth;