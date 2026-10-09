import axios from "axios";

export const sendOneSignalNotification = async ({
title,
message,
externalIds,
data = {},
}) => {
if (!process.env.ONESIGNAL_REST_API_KEY ||
!process.env.ONESIGNAL_APP_ID) {
throw new Error("OneSignal credentials are missing");
}

if (!externalIds?.length) {
return { skipped: true, reason: "No recipients provided" };
}

const response = await axios.post(
"https://api.onesignal.com/notifications",
{
app_id: process.env.ONESIGNAL_APP_ID,
target_channel: "push",
include_aliases: {
external_id: externalIds,
},
headings: { en: title },
contents: { en: message },
data,
},
{
headers: {
Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
"Content-Type": "application/json",
},
}
);

return response.data;
};

