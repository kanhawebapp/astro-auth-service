import axios from "axios";

const CHAT_APPKEY = process.env.AGORA_CHAT_APPKEY;
const ORG_NAME = process.env.AGORA_CHAT_ORGNAME;
const APP_NAME = process.env.AGORA_CHAT_APNAME;
const CHAT_BASE_URL = process.env.AGORA_CHAT_BASEURL?.replace(/\/+$/, "");

const validateAgoraChatConfig = () => {
  const requiredVariables = {
    AGORA_CHAT_APPKEY: CHAT_APPKEY,
    AGORA_CHAT_ORGNAME: ORG_NAME,
    AGORA_CHAT_APNAME: APP_NAME,
    AGORA_CHAT_BASEURL: CHAT_BASE_URL,
  };

  const missingVariables = Object.entries(requiredVariables)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing Agora Chat environment variables: ${missingVariables.join(", ")}`
    );
  }
};

export const generateAgoraChatUserToken = async (chatUserId) => {
  if (!chatUserId) {
    throw new Error("Agora Chat user ID is required");
  }

  validateAgoraChatConfig();

  const managementToken = await getAgoraManagementToken();

  const tokenUrl =
    `${CHAT_BASE_URL}/${ORG_NAME}/${APP_NAME}/users/` +
    `${encodeURIComponent(chatUserId)}/token`;

  const { data } = await axios.post(
    tokenUrl,
    {},
    {
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  const chatToken = data?.access_token || data?.data?.access_token;

  if (!chatToken) {
    throw new Error("Failed to generate Agora Chat user token");
  }

  return chatToken;
};