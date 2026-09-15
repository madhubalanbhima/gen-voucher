const axios = require("axios");
const { schemeApiUrl, schemeApiAuth, schemeApiXKey } = require("../config");

/**
 * Calls the customer scheme API for a given mobile number.
 * The scheme API returns records in `schemes` and uses `status: true`.
 */
async function fetchSchemeRecordsByMobile(mobile) {
  if (!schemeApiUrl) {
    throw new Error("SCHEME_API_URL is not configured.");
  }

  const response = await axios.post( 
    schemeApiUrl,
    { customerCode: "", mobileNo: mobile, orderNo: "" },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: schemeApiAuth,
        "X-key": schemeApiXKey,
      },
      timeout: 15000,
    }
  );
  return response.data;
}

/**
 * Finds the scheme record whose voucherNo AND customer mobile number both
 * match what the person entered in the form.
 */
function findMatchingRecord(apiResponse, mobile, voucherNo) {
  const isSuccessful = apiResponse?.status === true || apiResponse?.status === "true" || apiResponse?.success === true;
  if (!isSuccessful) {
    return null;
  }

  const records = Array.isArray(apiResponse.schemes)
    ? apiResponse.schemes
    : apiResponse.data;

  if (!Array.isArray(records)) {
    return null;
  }

  const targetMobile = normalizeMobile(mobile);
  const targetVoucherNo = normalizeVoucherNo(voucherNo);

  return (
    records.find((entry) => {
      const entryMobile = normalizeMobile(entry?.customerDetailsViewModel?.mobileNo);
      const entryVoucherNo = normalizeVoucherNo(entry?.voucherNo);
      const matchingOrder = getOrderDetails(entry).find(
        (order) => normalizeVoucherNo(order?.voucherNo) === targetVoucherNo
      );
      const mobileMatches = entryMobile.length === 10
        ? entryMobile === targetMobile
        : targetMobile.length === 10;
      const voucherMatches = entryVoucherNo === targetVoucherNo || Boolean(matchingOrder);

      if (mobileMatches && voucherMatches) {
        entry.matchingOrderDetail = matchingOrder || null;
        return true;
      }

      return false;
    }) || null
  );
}

function getOrderDetails(entry) {
  return Array.isArray(entry?.schemeDataViewModel?.schemeOrderDetailsModel)
    ? entry.schemeDataViewModel.schemeOrderDetailsModel
    : [];
}

function normalizeMobile(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeVoucherNo(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

module.exports = { fetchSchemeRecordsByMobile, findMatchingRecord };
