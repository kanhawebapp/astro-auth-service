import axios from "axios";

// ==========================================
// Agora Chat Configuration
// ==========================================

const CHAT_APPKEY = process.env.AGORA_CHAT_APPKEY;
const ORG_NAME = process.env.AGORA_CHAT_ORGNAME;
const APP_NAME = process.env.AGORA_CHAT_APNAME;

const CHAT_BASE_URL = process.env.AGORA_CHAT_BASEURL?.replace(/\/+$/, "");

// Agora Chat RESTful API credentials (Customer ID / Customer Secret)
const CLIENT_ID = process.env.AGORA_CHAT_CLIENT_ID;
const CLIENT_SECRET = process.env.AGORA_CHAT_CLIENT_SECRET;

// ==========================================
// Validate Agora Chat Configuration
// ==========================================
console.log(
  "Config Loaded:",
  CHAT_APPKEY,
  ORG_NAME,
  APP_NAME,
  CHAT_BASE_URL,
  CLIENT_ID ? "CLIENT_ID present" : "CLIENT_ID missing",
  CLIENT_SECRET ? "CLIENT_SECRET present" : "CLIENT_SECRET missing",
);

const validateAgoraChatConfig = () => {
  const requiredVariables = {
    AGORA_CHAT_APPKEY: CHAT_APPKEY,
    AGORA_CHAT_ORGNAME: ORG_NAME,
    AGORA_CHAT_APNAME: APP_NAME,
    AGORA_CHAT_BASEURL: CHAT_BASE_URL,
    AGORA_CHAT_CLIENT_ID: CLIENT_ID,
    AGORA_CHAT_CLIENT_SECRET: CLIENT_SECRET,
  };

  const missingVariables = Object.entries(requiredVariables)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing Agora Chat environment variables: ${missingVariables.join(", ")}`,
    );
  }
};

// ==========================================
// Generate Agora Chat Management Token
// ==========================================

/**
 * Generates an Agora Chat management token using Customer ID / Customer Secret.
 *
 * This token is used for administrative REST API operations such as:
 * - Creating chat rooms
 * - Generating user tokens
 *
 * Required environment variables:
 * AGORA_CHAT_CLIENT_ID     (Customer ID from RESTful API Keys page)
 * AGORA_CHAT_CLIENT_SECRET (Customer Secret from RESTful API Keys page)
 * AGORA_CHAT_ORGNAME
 * AGORA_CHAT_APNAME
 * AGORA_CHAT_BASEURL
 *
 * @returns {Promise<string>} Agora Chat management access token
 */
export const getAgoraManagementToken = async () => {
  validateAgoraChatConfig();

  const tokenUrl = `${CHAT_BASE_URL}/${ORG_NAME}/${APP_NAME}/token`;
  console.log("tokenUrl---------:", tokenUrl);

  // Encode Customer ID + Customer Secret as Base64 for Basic Auth
  console.log(`testtttttttttttttttttt ${CLIENT_ID}:${CLIENT_SECRET}`);
  const credentials = Buffer.from(
    `${CLIENT_ID.trim()}:${CLIENT_SECRET.trim()}`,
  ).toString("base64");
  console.log("credentials-------------:",credentials);

  // Debug: verify what is actually being sent (does not expose full secret)
  console.log("=== Token Request Debug ===");
  console.log("URL:", tokenUrl);
  console.log("Auth header:", `Basic ${credentials.substring(0, 24)}...`);
  console.log("CLIENT_ID length:", CLIENT_ID?.length);
  console.log("CLIENT_SECRET length:", CLIENT_SECRET?.length);
  console.log("============================");

  try {
    const { data } = await axios.post(
  tokenUrl,
  {
    grant_type: "client_credentials",
  },
  {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  },
);

    const managementToken = data?.access_token || data?.data?.access_token;
    console.log("managementToken--------------:", managementToken);

    if (!managementToken) {
      throw new Error(
        "Agora Chat management token was not returned by the API",
      );
    }

    return managementToken;
  } catch (error) {
    console.error(
      "Agora Chat management token generation failed:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message ||
        "Failed to generate Agora Chat management token",
    );
  }
};

// ==========================================
// Generate Agora Chat User Token
// ==========================================

/**
 * Generates an Agora Chat user token.
 *
 * @param {string} chatUserId - Agora Chat user ID
 * @returns {Promise<string>} Agora Chat user access token
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

  try {
    const { data } = await axios.post(
      tokenUrl,
      {},
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    const chatToken = data?.access_token || data?.data?.access_token;

    if (!chatToken) {
      throw new Error(
        `Agora Chat user token was not returned for user: ${chatUserId}`,
      );
    }

    return chatToken;
  } catch (error) {
    console.error(
      "Agora Chat user token generation failed:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message ||
        "Failed to generate Agora Chat user token",
    );
  }
};

// ==========================================
// Create Agora Chat Room
// ==========================================

/**
 * Creates an Agora Chat room for an astrologer's live session.
 *
 * @param {Object} params
 * @param {string} params.name - Chat room name
 * @param {string} [params.description=""] - Room description
 * @param {number} [params.maxusers=100] - Maximum room members
 * @param {string} params.owner - Agora Chat user ID of the room owner
 *
 * @returns {Promise<Object>} Created chat room details
 */
export const createAgoraChatRoom = async ({
  name,
  description = "",
  maxusers = 100,
  owner,
}) => {
  validateAgoraChatConfig();

  if (typeof name !== "string" || !name.trim()) {
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
      },
    );

    const room = data?.data?.[0] ?? data?.data ?? data;
    if (!room) {
      throw new Error("Agora Chat did not return room details");
    }

    return room;
  } catch (error) {
    console.error(
      "Agora Chat room creation failed:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create Agora Chat room",
    );
  }
};