import OneSignal from "@onesignal/node-onesignal";

const client = new OneSignal.DefaultApi(
  OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY,
  })
);

/**
 * Send scheduled live notification to all astrologer followers.
 *
 * No Redis presence checking.
 * Notifications are sent regardless of foreground/background status.
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
    // =============================================
    // 1. Validate input
    // =============================================
      console.log("comming sendScheduledLiveNotification");
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

    if (
      !process.env.ONESIGNAL_APP_ID ||
      !process.env.ONESIGNAL_REST_API_KEY
    ) {
      throw new Error("OneSignal environment variables are missing");
    }

    // =============================================
    // 2. Notification content
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
    // 3. Collect OneSignal subscription IDs
    // =============================================

    const subscriptionIds = [];

    let missingPlayerIds = 0;

    for (const follower of followers) {
      const playerId = follower.playerId;

      if (!playerId || typeof playerId !== "string") {
        missingPlayerIds++;

        console.log(
          `[Live Notification] OneSignal player ID missing for user: ${
            follower.userId || "UNKNOWN"
          }`
        );

        continue;
      }

      subscriptionIds.push(playerId);
    }

    // =============================================
    // 4. Remove duplicate subscription IDs
    // =============================================

    const uniqueSubscriptionIds = [
      ...new Set(subscriptionIds),
    ];

    if (uniqueSubscriptionIds.length === 0) {
      return {
        success: true,
        reason: "NO_ELIGIBLE_SUBSCRIPTIONS",
        totalFollowers: followers.length,
        missingPlayerIds,
        notificationsSent: 0,
      };
    }

    // =============================================
    // 5. Send notification through OneSignal
    // =============================================

    const response = await client.createNotification({
      app_id: process.env.ONESIGNAL_APP_ID,

      include_subscription_ids: uniqueSubscriptionIds,

      headings: {
        en: title,
      },

      contents: {
        en: message,
      },

      data: notificationData,
    });

    console.log(
      `[Live Notification] Notification sent to followers of astrologer ${astrologer.id}`,
      response
    );

    // =============================================
    // 6. Return result
    // =============================================

    return {
      success: true,
      reason: "NOTIFICATION_SENT",
      totalFollowers: followers.length,
      missingPlayerIds,
      notificationsSent: uniqueSubscriptionIds.length,
      oneSignalResponse: response,
    };
  } catch (error) {
    console.error(
      "[Live Notification] Error sending scheduled live notification:",
      error
    );

    return {
      success: false,
      reason: "ONESIGNAL_ERROR",
      error: error.message,
    };
  }
};