const axios = require("axios");
const { whatsappApiKey, 
    whatsappVoucherImageUrl, 
    authUrl, 
    messageUrl, 
    veupCampaignName, 
    veupWabaServiceName, 
    veupWabaTemplateName } = require("../config");

async function sendVoucherMessage({ mobile, amount }) {
  if (!whatsappApiKey || !whatsappVoucherImageUrl) {
    throw new Error("WhatsApp API credentials or voucher image URL is not configured.");
  }

  const tokenResponse = await axios.post(
    authUrl,
    { process_key: whatsappApiKey },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );
  const token = getAuthToken(tokenResponse.data);
  if (!token) {
    throw new Error("WhatsApp authentication did not return a token.");
  }

  return axios.post(
    messageUrl,
    {
      api_key: whatsappApiKey,
      campaign_name: veupCampaignName,
      to: { number: mobile },
      delivery: { type: "single", channels: ["waba"] },
      campaign_data: {
        waba: {
          template_name: veupWabaTemplateName,
          service_name: veupWabaServiceName,
          media_url: whatsappVoucherImageUrl,
          params: [amount],
        },
      },
    },
    {
      headers: {
        "X-API-Key": token.trim(),
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
}

function getAuthToken(data) {
  if (typeof data === "string") return data;
  return data?.token || data?.auth_token || data?.access_token || data?.data?.token || null;
}

module.exports = { sendVoucherMessage };