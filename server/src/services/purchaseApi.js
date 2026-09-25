const MOCK_PURCHASE = 
{
  branchName: "Thanjavur",
  branchCode: "",
  metalDetails: {
    Variant: "Gold",
    Category: "Antique",
    metalPurity: "22k",
    price: 20000,
    vaBenefit: 20,
    vaAmount: 10000,
    Discount: 30,
    discountAmount: 2090,
  },
  customerDetails: {
    customerName: "Test user",
    mobileNumber: "7092312320",
    panNumber: "",
    Aadhar: "",
    Pincode: 659087,
  },
  invoiceNumber: 202609250,
  Date: "23-09-2026",
  Time: "13:06",
  Status: "Success",
};

async function fetchPurchaseDetails(purchasePayload) {
  if (purchasePayload) {
    return purchasePayload;
  }

  return MOCK_PURCHASE;
}

module.exports = { fetchPurchaseDetails };