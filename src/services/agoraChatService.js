export const generateAgoraChatUserToken = async (chatUserId) => {
  if (!chatUserId) {
    throw new Error("Agora Chat user ID is required");
  }

  const managementToken = await getAgoraManagementToken();

  const { data } = await axios.post(
    `${CHAT_BASE_URL}/${ORG_NAME}/${APP_NAME}/users/${encodeURIComponent(chatUserId)}/token`,
    {},
    {
      headers: {
        Authorization: `Bearer ${managementToken}`,
      },
    }
  );

  const chatToken = data?.access_token || data?.data?.access_token;

  if (!chatToken) {
    throw new Error("Failed to generate Agora Chat user token");
  }

  return chatToken;
};