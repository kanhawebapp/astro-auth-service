import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { generateOtp } from "../utils/otp.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
} from "../config/jwt.js";
import crypto from "crypto";
import { sendOTP } from "./smsService.js";

const OTP_EXPIRE = 300;
const OTP_RATE_LIMIT = 20;
const OTP_RATE_WINDOW = 600;
const LOGIN_FAIL_LIMIT = 5;
const LOGIN_FAIL_WINDOW = 900;

const REFRESH_COOKIE_NAME = "refreshToken";
const ACCESS_COOKIE_NAME = "accessToken";
const REFRESH_EXPIRE_DAYS = 7;

// ================= REGISTER =================
export const registerAstrologerService = async (data) => {
  const exists = await prisma.astrologer.findFirst({
    where: { OR: [{ email: data.email }, { contactNo: data.contactNo }] },
  });

  if (exists) throw new Error("Astrologer already registered");

  // Fixed: Added optional chaining and null check
  if (!data.profilePic || !data.profilePic.match(/\.(jpg|jpeg|png)$/i)) {
    throw new Error("Invalid profile picture format");
  }

  return prisma.astrologer.create({
    data: {
      ...data,
      dateOfBirth: new Date(data.dateOfBirth),
      addresses: { create: data.addresses },
      experiences: { create: data.experiences },
    },
    include: { addresses: true, experiences: true },
  });
};

// ================= REQUEST OTP =================
export const requestOtpService = async (contactNo) => {
  console.log("-------contactNo----------: ",contactNo);
  const astrologer = await prisma.astrologer.findFirst({
    where: { contactNo },
  });

  if (!astrologer) throw new Error("Astrologer not found");
  // if (astrologer.approvalStatus !== "APPROVED")
  //   throw new Error("Astrologer not approved");

  const rateKey = `otp_rate:${contactNo}`;
  const count = await redis.incr(rateKey);

  if (count === 1) await redis.expire(rateKey, OTP_RATE_WINDOW);
  if (count > OTP_RATE_LIMIT)
    throw new Error("Too many OTP requests. Try later.");

  const otp = generateOtp();
  const countryCode="+91";
  const mobile=contactNo.trim();
  await redis.set(`astrologer_otp:${contactNo}`, otp, "EX", OTP_EXPIRE);
   await sendOTP({
  countryCode,
  mobile,
  otp,
});

  console.log("OTP:", otp);

  return {
    message: "OTP sent successfully",
  };
};

// ================= VERIFY OTP =================
export const verifyOtpService = async (contactNo, otp, res) => {
  const storedOtp = await redis.get(`astrologer_otp:${contactNo}`);

  if (!storedOtp || storedOtp !== otp) {
    const failKey = `login_fail:${contactNo}`;
    const fails = await redis.incr(failKey);

    if (fails === 1) await redis.expire(failKey, LOGIN_FAIL_WINDOW);
    if (fails > LOGIN_FAIL_LIMIT) throw new Error("Too many failed attempts.");

    throw new Error("Invalid OTP");
  }

  await redis.del(`astrologer_otp:${contactNo}`);
  await redis.del(`login_fail:${contactNo}`);

  const astrologer = await prisma.astrologer.findFirst({
    where: { contactNo },
  });

  if (!astrologer) {
    throw new Error("Astrologer not found");
  }

  const sessionId = crypto.randomUUID();

  // Logout previous device automatically
  const oldSession = await redis.get(`astro:session:${astrologer.id}`);
  if (oldSession) {
    // Optional: Emit force_logout through socket if connected
    await redis.del(`astro:session:${astrologer.id}`);
    await redis.del(`refresh:${astrologer.id}`);
  }

  const payload = { id: astrologer.id, role: "ASTROLOGER", sessionId };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.astrologer.update({
    where: { id: astrologer.id },
    data: {
      refreshToken,
      isOnline: true,
    },
  });

  // await redis.set(
  //   `presence:astro:${astrologer.id}`,
  //   JSON.stringify({
  //     online: true,
  //     socketId: null,
  //     appState: "foreground",
  //     playerId: null,
  //     lastSeen: Date.now(),
  //     Source: "web",
  //   }),
  // );

  await redis.set(
    `astro:session:${astrologer.id}`,
    JSON.stringify({
      sessionId,
      loginAt: Date.now(),
    }),
    "EX",
    REFRESH_EXPIRE_DAYS * 24 * 60 * 60,
  );

  // Safe cookie set (important for tests)
  if (res) {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: `.${process.env.DOMAIN_NAME}`,
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: `.${process.env.DOMAIN_NAME}`,
      path: "/",
      maxAge: REFRESH_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  return { accessToken,refreshToken, astrologer };
};

// ================= REFRESH =================
export const refreshTokenService = async (req, res) => {
  if (!req || !req.cookies) throw new Error("Request context missing");

  const token = req.cookies[REFRESH_COOKIE_NAME];

  if (!token) throw new Error("Refresh token missing");

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (error) {
    throw new Error("Invalid refresh token");
  }

  // Check session exists
  const session = await redis.get(`astro:session:${decoded.id}`);
  if (!session) {
    throw new Error("Session expired");
  }

  const { sessionId } = JSON.parse(session);
  if (sessionId !== decoded.sessionId) {
    throw new Error("Logged in from another device");
  }

  const astrologer = await prisma.astrologer.findUnique({
    where: { id: decoded.id },
  });

  if (!astrologer) throw new Error("Astrologer not found");
  if (astrologer.refreshToken !== token)
    throw new Error("Refresh token mismatch");

  const newAccessToken = generateAccessToken({
    id: astrologer.id,
    role: "ASTROLOGER",
    sessionId,
  });

  const newRefreshToken = generateRefreshToken({
    id: astrologer.id,
    role: "ASTROLOGER",
    sessionId,
  });

  await prisma.astrologer.update({
    where: { id: astrologer.id },
    data: { refreshToken: newRefreshToken },
  });

  await redis.set(
    `refresh:${astrologer.id}`,
    newRefreshToken,
    "EX",
    REFRESH_EXPIRE_DAYS * 24 * 60 * 60,
  );
  if (res) {
    res.cookie(ACCESS_COOKIE_NAME, newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain:`.${process.env.DOMAIN_NAME}`,
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: `.${process.env.DOMAIN_NAME}`,
      path: "/",
      maxAge: REFRESH_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  return { accessToken: newAccessToken };
};

// ================= LOGOUT =================
export const logoutService = async (req, res) => {
  if (!req?.cookies) {
    throw new Error("Request context missing");
  }
console.log("-------comming in -logoutService--------" )

  const token = req.cookies[REFRESH_COOKIE_NAME];

  if (!token) {
    throw new Error("Access token missing");
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (error) {
    throw new Error("Invalid access token");
  }

  // Delete all session data
  await Promise.all([
    redis.del(`astro:session:${decoded.id}`),
    redis.del(`refresh:${decoded.id}`),
    redis.del(`presence:astro:${decoded.id}`),
  ]);

  await prisma.astrologer.update({
    where: {
      id: decoded.id,
    },
    data: {
      refreshToken: null,
      isOnline: false,
    },
  });

  if (res) {
    res.clearCookie(ACCESS_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: `.${process.env.DOMAIN_NAME}`,
      path: "/",
    });

    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: `.${process.env.DOMAIN_NAME}`,
      path: "/",
    });
  }

  return "Logged out successfully";
};
