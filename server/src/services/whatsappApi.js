const axios = require("axios");
const { whatsappApiKey, 
    whatsappVoucherImageUrl, 
    authUrl, 
    messageUrl, 
    veupCampaignName, 
    veupWabaServiceName, 
    veupWabaTemplateName } = require("../config");

async function sendVoucherMessage({ mobile, amount, imageUrl, templateName }) {
  const mediaUrl = imageUrl || whatsappVoucherImageUrl;
  const recipientNumber = formatRecipientNumber(mobile);
  if (!whatsappApiKey || !mediaUrl) {
    throw new Error("WhatsApp API credentials or voucher image URL is not configured.");
  }
  assertUrl(authUrl, "AUTH_URL");
  assertUrl(messageUrl, "MESSAGE_URL");

  let tokenResponse;
  try {
    tokenResponse = await axios.post(
      authUrl,
      { process_key: whatsappApiKey },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
  } catch (err) {
    throw formatApiError(err, "WhatsApp authentication");
  }
  const token = getAuthToken(tokenResponse.data);
  if (!token) {
    throw new Error("WhatsApp authentication did not return a token.");
  }

  let response;
  try {
    response = await axios.post(
      messageUrl,
      {
        api_key: whatsappApiKey,
        campaign_name: veupCampaignName,
        to: { number: recipientNumber },
        delivery: { type: "single", channels: ["waba"] },
        campaign_data: {
          waba: {
            template_name: templateName || veupWabaTemplateName,
            service_name: veupWabaServiceName,
            media_url: mediaUrl,
            params: [String(amount)],
          },
        },
      },
      {
        headers: {
          "X-API-Key": token.trim(),
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );
  } catch (err) {
    throw formatApiError(err, "WhatsApp message");
  }

  return response;
}

function formatRecipientNumber(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return String(mobile || "").trim();
}

function assertUrl(value, variableName) {
  try {
    new URL(value);
  } catch (err) {
    throw new Error(`${variableName} is missing or invalid.`);
  }
}

function formatApiError(error, operation) {
  if (!error.response) return error;
  const responseBody = typeof error.response.data === "string"
    ? error.response.data
    : JSON.stringify(error.response.data);
  return new Error(`${operation} rejected the request (${error.response.status}): ${responseBody}`);
}

function getAuthToken(data) {
  if (typeof data === "string") return data;
  return data?.token || data?.auth_token || data?.access_token || data?.data?.token || null;
}

module.exports = { sendVoucherMessage };