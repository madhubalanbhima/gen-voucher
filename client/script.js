/* ==========================================================
   Gen-Vocher — registration, validation, voucher generation
   The heavy lifting (scheme lookup, matching, storage) now
   happens on the server; this file validates on the client
   for fast feedback and talks to /api/vouchers.
   ========================================================== */

(function () {
  "use strict";

  const API_BASE = "/api/vouchers";

  // ---- Field rules -----------------------------------------------
  // Name: letters only, single spaces between words, max 35 characters.
  const NAME_RE = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
  // Mobile: exactly 10 digits.
  const MOBILE_RE = /^[0-9]{10}$/;
  const PASSBOOK_RE = /^[A-Za-z0-9-]+$/;

  const els = {
    form: document.getElementById("voucherForm"),
    name: document.getElementById("name"),
    mobile: document.getElementById("mobile"),
    passbookNo: document.getElementById("passbookNo"),
    orderDate: document.getElementById("orderDate"),
    address: document.getElementById("address"),
    branchName: document.getElementById("branchName"),
    customerName: document.getElementById("customerName"),
    purchaseMobile: document.getElementById("purchaseMobile"),
    invoiceNumber: document.getElementById("invoiceNumber"),
    purchaseDate: document.getElementById("purchaseDate"),
    category: document.getElementById("category"),
    vaAmount: document.getElementById("vaAmount"),
    purchaseFields: document.getElementById("purchaseFields"),
    schemeModeBtn: document.getElementById("schemeModeBtn"),
    purchaseModeBtn: document.getElementById("purchaseModeBtn"),
    generateBtn: document.getElementById("generateBtn"),
    formStatus: document.getElementById("formStatus"),
    resultArea: document.getElementById("resultArea"),
    registerView: document.getElementById("registerView"),
    voucherView: document.getElementById("voucherView"),
    voucherResult: document.getElementById("voucherResult"),
  };

  let voucherType = "scheme";
  const schemeFieldIds = ["name", "mobile", "passbookNo", "orderDate", "address"];

  function setMode(nextType) {
    voucherType = nextType;
    const isPurchase = voucherType === "purchase";
    els.purchaseFields.hidden = !isPurchase;
    schemeFieldIds.forEach((id) => { els[id].closest(".field").hidden = isPurchase; });
    els.schemeModeBtn.classList.toggle("voucher-mode--active", !isPurchase);
    els.purchaseModeBtn.classList.toggle("voucher-mode--active", isPurchase);
    els.generateBtn.querySelector(".btn-generate__label").textContent = isPurchase ? "Generate purchase voucher" : "Generate scheme voucher";
    els.formStatus.textContent = "";
    els.resultArea.hidden = true;
  }

  els.schemeModeBtn.addEventListener("click", () => setMode("scheme"));
  els.purchaseModeBtn.addEventListener("click", () => setMode("purchase"));

  // ---- Live input shaping ------------------------------------------

  els.mobile.addEventListener("input", () => {
    els.mobile.value = els.mobile.value.replace(/[^0-9]/g, "").slice(0, 10);
  });

  els.purchaseMobile.addEventListener("input", () => {
    els.purchaseMobile.value = els.purchaseMobile.value.replace(/[^0-9]/g, "").slice(0, 10);
  });

  els.passbookNo.addEventListener("input", () => {
    els.passbookNo.value = els.passbookNo.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30);
  });

  els.name.addEventListener("input", () => {
    let v = els.name.value.replace(/[^A-Za-z ]/g, "");
    v = v.replace(/ {2,}/g, " ");
    els.name.value = v.slice(0, 35);
  });

  // ---- Validation -------------------------------------------------

  function setFieldError(fieldEl, errorEl, message) {
    const fieldWrap = fieldEl.closest(".field");
    errorEl.textContent = message || "";
    fieldWrap.classList.toggle("field--invalid", Boolean(message));
  }

  function validateName() {
    const raw = els.name.value;
    const trimmed = raw.trim();
    let msg = "";
    if (!raw) msg = "Name is required.";
    else if (raw !== trimmed) msg = "Remove leading or trailing spaces.";
    else if (raw.length > 35) msg = "Name must be 35 characters or fewer.";
    else if (!NAME_RE.test(raw)) msg = "Use letters and single spaces only — no numbers or symbols.";
    setFieldError(els.name, document.getElementById("err-name"), msg);
    return !msg;
  }

  function validateMobile() {
    const v = els.mobile.value;
    let msg = "";
    if (!v) msg = "Mobile number is required.";
    else if (!MOBILE_RE.test(v)) msg = "Enter exactly 10 digits.";
    setFieldError(els.mobile, document.getElementById("err-mobile"), msg);
    return !msg;
  }

  function validateAddress() {
    const v = els.address.value.trim();
    let msg = "";
    if (!v) msg = "Address is required.";
    setFieldError(els.address, document.getElementById("err-address"), msg);
    return !msg;
  }

  function validatePassbookNo() {
    const v = els.passbookNo.value.trim();
    let msg = "";
    if (!v) msg = "Passbook number is required.";
    else if (!PASSBOOK_RE.test(v)) msg = "Use letters, numbers and hyphens only.";
    setFieldError(els.passbookNo, document.getElementById("err-passbookNo"), msg);
    return !msg;
  }

  function validateOrderDate() {
    const msg = els.orderDate.value ? "" : "Scheme order date is required.";
    setFieldError(els.orderDate, document.getElementById("err-orderDate"), msg);
    return !msg;
  }

  function validatePurchase() {
    const fields = [
      [els.branchName, "err-branchName", "Branch is required."],
      [els.customerName, "err-customerName", "Customer name is required."],
      [els.invoiceNumber, "err-invoiceNumber", "Invoice number is required."],
      [els.purchaseDate, "err-purchaseDate", "Purchase date is required."],
      [els.category, "err-category", "Choose Gold, Diamond or Antique."],
      [els.vaAmount, "err-vaAmount", "Enter a valid VA amount."],
    ];
    let valid = true;
    fields.forEach(([field, errorId, message]) => {
      const value = field.value.trim();
      const validValue = field === els.vaAmount ? value !== "" && Number(value) >= 0 : Boolean(value);
      setFieldError(field, document.getElementById(errorId), validValue ? "" : message);
      valid = validValue && valid;
    });
    const mobileValid = MOBILE_RE.test(els.purchaseMobile.value);
    setFieldError(els.purchaseMobile, document.getElementById("err-purchaseMobile"), mobileValid ? "" : "Enter exactly 10 digits.");
    return mobileValid && valid;
  }

  [
    [els.name, validateName],
    [els.mobile, validateMobile],
    [els.passbookNo, validatePassbookNo],
    [els.orderDate, validateOrderDate],
    [els.address, validateAddress],
  ].forEach(([el, fn]) => el.addEventListener("blur", fn));

  function validateAll() {
    if (voucherType === "purchase") return validatePurchase();
    const results = [validateName(), validateMobile(), validatePassbookNo(), validateOrderDate(), validateAddress()];
    return results.every(Boolean);
  }

  function applyServerErrors(errors) {
    const map = {
      name: [els.name, document.getElementById("err-name")],
      mobile: [els.mobile, document.getElementById("err-mobile")],
      passbookNo: [els.passbookNo, document.getElementById("err-passbookNo")],
      orderDate: [els.orderDate, document.getElementById("err-orderDate")],
      address: [els.address, document.getElementById("err-address")],
      branchName: [els.branchName, document.getElementById("err-branchName")],
      customerName: [els.customerName, document.getElementById("err-customerName")],
      invoiceNumber: [els.invoiceNumber, document.getElementById("err-invoiceNumber")],
      purchaseDate: [els.purchaseDate, document.getElementById("err-purchaseDate")],
      category: [els.category, document.getElementById("err-category")],
      vaAmount: [els.vaAmount, document.getElementById("err-vaAmount")],
    };
    map.mobile = voucherType === "purchase"
      ? [els.purchaseMobile, document.getElementById("err-purchaseMobile")]
      : [els.mobile, document.getElementById("err-mobile")];
    Object.entries(errors || {}).forEach(([key, msg]) => {
      const pair = map[key];
      if (pair) setFieldError(pair[0], pair[1], msg);
    });
  }

  // ---- Formatting helpers -----------------------------------------

  function formatRupees(amount) {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount);
  }

  // ---- Result rendering ---------------------------------------------

  function renderVoucher({ voucherId, name, mobile, voucherNo, amount, voucherAmount, invoiceNumber, issuedAt, voucherType, whatsappStatus }) {
    const amountPerVoucher = voucherAmount ?? amount / 2;
    const deliveryLabel = whatsappStatus === "sent" ? "Sent" : whatsappStatus === "failed" ? "Failed" : "Pending";
    const voucherDetails = (heading) => `
      <div class="voucher">
        <span class="voucher__seal">Verified</span>
        <p class="voucher__eyebrow">${heading}</p>
        <p class="voucher__id">${voucherId}</p>
        <p class="voucher__amount"><sup>&#8377;</sup>${formatRupees(amountPerVoucher)}</p>
        <dl class="voucher__grid">
          <div><dt>Name</dt><dd>${name}</dd></div>
          <div><dt>Mobile</dt><dd>${mobile}</dd></div>
          <div><dt>Voucher no.</dt><dd>${voucherNo}</dd></div>
          <div><dt>Invoice no.</dt><dd>${invoiceNumber}</dd></div>
          <div><dt>Issued</dt><dd>${new Date(issuedAt).toLocaleString("en-IN")}</dd></div>
        </dl>
        <p class="voucher__note">You only purchase the gold jewellery.</p>
        <p class="voucher__delivery">WhatsApp delivery: <strong>${deliveryLabel}</strong></p>
      </div>
    `;

    els.registerView.hidden = true;
    els.voucherView.hidden = false;
    const voucherLabel = voucherType === "purchase" ? "Purchase voucher" : "Voucher";
    const voucherCards = `${voucherDetails(`${voucherLabel} 1`)}${voucherDetails(`${voucherLabel} 2`)}`;
    els.voucherResult.innerHTML = `
      <p class="voucher-total">Total voucher value: <strong><sup>&#8377;</sup>${formatRupees(amount)}</strong></p>
      <div class="voucher-list">
        ${voucherCards}
      </div>
    `;
    celebrateVoucher();
  }

  function celebrateVoucher() {
    document.querySelectorAll(".celebration").forEach((element) => element.remove());

    const celebration = document.createElement("div");
    celebration.className = "celebration";
    celebration.setAttribute("aria-hidden", "true");

    const colors = ["#C79A46", "#2F6B4F", "#A23B3B", "#315B87", "#D77A32"];
    for (let index = 0; index < 34; index += 1) {
      const paper = document.createElement("span");
      paper.className = "celebration__paper";
      paper.style.setProperty("--paper-color", colors[index % colors.length]);
      paper.style.setProperty("--paper-left", `${Math.random() * 100}%`);
      paper.style.setProperty("--paper-delay", `${Math.random() * 0.55}s`);
      paper.style.setProperty("--paper-duration", `${2.1 + Math.random() * 1.5}s`);
      paper.style.setProperty("--paper-rotate", `${Math.round(Math.random() * 360)}deg`);
      celebration.appendChild(paper);
    }

    const splash = document.createElement("span");
    splash.className = "celebration__splash";
    celebration.appendChild(splash);
    document.body.appendChild(celebration);
    window.setTimeout(() => celebration.remove(), 4300);
  }

  function renderPending() {
    els.resultArea.hidden = false;
    els.resultArea.innerHTML = `
      <div class="pending">
        <span class="pending__icon">!</span>
        <div>
          <h3>No matching scheme record yet</h3>
          <p>Your mobile number and voucher number didn't match our current scheme records. Please wait 24 hours for receiving voucher, then check back.</p>
        </div>
      </div>
    `;
  }

  function renderServerError(message) {
    els.resultArea.hidden = false;
    els.resultArea.innerHTML = `
      <div class="pending">
        <span class="pending__icon">!</span>
        <div>
          <h3>Couldn't complete your request</h3>
          <p>${message || "Something went wrong reaching scheme records. Please try again."}</p>
        </div>
      </div>
    `;
  }

  // ---- Submit handler -------------------------------------------------

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.resultArea.hidden = true;
    els.resultArea.innerHTML = "";

    if (!validateAll()) {
      els.formStatus.textContent = "Please fix the highlighted fields.";
      return;
    }

    const payload = voucherType === "purchase"
      ? {
          branchName: els.branchName.value.trim(),
          customerName: els.customerName.value.trim(),
          mobile: els.purchaseMobile.value.trim(),
          invoiceNumber: els.invoiceNumber.value.trim(),
          purchaseDate: els.purchaseDate.value,
          category: els.category.value,
          vaAmount: els.vaAmount.value.trim(),
        }
      : {
          name: els.name.value.trim(),
          mobile: els.mobile.value.trim(),
          passbookNo: els.passbookNo.value.trim(),
          orderDate: els.orderDate.value,
          address: els.address.value.trim(),
        };

    els.generateBtn.disabled = true;
    els.formStatus.textContent = voucherType === "purchase" ? "Generating purchase voucher..." : "Checking scheme records…";

    try {
      const endpoint = voucherType === "purchase" ? "purchase" : "generate";
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (res.status === 201 && body.status === "issued") {
        renderVoucher(body.voucher);
        els.formStatus.textContent = "Voucher generated.";
      } else if (body.status === "pending") {
        renderPending();
        els.formStatus.textContent = "";
      } else if (body.status === "ineligible" || body.status === "duplicate") {
        renderPending();
        els.resultArea.querySelector("h3").textContent = body.status === "duplicate" ? "Passbook already used" : "Voucher not eligible";
        els.resultArea.querySelector("p").textContent = body.message;
        els.formStatus.textContent = "";
      } else if (body.status === "invalid") {
        applyServerErrors(body.errors);
        els.formStatus.textContent = "Please fix the highlighted fields.";
      } else {
        renderServerError(body.message);
        els.formStatus.textContent = "";
      }
    } catch (err) {
      renderServerError();
      els.formStatus.textContent = "";
    } finally {
      els.generateBtn.disabled = false;
    }
  });

})();
