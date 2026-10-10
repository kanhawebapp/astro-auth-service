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

/**
 * Generate an Agora Chat user token.
 *
 * Requires your existing getAgoraManagementToken() implementation.
 */
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

/**
 * Create an Agora Chat room.
 *
 * @param {Object} params
 * @param {string} params.name - Room name
 * @param {string} params.description - Room description
 * @param {number} params.maxusers - Maximum room members
 * @param {string} params.owner - Agora Chat user ID of the owner
 */
export const createAgoraChatRoom = async ({
  name,
  description = "",
  maxusers = 100,
  owner,
}) => {
  validateAgoraChatConfig();

  if (!name || !name.trim()) {
    throw new Error("Agora Chat room name is required");
  }

  if (!owner) {
    throw new Error("Agora Chat room owner is required");
  }

  if (!Number.isInteger(maxusers) || maxusers < 1) {
    throw new Error("maxusers must be a positive integer");
  }

  const managementToken = await getAgoraManagementToken();

  const roomUrl = `${CHAT_BASE_URL}/${ORG_NAME}/${APP_NAME}/chatrooms`;

  try {
    const { data } = await axios.post(
      roomUrl,
      {
        name: name.trim(),
        description,
        maxusers,
        owner,
      },
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const room = data?.data?.[0] ?? data?.data ?? data;

    if (!room) {
      throw new Error("Agora Chat did not return room details");
    }

    return room;
  } catch (error) {
    console.error(
      "Agora Chat room creation failed:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create Agora Chat room"
    );
  }
};