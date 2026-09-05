import prisma from "../config/prisma.js";
import { generateKundali } from "../services/astrologyServices.js";
import {
  logoutService,
  refreshTokenService,
  verifyOtpService,
  requestOtpService,
} from "../services/auth.service.js";

import { getChatMessages } from "../services/messageService.js";

import { generateRtcToken } from "../utils/agoraToken.js";
import { GraphQLError } from "graphql";
//const GraphQLJSON = require("graphql-type-json");
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import GraphQLUpload from "graphql-upload/GraphQLUpload.mjs";

export default {
  //JSON: GraphQLJSON,
  Upload: GraphQLUpload,
  Query: {
    getAstrologerEarnings: async (_, __, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }
        const astrologerId = user.id;
        const wallet = await prisma.astrologerWallet.findUnique({
          where: {
            astrologerId,
          },
          include: {
            transactions: {
              orderBy: {
                createdAt: "desc",
              },
              take: 20,
              select: {
                id: true,
                type: true,
                amount: true,
                coins: true,
                description: true,
                createdAt: true,
                sessionId: true,
              },
            },
          },
        });

        if (!wallet) {
          return {
            summary: {
              totalEarnings: 0,
              totalWithdrawn: 0,
              currentBalance: 0,
              totalSessions: 0,
              totalChatMinutes: 0,
            },

            transactions: [],
          };
        }

        const sessions = await prisma.session.findMany({
          where: {
            astrologerId,
            status: "COMPLETED",
          },

          select: {
            durationSec: true,
          },
        });

        const totalSessions = sessions.length;

        let totalChatMinutes = 0;

        sessions.forEach((s) => {
          totalChatMinutes += Math.ceil((s.durationSec || 0) / 60);
        });

        return {
          summary: {
            totalEarnings: wallet.totalEarned || 0,

            totalWithdrawn: wallet.totalWithdrawn || 0,

            currentBalance: wallet.balanceCoins || 0,

            totalSessions,

            totalChatMinutes,
          },

          transactions: wallet.transactions.map((t) => ({
            id: t.id,

            type: t.type,

            amount: t.amount || 0,

            coins: t.coins || 0,

            description: t.description || "",
            sessionId: t.sessionId,
            createdAt: t.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("getAstrologerEarnings error:", error);

        throw new Error(error.message || "Failed to fetch earnings");
      }
    },
    getAstrologerPayoutSummary: async (_, __, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        const [astrologer, payoutSummary] = await Promise.all([
          prisma.astrologer.findUnique({
            where: {
              id: astrologerId,
            },
            select: {
              id: true,
              name: true,
              displayName: true,
              profilePic: true,
              rating: true,
              experience: true,
            },
          }),

          prisma.astrologerPayout.aggregate({
            where: {
              astrologerId,
            },

            _sum: {
              totalRevenue: true,
              commission: true,
              earning: true,
              pgCharge: true,
              pgTotal: true,
              grossAmount: true,
              tdsAmount: true,
              payableAmount: true,
              lastPaidAmount: true,
              igst: true,
              cgst: true,
              sgst: true,
            },

            _avg: {
              commissionPercent: true,
              pgChargeRate: true,
              gstRate: true,
              tdsPercent: true,
            },

            _count: {
              id: true,
            },
          }),
        ]);

        return {
          success: true,
          message: "Payout summary fetched successfully",

          astrologer,

          summary: {
            totalPayouts: payoutSummary._count.id,

            totalRevenue: payoutSummary._sum.totalRevenue || 0,
            totalCommission: payoutSummary._sum.commission || 0,
            totalEarning: payoutSummary._sum.earning || 0,

            totalPgCharge: payoutSummary._sum.pgCharge || 0,
            totalPgTotal: payoutSummary._sum.pgTotal || 0,

            totalGrossAmount: payoutSummary._sum.grossAmount || 0,

            totalTdsAmount: payoutSummary._sum.tdsAmount || 0,

            totalLastPaidAmount: payoutSummary._sum.lastPaidAmount || 0,

            totalPayableAmount: payoutSummary._sum.payableAmount || 0,

            totalIGST: payoutSummary._sum.igst || 0,
            totalCGST: payoutSummary._sum.cgst || 0,
            totalSGST: payoutSummary._sum.sgst || 0,

            averageCommissionPercent: payoutSummary._avg.commissionPercent || 0,

            averagePgChargeRate: payoutSummary._avg.pgChargeRate || 0,

            averageGstRate: payoutSummary._avg.gstRate || 0,

            averageTdsPercent: payoutSummary._avg.tdsPercent || 0,
          },
        };
      } catch (error) {
        console.error("getAstrologerPayoutSummary:", error);
        throw new Error(error.message || "Failed to fetch payout summary");
      }
    },

    getAstrologerChatHistory: async (_, { filter = {} }, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        const {
          page = 1,
          limit = 10,
          userName,
          status,
          startDate,
          endDate,
          source,
        } = filter;

        const skip = (page - 1) * limit;

        const where = {
          astrologerId,

          ...(status && {
            status,
          }),

          ...(source && {
            source,
          }),

          ...(startDate || endDate
            ? {
                createdAt: {
                  ...(startDate && {
                    gte: new Date(startDate),
                  }),
                  ...(endDate && {
                    lte: new Date(endDate),
                  }),
                },
              }
            : {}),
        };

        /* =====================================
       TOTAL COUNT
    ===================================== */

        const totalCount = await prisma.session.count({
          where,
        });

        /* =====================================
       FETCH SESSIONS
    ===================================== */

        const sessions = await prisma.session.findMany({
          where,

          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile: true,
                countryCode: true,
              },
            },

            review: {
              select: {
                rating: true,
                comment: true,
              },
            },

            messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                roomId: true,
                message: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },

          skip,
          take: limit,
        });


        /* =====================================
       GET ROOM IDS
    ===================================== */

        const roomIds = sessions
          .map((s) => s.messages?.[0]?.roomId)
          .filter(Boolean);

        /* =====================================
       FETCH MATCHING INTAKES
    ===================================== */

        let intakeMap = new Map();

        if (roomIds.length > 0) {
          const intakes = await prisma.intake.findMany({
            where: {
              chatId: {
                in: roomIds,
              },
            },

            select: {
              chatId: true,

              name: true,
              birthPlace: true,
              birthDate: true,
              birthTime: true,
              occupation: true,
              gender: true,

              createdAt: true,
              source: true,
            },
          });
          console.log("intakes--------------------data------:", intakes);
          intakeMap = new Map(intakes.map((intake) => [intake.chatId, intake]));
        }

        /* =====================================
       OPTIONAL SEARCH BY INTAKE NAME
    ===================================== */

        let filteredSessions = sessions;

        if (userName) {
          filteredSessions = sessions.filter((session) => {
            const roomId = session.messages?.[0]?.roomId;

            const intake = intakeMap.get(roomId);

            return intake?.name?.toLowerCase().includes(userName.toLowerCase());
          });
        }

        /* =====================================
       RESPONSE DATA
    ===================================== */

        const data = filteredSessions.map((session) => {
          const lastMessage = session.messages?.[0] || null;

          const roomId = lastMessage?.roomId;

          const intake = intakeMap.get(roomId);

          const durationMinutes = session.durationSec ? session.durationSec : 0;

          return {
            sessionId: session.id,
  userId: session.user?.id || null,
            roomId,

            // Intake Name (tej / ajay)
            userName: intake?.name || session.user?.name || "",
            //userName: session.user?.name || null,

            userMobile: session.user?.mobile || "",

            userCountryCode: session.user?.countryCode || "",

            birthPlace: intake?.birthPlace || "",

            birthDate: intake?.birthDate
              ? intake.birthDate.toISOString()
              : null,

            birthTime: intake?.birthTime || "",

            occupation: intake?.occupation || "",

            gender: intake?.gender || null,

            intakeName: intake?.name || "",

            startedAt: session.startedAt
              ? session.startedAt.toISOString()
              : null,

            endedAt: session.endedAt ? session.endedAt.toISOString() : null,

            createdAt: session.createdAt
              ? session.createdAt.toISOString()
              : null,

            status: session.status,

            durationSec: session.durationSec || 0,

            durationMinutes,

            ratePerMin: session.ratePerMin || 0,

            coinsEarned: session.coinsEarned || 0,

            commission: session.commission || 0,

            rating: session.review?.rating ?? null,

            reviewComment: session.review?.comment ?? null,

            lastMessage: lastMessage?.message || "",

            source: session.source || null,
            intakeSource: intake?.source || null,
          };
        });

        return {
          success: true,

          totalCount,

          currentPage: page,

          totalPages: Math.ceil(totalCount / limit),

          data,
        };
      } catch (error) {
        console.error("getAstrologerChatHistory error:", error);

        throw new Error(error.message || "Failed to fetch chat history");
      }
    },

    getSessionMessages: async (_, { sessionId }, { user }) => {
      try {
        /* =====================================
       AUTH CHECK
    ===================================== */
        if (!user) {
          throw new Error("Unauthorized");
        }

        /* =====================================
       VALIDATE SESSION
    ===================================== */
        const session = await prisma.session.findUnique({
          where: {
            id: sessionId,
          },

          select: {
            id: true,
            astrologerId: true,
          },
        });

        if (!session) {
          throw new Error("Session not found");
        }

        /* =====================================
       SECURITY CHECK
    ===================================== */
        if (session.astrologerId !== user.id) {
          throw new Error("Access denied");
        }

        /* =====================================
       FETCH MESSAGES
    ===================================== */
        const messages = await prisma.message.findMany({
          where: {
            sessionId,
          },

          orderBy: {
            createdAt: "asc",
          },
        });

        /* =====================================
       RESPONSE
    ===================================== */
        return {
          success: true,

          totalCount: messages.length,

          data: messages.map((msg) => ({
            id: msg.id,

            msgId: msg.msgId,

            roomId: msg.roomId,

            senderId: msg.senderId,

            receiverId: msg.receiverId || null,

            message: msg.message || null,

            image: msg.image || null,

            sender: msg.sender,

            replyTo: msg.replyTo ? JSON.stringify(msg.replyTo) : null,
            time: msg.time,

            createdAt: msg.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("getSessionMessages error:", error);

        throw new Error(error.message || "Failed to fetch messages");
      }
    },

    getAstrologerCallHistory: async (_, { filter = {} }, { user }) => {
      try {
        /* =====================================
       AUTH CHECK
    ===================================== */
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        const {
          page = 1,
          limit = 10,
          userName,
          status,
          startDate,
          endDate,
          source,
        } = filter;

        const skip = (page - 1) * limit;

        /* =====================================
       FILTER
    ===================================== */
        const where = {
          astrologerId,
          type: "CALL",

          ...(status && {
            status,
          }),

          ...(source && {
            source,
          }),

          ...(startDate || endDate
            ? {
                createdAt: {
                  ...(startDate && {
                    gte: new Date(startDate),
                  }),
                  ...(endDate && {
                    lte: new Date(endDate),
                  }),
                },
              }
            : {}),

          ...(userName && {
            user: {
              name: {
                contains: userName,
                mode: "insensitive",
              },
            },
          }),
        };

        /* =====================================
       TOTAL COUNT
    ===================================== */
        const totalCount = await prisma.session.count({
          where,
        });

        /* =====================================
       FETCH SESSIONS
    ===================================== */
        const sessions = await prisma.session.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile: true,
                countryCode: true,
              },
            },
            messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                roomId: true,
                message: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        });

        /* =====================================
       RESPONSE
    ===================================== */
        const data = sessions.map((session) => {
          const lastMessage = session.messages?.[0] || null;

          let durationMinutes = 0;
          if (session.durationSec) {
            durationMinutes = session.durationSec || 0;
          }

          return {
            sessionId: session.id,
              userId: session.user?.id || null,
            roomId: lastMessage?.roomId || null,
            userName: session.user?.name || null,
            userMobile: session.user?.mobile || null,
            userCountryCode: session.user?.countryCode || null,
            startedAt: session.startedAt
              ? session.startedAt.toISOString()
              : null,
            endedAt: session.endedAt ? session.endedAt.toISOString() : null,
            createdAt: session.createdAt
              ? session.createdAt.toISOString()
              : null,
            status: session.status,
            durationSec: session.durationSec || 0,
            durationMinutes,
            ratePerMin: session.ratePerMin || 0,
            coinsEarned: session.coinsEarned || 0,
            commission: session.commission || 0,
            lastMessage: lastMessage?.message || null,
            source: session.source || null,
          };
        });

        return {
          success: true,
          totalCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          data,
        };
      } catch (error) {
        console.error("getAstrologerCallHistory error:", error);
        throw new Error(error.message || "Failed to fetch call history");
      }
    },

    getAstrologerWalletTransactions: async (
      _,
      { page = 1, limit = 20 },
      { user },
    ) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        const skip = (page - 1) * limit;

        const wallet = await prisma.astrologerWallet.findUnique({
          where: {
            astrologerId,
          },
        });

        if (!wallet) {
          return {
            success: true,

            totalCount: 0,

            currentPage: page,

            totalPages: 0,

            data: [],
          };
        }

        const totalCount = await prisma.walletTransaction.count({
          where: {
            astrologerWalletId: wallet.id,
          },
        });

        const transactions = await prisma.walletTransaction.findMany({
          where: {
            astrologerWalletId: wallet.id,
          },

          orderBy: {
            createdAt: "desc",
          },

          skip,

          take: limit,
        });

        return {
          success: true,

          totalCount,

          currentPage: page,

          totalPages: Math.ceil(totalCount / limit),

          data: transactions.map((txn) => ({
            id: txn.id,
            sessionId: txn.sessionId,
            type: txn.type,

            amount: txn.amount || 0,

            coins: txn.coins || 0,

            description: txn.description || "",

            createdAt: txn.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("getAstrologerWalletTransactions error:", error);

        throw new Error(error.message || "Failed to fetch wallet transactions");
      }
    },
    getAstrologerReviews: async (_, { filter = {} }, { user }) => {
      try {
        /* =====================================
       AUTH CHECK
    ===================================== */
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        /* =====================================
       PAGINATION
    ===================================== */
        const page = Number(filter.page) || 1;
        const limit = Number(filter.limit) || 10;

        const skip = (page - 1) * limit;

        /* =====================================
       FILTER
    ===================================== */
        const where = {
          astrologerId,

          ...(filter.rating && {
            rating: Number(filter.rating),
          }),
        };

        /* =====================================
       TOTAL COUNT
    ===================================== */
        const totalCount = await prisma.review.count({
          where,
        });

        /* =====================================
       FETCH REVIEWS
    ===================================== */
        const reviews = await prisma.review.findMany({
          where,

          include: {
            session: {
              select: {
                id: true,
                type: true,
                status: true,
                startedAt: true,
                endedAt: true,
                durationSec: true,
                createdAt: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },

          skip,
          take: limit,
        });

        /* =====================================
       RESPONSE
    ===================================== */
        return {
          success: true,

          totalCount,

          currentPage: page,

          totalPages: Math.ceil(totalCount / limit),

          limit,

          data: reviews.map((review) => ({
            id: review.id,

            /* Session Details */
            sessionId: review.session?.id || review.sessionId || null,
            sessionType: review.session?.type || null,
            sessionStatus: review.session?.status || null,

            durationSec: review.session?.durationSec || 0,

            startedAt: review.session?.startedAt
              ? review.session.startedAt.toISOString()
              : null,

            endedAt: review.session?.endedAt
              ? review.session.endedAt.toISOString()
              : null,

            /* Review Details */
            userName: review.userName || "",
            astroName: review.astroName || "",

            rating: review.rating,

            comment: review.comment || "",

            reply: review.reply || null,

            isFlagged: review.isFlagged || false,

            createdAt: review.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("getAstrologerReviews error:", error);

        throw new Error(error.message || "Failed to fetch reviews");
      }
    },
    getUserDetails: async (_, { userId }, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const userData = await prisma.user.findUnique({
          where: {
            id: userId,
          },
          include: {
            wallet: true,
            sessions: {
              select: {
                status: true,
              },
            },
            reviews: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!userData) {
          throw new Error("User not found");
        }

        const totalSessions = userData.sessions.length;

        const completedSessions = userData.sessions.filter(
          (session) => session.status === "COMPLETED",
        ).length;

        return {
          id: userData.id,

          name: userData.name,
          mobile: userData.mobile,
          countryCode: userData.countryCode,

          gender: userData.gender,

          birthDate: userData.birthDate
            ? userData.birthDate.toISOString()
            : null,

          birthTime: userData.birthTime,

          occupation: userData.occupation,

          isActive: userData.isActive,

          wallet: userData.wallet
            ? {
                balanceCoins: userData.wallet.balanceCoins,
                lockedCoins: userData.wallet.lockedCoins,
              }
            : null,

          totalSessions,

          completedSessions,

          totalReviews: userData.reviews.length,

          createdAt: userData.createdAt.toISOString(),
          updatedAt: userData.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error("getUserDetails error:", error);
        throw new Error(error.message || "Failed to fetch user details");
      }
    },
    getAstrologerProfile: async (_, __, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        const astrologer = await prisma.astrologer.findUnique({
          where: {
            id: astrologerId,
          },
          include: {
            pricing: true,
            wallet: true,
            reviews: {
              orderBy: {
                createdAt: "desc",
              },
              take: 5,
              select: {
                id: true,
                rating: true,
                comment: true,
                reply: true,
                userName: true,
                createdAt: true,
              },
            },
            addresses: true,
            experiences: true,
            kycDetail: true,
          },
        });

        if (!astrologer) {
          throw new Error("Astrologer profile not found");
        }

        const totalReviews = await prisma.review.count({
          where: {
            astrologerId,
          },
        });

        const totalSessions = await prisma.session.count({
          where: {
            astrologerId,
            status: "COMPLETED",
          },
        });

        return {
          success: true,
          message: "Astrologer profile fetched successfully",
          data: {
            id: astrologer.id,
            profilePic: astrologer.profilePic || "",
            name: astrologer.name || "",
            displayName: astrologer.displayName || "",
            email: astrologer.email || "",
            contactNo: astrologer.contactNo || "",
            about: astrologer.about || "",
            gender: astrologer.gender,
            languages: astrologer.languages || [],
            skills: astrologer.skills || [],
            problems: astrologer.problems || [],
            experience: astrologer.experience || 0,
            rating: astrologer.rating || 0,
            tags: astrologer.tags || "",
            vtags: astrologer.vtags || "",
            status: astrologer.status || false,
            isCallActive: astrologer.isCallActive || false,
            isChatActive: astrologer.isChatActive || false,
            isLiveActive: astrologer.isLiveActive || false,
            isBusy: astrologer.isBusy || false,
            isOnline: astrologer.isOnline || false,
            isPromotional: astrologer.isPromotional || false,
            createdAt: astrologer.createdAt
              ? astrologer.createdAt.toISOString()
              : null,
            totalReviews,
            totalSessions,
            pricing: (astrologer.pricing || []).map((item) => ({
              id: item.id,
              type: item.type,
              price: item.price,
              offerPrice: item.offerPrice,
              commissionPercent: item.commissionPercent,
              isActive: item.isActive,
            })),
            wallet: astrologer.wallet
              ? {
                  balanceCoins: astrologer.wallet.balanceCoins || 0,
                  totalEarned: astrologer.wallet.totalEarned || 0,
                  totalWithdrawn: astrologer.wallet.totalWithdrawn || 0,
                }
              : null,
            recentReviews: (astrologer.reviews || []).map((review) => ({
              id: review.id,
              rating: review.rating,
              comment: review.comment || "",
              reply: review.reply || "",
              userName: review.userName || "",
              createdAt: review.createdAt
                ? review.createdAt.toISOString()
                : null,
            })),
            addresses: astrologer.addresses || [],
            experiences: astrologer.experiences || [],
            kycDetail: astrologer.kycDetail
              ? {
                  accountHolderName:
                    astrologer.kycDetail.accountHolderName || "",
                  accountNumber: astrologer.kycDetail.accountNumber || "",
                  bankName: astrologer.kycDetail.bankName || "",
                  ifsc: astrologer.kycDetail.ifsc || "",
                  branchName: astrologer.kycDetail.branchName || "",
                  panNumber: astrologer.kycDetail.panNumber || "",
                  aadhaarImage: astrologer.kycDetail.aadhaarImage || "",
                  panImage: astrologer.kycDetail.panImage || "",
                  passbookImage: astrologer.kycDetail.passbookImage || "",
                  status: astrologer.kycDetail.status || "PENDING",
                }
              : null,
          },
        };
      } catch (error) {
        console.error("getAstrologerProfile error:", error);
        throw new Error(error.message || "Failed to fetch astrologer profile");
      }
    },

    getAstrologerSessions: async (_, { filter = {} }, { user }) => {
      console.log("\n==============================================");
      console.log("🚀 getAstrologerSessions START");
      console.log("==============================================");

      try {
        // =====================================================
        // STEP 1: AUTH
        // =====================================================
        console.log("STEP 1: Checking user...");

        if (!user) {
          console.error("❌ Unauthorized");
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        console.log("✅ User found");
        console.log("Astrologer ID:", astrologerId);

        // =====================================================
        // STEP 2: FILTER
        // =====================================================
        console.log("\nSTEP 2: Incoming filter:");
        console.log(JSON.stringify(filter, null, 2));

        const {
          page = 1,
          limit = 10,
          userName,
          startDate,
          endDate,
          sessionType,
          source,
        } = filter;

        // =====================================================
        // STEP 3: PAGINATION
        // =====================================================
        const pageNumber = Math.max(1, Number(page) || 1);

        const limitNumber = Math.min(100, Math.max(1, Number(limit) || 10));

        const skip = (pageNumber - 1) * limitNumber;

        console.log("\nSTEP 3: Pagination");
        console.log({
          pageNumber,
          limitNumber,
          skip,
        });

        // =====================================================
        // STEP 4: INITIAL WHERE
        // =====================================================
        const where = {
          astrologerId,
          status: {
            in: ["COMPLETED", "CANCELLED", "ONGOING"],
          },
        };

        console.log("\nSTEP 4: Initial WHERE:");
        console.log(JSON.stringify(where, null, 2));

        // =====================================================
        // STEP 5: SESSION TYPE
        // =====================================================
        if (sessionType) {
          const sessionTypeUpper = String(sessionType).toUpperCase();

          console.log("\nSTEP 5: sessionType:", sessionTypeUpper);

          if (["CHAT", "CALL"].includes(sessionTypeUpper)) {
            where.type = sessionTypeUpper;
          } else {
            console.warn("⚠️ Invalid sessionType:", sessionTypeUpper);
          }
        }

        // =====================================================
        // STEP 6: SOURCE
        // =====================================================
        if (source) {
          const sourceUpper = String(source).toUpperCase();

          console.log("\nSTEP 6: source:", sourceUpper);

          if (["WEB", "ANDROID", "IOS"].includes(sourceUpper)) {
            where.source = sourceUpper;
          } else {
            console.warn("⚠️ Invalid source:", sourceUpper);
          }
        }

        // =====================================================
        // STEP 7: DATE FILTER
        // =====================================================
        if (startDate || endDate) {
          console.log("\nSTEP 7: Processing date filter");

          where.createdAt = {};

          if (startDate) {
            const start = new Date(startDate);

            if (isNaN(start.getTime())) {
              throw new Error(`Invalid startDate: ${startDate}`);
            }

            where.createdAt.gte = start;
          }

          if (endDate) {
            const end = new Date(endDate);

            if (isNaN(end.getTime())) {
              throw new Error(`Invalid endDate: ${endDate}`);
            }

            // Include entire end date
            end.setHours(23, 59, 59, 999);

            where.createdAt.lte = end;
          }

          console.log("Date filter:", where.createdAt);
        }

        // =====================================================
        // STEP 8: USER NAME
        // =====================================================
        if (userName) {
          console.log("\nSTEP 8: userName:", userName);

          where.user = {
            name: {
              contains: String(userName),
              mode: "insensitive",
            },
          };
        }

        // =====================================================
        // STEP 9: FINAL WHERE
        // =====================================================
        console.log("\n==============================================");

        console.log("STEP 9: FINAL WHERE");

        console.log("==============================================");

        console.log(JSON.stringify(where, null, 2));

        // =====================================================
        // STEP 10: COUNT
        // =====================================================
        console.log("\nSTEP 10: BEFORE prisma.session.count()");

        const countStart = Date.now();

        const totalCount = await prisma.session.count({
          where,
        });

        console.log("✅ STEP 10: prisma.session.count() SUCCESS");

        console.log("totalCount:", totalCount);

        console.log("Count duration:", Date.now() - countStart, "ms");

        // =====================================================
        // STEP 11: GET SESSIONS
        // =====================================================
        console.log("\nSTEP 11: BEFORE prisma.session.findMany()");

        const sessionStart = Date.now();

        const sessions = await prisma.session.findMany({
          where,

          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile: true,
                countryCode: true,
              },
            },

            review: {
              select: {
                rating: true,
                comment: true,
              },
            },
          },

          orderBy: [
            {
              createdAt: "desc",
            },
            {
              id: "desc",
            },
          ],

          skip,
          take: limitNumber,
        });

        console.log("✅ STEP 11: prisma.session.findMany() SUCCESS");

        console.log("Sessions count:", sessions.length);

        console.log("Session query duration:", Date.now() - sessionStart, "ms");

        // =====================================================
        // STEP 12: SESSION INFORMATION
        // =====================================================
        console.log("\nSTEP 12: Session Information:");

        sessions.forEach((session, index) => {
          console.log(`Session ${index + 1}:`, {
            id: session.id,
            userId: session.userId,
            astrologerId: session.astrologerId,
            type: session.type,
            status: session.status,
            roomId: session.roomId,
            source: session.source,
            by: session.by,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationSec: session.durationSec,
            ratePerMin: session.ratePerMin,
            coinsDeducted: session.coinsDeducted,
            coinsEarned: session.coinsEarned,
            commission: session.commission,
          });
        });

        // =====================================================
        // STEP 13: BUILD RESPONSE
        // =====================================================
        console.log("\nSTEP 13: Mapping sessions...");

        const data = sessions.map((session, index) => {
          console.log(
            `Mapping session ${index + 1}/${sessions.length}:`,
            session.id,
          );

          return {
            // =================================================
            // SESSION
            // =================================================
            sessionId: session.id,

            sessionType: session.type,

            status: session.status,

            // =================================================
            // USER
            // =================================================
            userId: session.userId,

            userName: session.user?.name || "",

            userMobile: session.user?.mobile || "",

            userCountryCode: session.user?.countryCode || "",

            // =================================================
            // SESSION IDENTIFIERS
            // =================================================
            roomId: session.roomId || null,

            // =================================================
            // SESSION DETAILS
            // =================================================
            startedAt: session.startedAt
              ? session.startedAt.toISOString()
              : null,

            endedAt: session.endedAt ? session.endedAt.toISOString() : null,

            createdAt: session.createdAt
              ? session.createdAt.toISOString()
              : null,

            // =================================================
            // DURATION
            // =================================================
            durationSec: session.durationSec || 0,

            durationMinutes: session.durationSec
              ? Math.ceil(session.durationSec / 60)
              : 0,

            // =================================================
            // FINANCIAL
            // =================================================
            ratePerMin: session.ratePerMin ?? 0,

            coinsDeducted: session.coinsDeducted ?? 0,

            coinsEarned: session.coinsEarned ?? 0,

            commission: session.commission ?? 0,

            // =================================================
            // SOURCE
            // =================================================
            source: session.source || null,

            by: session.by || null,

            // =================================================
            // REVIEW
            // =================================================
            rating: session.review?.rating ?? null,

            reviewComment: session.review?.comment ?? null,
          };
        });

        console.log("✅ STEP 13: Mapping completed");

        console.log("Response data count:", data.length);

        // =====================================================
        // STEP 14: RESPONSE
        // =====================================================
        const totalPages = Math.ceil(totalCount / limitNumber);

        console.log("\n==============================================");

        console.log("STEP 14: RETURNING RESPONSE");

        console.log("==============================================");

        console.log({
          success: true,
          totalCount,
          currentPage: pageNumber,
          totalPages,
          dataCount: data.length,
        });

        console.log("🎉 getAstrologerSessions COMPLETED");

        return {
          success: true,

          totalCount,

          currentPage: pageNumber,

          totalPages,

          data,
        };
      } catch (error) {
        // =====================================================
        // MAIN ERROR
        // =====================================================
        console.error("\n==============================================");

        console.error("🔥🔥🔥 getAstrologerSessions ERROR 🔥🔥🔥");

        console.error("==============================================");

        console.error("Error name:", error?.name);

        console.error("Error message:", error?.message);

        console.error("Error code:", error?.code);

        console.error("Error meta:", error?.meta);

        console.error("Error stack:", error?.stack);

        console.error("Full error:", error);

        console.error("==============================================");

        throw error;
      }
    },

    getOffers: async (_, __, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;

        // Get all admin-created offers
        const offers = await prisma.offer.findMany({
          orderBy: {
            createdAt: "desc",
          },
        });

        // Get astrologer's selected offers
        const astrologerOffers = await prisma.astrologerOffer.findMany({
          where: {
            astrologerId,
          },
        });

        const selectedMap = {};

        astrologerOffers.forEach((item) => {
          selectedMap[item.offerId] = item.isActive;
        });

        return {
          success: true,
          message: "Offers fetched successfully",
          data: offers.map((offer) => ({
            id: offer.id,
            offerName: offer.offerName,
            price: offer.price,
            description: offer.description,
            isActive: offer.isActive, // admin status
            selected: selectedMap[offer.id] || false, // astrologer status
            createdAt: offer.createdAt.toISOString(),
            updatedAt: offer.updatedAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("getOffers error:", error);

        throw new Error(error.message || "Failed to fetch offers");
      }
    },
    getRemedies: async () => {
      try {
        const remedies = await prisma.remedy.findMany({
          orderBy: {
            createdAt: "desc",
          },
        });

        return {
          success: true,
          message: "Remedies fetched successfully",

          data: remedies.map((remedy) => ({
            id: remedy.id,

            title: remedy.title,

            description: remedy.description,

            isActive: remedy.isActive,

            createdAt: remedy.createdAt.toISOString(),

            updatedAt: remedy.updatedAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("getRemedies error:", error);

        throw new Error(error.message || "Failed to fetch remedies");
      }
    },
    getSessionRemedies: async (_, { filter = {} }) => {
      try {
        const { page = 1, limit = 10, sessionId, startDate, endDate } = filter;

        const skip = (page - 1) * limit;

        const where = {};

        if (sessionId) {
          where.sessionId = sessionId;
        }

        if (startDate || endDate) {
          where.createdAt = {};

          if (startDate) {
            where.createdAt.gte = new Date(startDate);
          }

          if (endDate) {
            where.createdAt.lte = new Date(endDate);
          }
        }

        const totalCount = await prisma.sessionRemedy.count({
          where,
        });

        const remedies = await prisma.sessionRemedy.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            session: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        });

        return {
          success: true,
          message: "Session remedies fetched successfully",

          totalCount,

          currentPage: page,

          totalPages: Math.ceil(totalCount / limit),

          data: remedies.map((r) => ({
            id: r.id,
            sessionId: r.sessionId,
            sessionType: r.session?.type || null,
            remedyText: r.remedyText,
            createdAt: r.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("getSessionRemedies error:", error);
        throw new Error(error.message);
      }
    },
    getKundali: async (_, { requestSessionId }) => {
      const intake = await prisma.intake.findFirst({
        where: {
          chatId: requestSessionId,
        },
      });

      if (!intake) {
        throw new Error("Intake not found");
      }

      if (intake.latitude == null || intake.longitude == null) {
        throw new Error("Birth location coordinates not available");
      }

      const dob = new Date(intake.birthDate);

      const [hour = "0", minute = "0"] = intake.birthTime.split(":");

      const payload = {
        day: dob.getDate(),
        month: dob.getMonth() + 1,
        year: dob.getFullYear(),

        hour: Number(hour),
        min: Number(minute),

        lat: Number(intake.latitude),
        lon: Number(intake.longitude),

        tzone: 5.5,
      };

      const kundaliData = await generateKundali(payload);

      return {
        status: true,
        userId: intake.userId,
        requestType: intake.requestType,
        requestSessionId,
        userName: intake.name,

        data: JSON.stringify({
          user_data: {
            name: intake.name,
            gender: intake.gender,
            birthPlace: intake.birthPlace,
          },

          postData: {
            latitude: intake.latitude,
            longitude: intake.longitude,
          },

          ...kundaliData,
        }),
      };
    },
    getAstrologerFollowersCount: async (_, { astrologerId }, context) => {
      try {
        const totalFollowers = await prisma.astrologerFollow.count({
          where: {
            astrologerId,
          },
        });

        return {
          totalFollowers,
        };
      } catch (error) {
        throw new Error(error.message);
      }
    },
    getAstrologerFollowers: async (
      _,
      { astrologerId, page = 1, limit = 20 },
    ) => {
      try {
        const skip = (page - 1) * limit;

        const [followers, total] = await Promise.all([
          prisma.astrologerFollow.findMany({
            where: {
              astrologerId,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  mobile: true,
                  countryCode: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            skip,
            take: limit,
          }),

          prisma.astrologerFollow.count({
            where: {
              astrologerId,
            },
          }),
        ]);

        return {
          followers: followers.map((item) => ({
            id: item.id,
            userId: item.userId,
            astrologerId: item.astrologerId,
            createdAt: item.createdAt.toISOString(),

            user: item.user
              ? {
                  id: item.user.id,
                  name: item.user.name,
                  mobile: item.user.mobile,
                  countryCode: item.user.countryCode,
                }
              : null,
          })),

          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error) {
        console.error("getAstrologerFollowers error:", error);
        throw new Error(error.message);
      }
    },

    getAstrologerAssignedBookedServices: async (
      _,
      { page = 1, limit = 10, bookingStatus, paymentStatus },
      { user },
    ) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;
        const skip = (page - 1) * limit;

        const where = {
          astrologerId,
          ...(bookingStatus && { bookingStatus }),
          ...(paymentStatus && { paymentStatus }),
        };

        const [data, total] = await Promise.all([
          prisma.serviceBooking.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          }),

          prisma.serviceBooking.count({
            where,
          }),
        ]);

        return {
          success: true,
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          limit,
          data,
        };
      } catch (error) {
        console.error("getAstrologerAssignedBookedServices error:", error);

        throw new Error(
          error.message || "Failed to fetch assigned service bookings",
        );
      }
    },
    getAstrologerById: async (_, { astrologerId }) => {
      return await prisma.astrologer.findUnique({
        where: {
          id: astrologerId,
        },
      });
    },
    getAstrologerAnalytics: async (_, { astrologerId }) => {
      try {
        const astrologer = await prisma.astrologer.findUnique({
          where: { id: astrologerId },
          select: {
            rating: true,
          },
        });

        if (!astrologer) {
          throw new Error("Astrologer not found");
        }

        const [wallet, followersCount, totalChats, totalCalls, sessions] =
          await Promise.all([
            prisma.astrologerWallet.findUnique({
              where: {
                astrologerId,
              },
              select: {
                totalEarned: true,
              },
            }),

            prisma.astrologerFollow.count({
              where: {
                astrologerId,
              },
            }),

            prisma.session.count({
              where: {
                astrologerId,
                type: "CHAT",
                status: "COMPLETED",
              },
            }),

            prisma.session.count({
              where: {
                astrologerId,
                type: "CALL",
                status: "COMPLETED",
              },
            }),

            prisma.session.findMany({
              where: {
                astrologerId,
                status: "COMPLETED",

                // only current year
                createdAt: {
                  gte: new Date(new Date().getFullYear(), 0, 1),
                  lte: new Date(),
                },
              },

              select: {
                type: true,
                coinsEarned: true,
                createdAt: true,
              },
            }),
          ]);

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();

        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        // Initialize Jan -> Current Month
        const monthlyData = [];

        for (let i = 0; i <= currentMonth; i++) {
          monthlyData.push({
            month: monthNames[i],
            earnings: 0,
            chats: 0,
            calls: 0,
          });
        }

        // Fill actual data
        sessions.forEach((session) => {
          const sessionDate = new Date(session.createdAt);

          if (sessionDate.getFullYear() !== currentYear) return;

          const monthIndex = sessionDate.getMonth();

          monthlyData[monthIndex].earnings += session.coinsEarned || 0;

          if (session.type === "CHAT") {
            monthlyData[monthIndex].chats += 1;
          }

          if (session.type === "CALL") {
            monthlyData[monthIndex].calls += 1;
          }
        });

        return {
          totalEarnings: wallet?.totalEarned || 0,
          totalFollowers: followersCount,
          totalChats,
          totalCalls,
          averageRating: astrologer.rating || 0,
          monthlyData,
        };
      } catch (error) {
        console.error("getAstrologerAnalytics Error:", error);
        throw new Error(error.message);
      }
    },
    getAstrologerNotices: async (_, { astrologerId }) => {
      try {
        const now = new Date();

        const notices = await prisma.notice.findMany({
          where: {
            isActive: true,

            OR: [
              {
                targetType: "ALL",
              },
              {
                targetType: "SELECTED",
                astrologers: {
                  some: {
                    astrologerId,
                  },
                },
              },
            ],

            AND: [
              {
                OR: [{ startDate: null }, { startDate: { lte: now } }],
              },
              {
                OR: [{ endDate: null }, { endDate: { gte: now } }],
              },
            ],
          },

          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        });

        return notices;
      } catch (error) {
        console.error("getAstrologerNotices Error:", error);
        throw new Error(error.message);
      }
    },
    getLiveStreams: async () => {
      try {
        const streams = await prisma.liveStream.findMany({
          where: {
            status: {
              in: ["LIVE", "SCHEDULED"],
            },
          },

          include: {
            astrologer: {
              select: {
                id: true,
                name: true,
                displayName: true,
                profilePic: true,
                rating: true,
              },
            },
          },

          orderBy: [
            {
              scheduledAt: "asc",
            },
          ],
        });

        return streams.sort((a, b) => {
          if (a.status === "LIVE" && b.status !== "LIVE") return -1;
          if (a.status !== "LIVE" && b.status === "LIVE") return 1;
          return 0;
        });
      } catch (error) {
        console.error("getLiveStreams Error:", error);
        throw new Error(error.message);
      }
    },

    joinLive: async (_, { channelName, role }) => {
      console.log("comming in joinLive----------------:");
      const stream = await prisma.liveStream.findFirst({
        where: {
          channelName,
          status: "LIVE",
        },
      });

      if (!stream) {
        throw new Error("Live stream not found");
      }

      const uid = Math.floor(Math.random() * 100000);
      console.log("AGORA_APP_ID--------------:", process.env.AGORA_APP_ID);

      const token = generateRtcToken({
        channelName,
        uid,
        role,
      });
      console.log("token for agora---------:", token);
      return {
        token,
        uid,
        appId: process.env.AGORA_APP_ID,
        channelName,
      };
    },

    getMyScheduledLives: async (_, __, { user }) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      return prisma.liveStream.findMany({
        where: {
          astrologerId: user.id,

          status: "SCHEDULED",
        },

        orderBy: {
          scheduledAt: "asc",
        },
      });
    },

    getCurrentChatMessages: async (_, { roomId }, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        return await getChatMessages(roomId);
      } catch (error) {
        console.error("getSessionMessages:", error);
        throw new Error(error.message || "Failed to fetch messages");
      }
    },
    getRemediesForChat: async (_, __, { user }) => {
      console.log("USER:", user);

      try {
        const remedies = await prisma.remedy.findMany({
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        console.log("REMEDIES:", remedies);

        return {
          success: true,
          message: "Remedies fetched successfully",
          data: remedies.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            isActive: r.isActive,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("FULL ERROR:", error);
        throw error;
      }
    },

    getAstrologerAppVersion: async (_, { platform }, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const appVersion = await prisma.appVersion.findFirst({
          where: {
            appType: "ASTROLOGER",
            platform: platform.toUpperCase(),
          },
        });

        if (!appVersion) {
          return {
            success: false,
            message: "App version not found",
            data: null,
          };
        }

        return {
          success: true,
          message: "App version fetched successfully",
          data: {
            id: appVersion.id,
            appType: appVersion.appType,
            platform: appVersion.platform,
            latestVersion: appVersion.latestVersion,
            minimumVersion: appVersion.minimumVersion,
            forceUpdate: appVersion.forceUpdate,
            maintenanceMode: appVersion.maintenanceMode,
            maintenanceMessage: appVersion.maintenanceMessage,
            playStoreUrl: appVersion.playStoreUrl,
            appStoreUrl: appVersion.appStoreUrl,
            releaseNotes: appVersion.releaseNotes,
            createdAt: appVersion.createdAt.toISOString(),
            updatedAt: appVersion.updatedAt.toISOString(),
          },
        };
      } catch (error) {
        console.error("getAstrologerAppVersion error:", error);
        console.error("getAstrologerAppVersion error:");

        throw new Error(error.message || "Failed to fetch app version");
      }
    },

    getCurrentAstrologer: async (_, __, { user }) => {
      if (!user) {
        throw new GraphQLError("Unauthorized", {
          extensions: {
            code: "UNAUTHENTICATED",
          },
        });
      }

      return prisma.astrologer.findUnique({
        where: {
          id: user.id,
        },
        select: {
          name: true,
          contactNo: true,
        },
      });
    },
  },

  Mutation: {
    requestAstrologerOtp: async (_, { contactNo }) => {
      return requestOtpService(contactNo);
    },

    verifyAstrologerOtp: async (_, { contactNo, otp }, { res }) => {
      return verifyOtpService(contactNo, otp, res);
    },

    logoutAstrologer: async (_, __, { req, res }) => {
      await logoutService(req, res);

      return {
        message: "Logged out successfully",

        success: true,
      };
    },

    refreshAstrologerToken: async (_, __, { req, res }) => {
      return refreshTokenService(req, res);
    },
    replyToReview: async (_, { reviewId, reply }, { user }) => {
      try {
        /* =====================================
       AUTH CHECK
    ===================================== */
        if (!user) {
          throw new Error("Unauthorized");
        }

        /* =====================================
       FIND REVIEW
    ===================================== */
        const review = await prisma.review.findUnique({
          where: {
            id: reviewId,
          },
        });

        if (!review) {
          throw new Error("Review not found");
        }

        /* =====================================
       SECURITY CHECK
    ===================================== */
        if (review.astrologerId !== user.id) {
          throw new Error("Access denied");
        }

        /* =====================================
       UPDATE REVIEW
    ===================================== */
        await prisma.review.update({
          where: {
            id: reviewId,
          },

          data: {
            reply,
          },
        });

        return {
          success: true,

          message: "Reply added successfully",
        };
      } catch (error) {
        console.error("replyToReview error:", error);

        throw new Error(error.message || "Failed to reply to review");
      }
    },
    updateOfferStatus: async (_, { offerId, isActive }, { user }) => {
      try {
        // Authentication check
        if (!user) {
          throw new Error("Unauthorized");
        }

        const astrologerId = user.id;
        // Check if offer exists
        const offer = await prisma.offer.findUnique({
          where: {
            id: offerId,
          },
        });

        if (!offer) {
          throw new Error("Offer not found");
        }

        // Check if offer is enabled by admin
        // if (!offer.isActive) {
        //   throw new Error(
        //     "This offer has been disabled by admin"
        //   );
        // }

        let updateResult = null;

        // Only one active offer per astrologer
        if (isActive) {
          updateResult = await prisma.astrologerOffer.updateMany({
            where: {
              astrologerId,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          });
        }

        // Create or update astrologer's offer
        const astrologerOffer = await prisma.astrologerOffer.upsert({
          where: {
            astrologerId_offerId: {
              astrologerId,
              offerId,
            },
          },
          update: {
            isActive,
          },
          create: {
            astrologerId,
            offerId,
            isActive,
          },
        });

        return {
          success: true,
          message: isActive
            ? "Offer activated successfully"
            : "Offer deactivated successfully",
        };
      } catch (error) {
        console.error("updateOfferStatus error:", error);

        throw new Error(error.message || "Failed to update offer status");
      }
    },
    sendRemedy: async (_, { sessionId, remedyText }, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const session = await prisma.session.findUnique({
          where: {
            id: sessionId,
          },
        });

        if (!session) {
          throw new Error("Session not found");
        }

        if (session.astrologerId !== user.id) {
          throw new Error("Access denied");
        }

        await prisma.sessionRemedy.create({
          data: {
            sessionId,
            remedyText,
          },
        });

        return {
          success: true,
          message: "Remedy sent successfully",
        };
      } catch (error) {
        console.error("sendRemedy error:", error);
        throw new Error(error.message);
      }
    },
    toggleAstrologerService: async (
      _,
      { astrologerId, serviceType, status },
      { user },
    ) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      const fieldMap = {
        CHAT: "isChatActive",
        CALL: "isCallActive",
        LIVE: "isLiveActive",
        PROMOTIONAL: "isPromotional",
      };

      const field = fieldMap[serviceType];

      await prisma.astrologer.update({
        where: {
          id: astrologerId,
        },
        data: {
          [field]: status,
        },
      });

      return {
        success: true,
        message: `${serviceType} ${
          status ? "enabled" : "disabled"
        } successfully`,
      };
    },
    startLive: async (_, { title }, { user }) => {
      console.log("comming in startLive");
      if (!user) {
        throw new Error("Unauthorized");
      }

      const existingScheduled = await prisma.liveStream.findFirst({
        where: {
          astrologerId: user.id,

          status: "SCHEDULED",
        },

        orderBy: {
          scheduledAt: "asc",
        },
      });

      if (existingScheduled) {
        return prisma.liveStream.update({
          where: {
            id: existingScheduled.id,
          },

          data: {
            status: "LIVE",
          },
        });
      }

      return prisma.liveStream.create({
        data: {
          astrologerId: user.id,

          title,

          channelName: `astro-${user.id}`,

          status: "LIVE",
        },
      });
    },

    endLive: async (_, { streamId }, { user }) => {
      if (!user) {
        throw new Error("Unauthorized");
      }

      const stream = await prisma.liveStream.findUnique({
        where: {
          id: streamId,
        },
      });

      if (!stream) {
        throw new Error("Stream not found");
      }

      if (stream.astrologerId !== user.id) {
        throw new Error("Access denied");
      }

      await prisma.liveStream.update({
        where: {
          id: streamId,
        },
        data: {
          status: "ENDED",
          endedAt: new Date(),
        },
      });

      return true;
    },

    scheduleLive: async (_, { title, scheduledAt }, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const scheduleDate = new Date(scheduledAt);

        if (isNaN(scheduleDate.getTime())) {
          throw new Error("Invalid scheduled date");
        }

        if (scheduleDate <= new Date()) {
          throw new Error("Scheduled time must be in future");
        }

        const stream = await prisma.liveStream.create({
          data: {
            astrologerId: user.id,

            title,

            channelName: `astro-${user.id}-${Date.now()}`,

            status: "SCHEDULED",

            scheduledAt: scheduleDate,
          },
        });

        return stream;
      } catch (error) {
        console.error("scheduleLive Error:", error);

        throw new Error(error.message || "Failed to schedule live");
      }
    },

    uploadFile: async (_, { file }, { user }) => {
      try {
        if (!user) {
          throw new Error("Unauthorized");
        }

        const { createReadStream, filename, mimetype } = await file;

        // Allow only images
        if (!mimetype.startsWith("image/")) {
          throw new Error("Only image files are allowed");
        }

        const ext = path.extname(filename);
        const newFileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}${ext}`;

        // Upload directory from .env
        const uploadDir =
          process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uploadPath = path.join(uploadDir, newFileName);

        await new Promise((resolve, reject) => {
          const stream = createReadStream();
          const out = fs.createWriteStream(uploadPath);

          stream.pipe(out);

          out.on("finish", resolve);
          out.on("error", reject);
          stream.on("error", reject);
        });

        // Public URL returned to frontend/Redis
        const baseUrl =
          process.env.UPLOAD_BASE_URL ||
          "https://dhwaniastro.com/astro/v2/uploads";

        const fileUrl = `${baseUrl}/${newFileName}`;

        return {
          success: true,
          message: "File uploaded successfully",
          url: fileUrl,
          filename: newFileName,
        };
      } catch (error) {
        console.error("uploadFile error:", error);
        throw new Error(error.message || "Upload failed");
      }
    },
  },
};
