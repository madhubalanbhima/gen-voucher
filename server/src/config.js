const path = require("path");

require("dotenv").config({
  path: process.env.NODE_ENV === "production"
    ? undefined
    : path.join(__dirname, "..", ".env"),
});

module.exports = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/genvoucher",
  schemeApiUrl: process.env.SCHEME_API_URL,
  schemeApiAuth: process.env.SCHEME_API_AUTH,
  schemeApiXKey: process.env.SCHEME_API_XKEY,
  whatsappApiKey: process.env.WHATSAPP_API_KEY,
  whatsappVoucherImageUrl: process.env.WHATSAPP_VOUCHER_IMAGE_URL,
  authUrl: process.env.AUTH_URL,
  messageUrl: process.env.MESSAGE_URL,
  veupCampaignName: process.env.VEUP_CAMPAIGN_NAME,
  veupWabaTemplateName: process.env.VEUP_WABA_TEMPLATE_NAME,
  veupWabaServiceName: process.env.VEUP_WABA_SERVICE_NAME,
  publicAppUrl: process.env.PUBLIC_APP_URL,
};
