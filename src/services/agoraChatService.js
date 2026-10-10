import axios from "axios";
import agoraToken from "agora-token";
import { randomBytes } from "node:crypto";

const { ChatTokenBuilder } = agoraToken;

// ======================================================
// Agora Chat Configuration
// ======================================================

const CHAT_APPKEY = process.env.AGORA_CHAT_APPKEY?.trim() || "";

const ORG_NAME = process.env.AGORA_CHAT_ORGNAME?.trim() || "";

const APP_NAME = process.env.AGORA_CHAT_APNAME?.trim() || "";

const CHAT_BASE_URL =
  process.env.AGORA_CHAT_BASEURL?.trim().replace(/\/+$/, "") || "";

// Agora project credentials.
// Obtain these from the Agora Console.
const APP_ID = process.env.AGORA_CHAT_APP_ID?.trim() || "";

const APP_CERTIFICATE =
  process.env.AGORA_CHAT_APP_CERTIFICATE?.trim() || "";

// Token expiration: 24 hours.
const TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60;

// ======================================================
// Validate Configuration
// ======================================================

const validateAgoraChatConfig = () => {
  const requiredVariables = {
    AGORA_CHAT_APPKEY: CHAT_APPKEY,
    AGORA_CHAT_ORGNAME: ORG_NAME,
    AGORA_CHAT_APNAME: APP_NAME,
    AGORA_CHAT_BASEURL: CHAT_BASE_URL,
    AGORA_CHAT_APP_ID: APP_ID,
    AGORA_CHAT_APP_CERTIFICATE: APP_CERTIFICATE,
  };

  const missingVariables = Object.entries(requiredVariables)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing Agora Chat environment variables: ${missingVariables.join(", ")}`,
    );
  }

  if (!ChatTokenBuilder) {
    throw new Error(
      "ChatTokenBuilder was not found in the agora-token package",
    );
  }
};

// ======================================================
// Helper: Extract Agora API Error
// ======================================================

const getAgoraErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;

  return (
    responseData?.error_description ||
    responseData?.error ||
    responseData?.message ||
    error?.message ||
    fallbackMessage
  );
};

// ======================================================
// Generate Agora Chat App Token
// ======================================================

/**
 * Generates an Agora Chat app token locally.
 *
 * This token is used for administrative Chat REST API
 * operations, such as creating chat rooms.
 *
 * Required environment variables:
 * AGORA_CHAT_APP_ID
 * AGORA_CHAT_APP_CERTIFICATE
 *
 * @returns {Promise<string>}
 */
export const getAgoraManagementToken = async () => {
  validateAgoraChatConfig();

  try {
    const appToken = ChatTokenBuilder.buildAppToken(
      APP_ID,
      APP_CERTIFICATE,
      TOKEN_EXPIRATION_SECONDS,
    );

    if (!appToken || typeof appToken !== "string") {
      throw new Error("Agora Chat app token generation failed");
    }

    console.log("Agora Chat app token generated successfully");

    return appToken;
  } catch (error) {
    console.error(
      "Agora Chat app token generation failed:",
      error.message,
    );

    throw new Error(
      `Failed to generate Agora Chat app token: ${error.message}`,
    );
  }
};

// ======================================================
// Generate Agora Chat User Token
// ======================================================

/**
 * Generates an Agora Chat user token locally.
 *
 * IMPORTANT:
 * chatUserId must be the actual Agora Chat username/UUID
 * registered with Agora Chat.
 *
 * It must not be an unrelated application database ID.
 *
 * @param {string} chatUserId
 * @returns {Promise<string>}
 */
export const generateAgoraChatUserToken = async (chatUserId) => {
  validateAgoraChatConfig();

  if (
    chatUserId === undefined ||
    chatUserId === null ||
    String(chatUserId).trim() === ""
  ) {
    throw new Error("Agora Chat user ID is required");
  }

  const agoraUsername = String(chatUserId).trim();

  try {
    const chatToken = ChatTokenBuilder.buildUserToken(
      APP_ID,
      APP_CERTIFICATE,
      agoraUsername,
      TOKEN_EXPIRATION_SECONDS,
    );

    if (!chatToken || typeof chatToken !== "string") {
      throw new Error("Agora Chat user token generation failed");
    }

    console.log("Agora Chat user token generated successfully");

    return chatToken;
  } catch (error) {
    console.error(
      "Agora Chat user token generation failed:",
      error.message,
    );

    throw new Error(
      `Failed to generate Agora Chat user token: ${error.message}`,
    );
  }
};

// ======================================================
// Create Agora Chat Room
// ======================================================

/**
 * Creates an Agora Chat room for a live-streaming session.
 *
 * The owner must be an existing Agora Chat username.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} [params.description=""]
 * @param {number} [params.maxusers=100]
 * @param {string} params.owner
 *
 * @returns {Promise<Object>}
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

  if (
    owner === undefined ||
    owner === null ||
    String(owner).trim() === ""
  ) {
    throw new Error("Agora Chat room owner is required");
  }

  if (!Number.isInteger(maxusers) || maxusers < 1) {
    throw new Error("maxusers must be a positive integer");
  }

  const managementToken = await getAgoraManagementToken();

  const roomUrl = `${CHAT_BASE_URL}/${ORG_NAME}/${APP_NAME}/chatrooms`;

  const roomPayload = {
    name: name.trim(),
    description: String(description || ""),
    maxusers,
    owner: String(owner).trim(),
  };

  try {
    const response = await axios.post(roomUrl, roomPayload, {
      headers: {
        Authorization: `Bearer ${managementToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    const responseData = response.data;

    const room =
      responseData?.data?.[0] ??
      responseData?.data ??
      responseData;

    if (!room) {
      throw new Error("Agora Chat did not return room details");
    }

    console.log("Agora Chat room created successfully");

    return room;
  } catch (error) {
    console.error("Agora Chat room creation failed:", {
      status: error.response?.status,
      error: error.response?.data?.error,
      message: getAgoraErrorMessage(
        error,
        "Failed to create Agora Chat room",
      ),
    });

    throw new Error(
      getAgoraErrorMessage(
        error,
        "Failed to create Agora Chat room",
      ),
    );
  }
};

