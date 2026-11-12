import pkg from "agora-access-token";

const { RtcTokenBuilder, RtcRole } = pkg;

export const generateRtcToken = ({
  channelName,
  uid,
  role = "audience",
}) => {
  const appId = process.env.AGORA_APP_ID?.trim();
  const appCertificate =
    process.env.AGORA_APP_CERTIFICATE?.trim();

  if (!appId || !appCertificate) {
    throw new Error("Agora credentials are missing.");
  }

  if (!channelName) {
    throw new Error("Agora channel name is required.");
  }

  if (uid === undefined || uid === null) {
    throw new Error("Agora UID is required.");
  }

  const expirationTimeInSeconds = 3600;

  const currentTimestamp = Math.floor(Date.now() / 1000);

  const privilegeExpiredTs =
    currentTimestamp + expirationTimeInSeconds;

  const isPublisher =
    role === "host" || role === "publisher";

  const rtcRole = isPublisher
    ? RtcRole.PUBLISHER
    : RtcRole.SUBSCRIBER;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    Number(uid),
    rtcRole,
    privilegeExpiredTs
  );
};