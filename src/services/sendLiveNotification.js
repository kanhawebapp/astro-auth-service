import OneSignal from "@onesignal/node-onesignal";

const client = new OneSignal.DefaultApi(
  OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY,
  })
);

// =============================================
// Validate OneSignal subscription ID
// =============================================
const isValidSubscriptionId = (playerId) => {
  if (typeof playerId !== "string") {
    return false;
  }

  const normalizedId = playerId.trim();

  if (
    !normalizedId ||
    normalizedId.toLowerCase() === "null" ||
    normalizedId.toLowerCase() === "undefined"
  ) {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(normalizedId);
};

/**
 * Send scheduled live notification to all astrologer followers.
 *
 * Rules:
 * 1. If playerId is null, skip that user.
 * 2. If playerId is empty, skip that user.
 * 3. If playerId is invalid, skip that user.
 * 4. Send notification only to users with valid IDs.
 * 5. No Redis presence checking.
 *
 * Expected follower format:
 * [
 *   {
 *     userId: "USER_ID",
 *     playerId: "ONESIGNAL_SUBSCRIPTION_ID"
 *   }
 * ]
 */
export const sendScheduledLiveNotification = async (
  astrologer,
  liveStream,
  followers
) => {
  try {
    console.log("Coming sendScheduledLiveNotification");

    // =============================================
    // 1. Validate input
    // =============================================

    if (!astrologer?.id) {
      return {
        success: false,
        reason: "ASTROLOGER_ID_NOT_FOUND",
      };
    }

    if (!liveStream?.id) {
      return {
        success: false,
        reason: "LIVE_STREAM_ID_NOT_FOUND",
      };
    }

    if (!Array.isArray(followers) || followers.length === 0) {
      return {
        success: true,
        reason: "NO_FOLLOWERS",
        totalFollowers: 0,
        notificationsSent: 0,
      };
    }

    // =============================================
    // 2. Validate OneSignal configuration
    // =============================================

    if (
      !process.env.ONESIGNAL_APP_ID ||
      !process.env.ONESIGNAL_REST_API_KEY
    ) {
      throw new Error("OneSignal environment variables are missing");
    }

    // =============================================
    // 3. Collect valid subscription IDs
    // =============================================

    const subscriptionIds = [];

    let missingPlayerIds = 0;
    let invalidPlayerIds = 0;
    let skippedUsers = 0;

    for (const follower of followers) {
      const playerId = follower?.playerId;

      // Skip null, undefined, empty and string null IDs
      if (
        playerId === null ||
        playerId === undefined ||
        typeof playerId !== "string" ||
        !playerId.trim() ||
        playerId.trim().toLowerCase() === "null" ||
        playerId.trim().toLowerCase() === "undefined"
      ) {
        missingPlayerIds++;
        skippedUsers++;

        console.log(
          `[Live Notification] Skipping user ${follower?.userId || "UNKNOWN"}: Player ID is missing`
        );

        continue;
      }

      // Skip invalid UUIDs
      if (!isValidSubscriptionId(playerId)) {
        invalidPlayerIds++;
        skippedUsers++;

        console.log(
          `[Live Notification] Skipping user ${follower?.userId || "UNKNOWN"}: Invalid Player ID`
        );

        continue;
      }

      console.log("comming player id ",playerId.trim());

      subscriptionIds.push(playerId.trim());
    }

    // =============================================
    // 4. Remove duplicate subscription IDs
    // =============================================

    console.log("subscriptionIds-----------------------ARRAY OF IDS",subscriptionIds);

    const uniqueSubscriptionIds = [
      ...new Set(subscriptionIds),
    ];

    console.log("uniqueSubscriptionIds=================",uniqueSubscriptionIds);

    console.log("[Live Notification] Subscription summary:", {
      totalFollowers: followers.length,
      validSubscriptions: uniqueSubscriptionIds.length,
      missingPlayerIds,
      invalidPlayerIds,
      skippedUsers,
    });

    // =============================================
    // 5. If no valid IDs, don't call OneSignal
    // =============================================

    if (uniqueSubscriptionIds.length === 0) {
      console.log(
        "[Live Notification] No valid subscriptions found. Notification not sent."
      );

      return {
        success: true,
        reason: "NO_VALID_SUBSCRIPTIONS",
        totalFollowers: followers.length,
        missingPlayerIds,
        invalidPlayerIds,
        skippedUsers,
        notificationsSent: 0,
      };
    }

    // =============================================
    // 6. Prepare notification content
    // =============================================

    const astrologerName =
      astrologer.displayName ||
      astrologer.name ||
      "Your astrologer";

    const title = "Upcoming Live Session";

    const message = `${astrologerName} has scheduled a live session. Join and get your questions answered!`;

    const notificationData = {
      type: "scheduled_live",
      liveStreamId: liveStream.id,
      astrologerId: astrologer.id,
      astrologerName,

      channelName: liveStream.channelName || "",

      scheduledAt: liveStream.scheduledAt
        ? new Date(liveStream.scheduledAt).toISOString()
        : "",

      scheduledEndAt: liveStream.scheduledEndAt
        ? new Date(liveStream.scheduledEndAt).toISOString()
        : "",

      status: liveStream.status || "SCHEDULED",
    };

    // =============================================
    // 7. Send notification only to valid IDs
    // =============================================

    const notification = {
      app_id: process.env.ONESIGNAL_APP_ID,

      include_subscription_ids: uniqueSubscriptionIds,

      headings: {
        en: title,
      },

      contents: {
        en: message,
      },

      data: notificationData,
    };

    console.log(
      `[Live Notification] Sending notification to ${uniqueSubscriptionIds.length} users`
    );

    const response = await client.createNotification(notification);

    console.log(
      "[Live Notification] Notification sent successfully:",
      response
    );

    // =============================================
    // 8. Return success response
    // =============================================

    return {
      success: true,
      reason: "NOTIFICATION_SENT",
      totalFollowers: followers.length,
      missingPlayerIds,
      invalidPlayerIds,
      skippedUsers,
      notificationsSent: uniqueSubscriptionIds.length,
      oneSignalResponse: response,
    };

  } catch (error) {
    console.error(
      "[Live Notification] Error sending scheduled live notification:",
      error?.body || error?.message || error
    );

    return {
      success: false,
      reason: "ONESIGNAL_ERROR",
      error: error?.message || "Unknown OneSignal error",
    };
  }
};