// ======================================================
// Register Agora Chat User
// ======================================================

export const registerAgoraChatUser = async ({
  username,
  password,
  nickname,
}) => {
  validateAgoraChatConfig();

  if (!username || !String(username).trim()) {
    throw new Error("Agora Chat username is required");
  }

  const chatUsername = String(username).trim();

  // Agora usernames should use lowercase letters, numbers,
  // underscores, hyphens, or periods.
  if (
    chatUsername.length > 64 ||
    !/^[a-z0-9_.-]+$/.test(chatUsername)
  ) {
    throw new Error(
      "Invalid Agora Chat username. Use lowercase letters, numbers, underscores, hyphens, or periods.",
    );
  }

  // The resolver can omit password because the backend generates one.
  // Keep an explicitly supplied password if your application needs it.
  const chatPassword =
    password && String(password).trim()
      ? String(password)
      : randomBytes(32).toString("hex");

  const managementToken = await getAgoraManagementToken();

  const registrationUrl =
    `${CHAT_BASE_URL}/${ORG_NAME}/${APP_NAME}/users`;

  try {
    const response = await axios.post(
      registrationUrl,
      {
        username: chatUsername,
        password: chatPassword,
        nickname:
          nickname && String(nickname).trim()
            ? String(nickname).trim()
            : chatUsername,
      },
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    console.log("Agora Chat user registered successfully");

    return {
      username: chatUsername,
      alreadyExists: false,
      data: response.data,
    };
  } catch (error) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    const errorMessage = String(
      getAgoraErrorMessage(
        error,
        "Failed to register Agora Chat user",
      ),
    );

    // Treat the error as a duplicate only when the response
    // actually indicates that the username already exists.
    const duplicateUser =
      /already exists|already exist|duplicate_unique_property_exists|duplicate username|username.*exist|user.*exist/i.test(
        errorMessage,
      ) ||
      /duplicate_unique_property_exists/i.test(
        String(responseData?.error || responseData?.code || ""),
      );

    if (duplicateUser && (status === 400 || status === 409)) {
      console.log("Agora Chat user already exists");

      return {
        username: chatUsername,
        alreadyExists: true,
      };
    }

    console.error("Agora Chat user registration failed:", {
      status,
      error: responseData?.error,
      message: errorMessage,
    });

    throw new Error(
      `Agora Chat user registration failed: ${errorMessage}`,
    );
  }
};

// ======================================================
// Get Agora Chat App Key
// ======================================================

/**
 * Returns the Chat App Key for the frontend SDK.
 *
 * An App Key typically has the format:
 * organizationName#applicationName
 *
 * This is not the same as the Agora project App ID.
 *
 * @returns {string}
 */
export const getAgoraChatAppKey = () => {
  validateAgoraChatConfig();

  return CHAT_APPKEY;
};