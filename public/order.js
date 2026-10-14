const params = new URLSearchParams(window.location.search);
const bikeId = params.get("id");

const tractorSummary = document.getElementById("tractorSummary");
const orderForm = document.getElementById("orderForm");
const result = document.getElementById("result");

let selectedBike = null;

// Load selected bike
async function loadBike() {
  try {
    const response = await fetch("/api/bikes");
    if (!response.ok) {
      throw new Error("Unable to load bicycles.");
    }

    const bikes = await response.json();

    selectedBike = bikes.find(
      bike => bike.id === bikeId
    );

    if (!selectedBike) {
      tractorSummary.innerHTML =` 
        <div class="error">Bike not found.</div>
      `;

      orderForm.style.display = "none";
      return;
    }

    const depositAmount =
      selectedBike.priceUSD *
      (selectedBike.depositPercent / 100);

    tractorSummary.innerHTML =` 
      <h2>${selectedBike.name}</h2>

      <p>
        <strong>Type:</strong>
        ${selectedBike.bikeType}
      </p>

      <p>
        <strong>Price:</strong>
        $${selectedBike.priceUSD.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </p>

      <p>
        <strong>Deposit (${selectedBike.depositPercent}%):</strong>
        $${depositAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </p>

      <p>
        <strong>Remaining balance:</strong>
        $${(selectedBike.priceUSD - depositAmount).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </p>
    `;

  } catch (error) {
    console.error(error);

    tractorSummary.innerHTML =` 
      <div class="error">
        Unable to load bicycle information.
        Please refresh the page and try again.
      </div>
    `;
  }
}

// Submit bike order
orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedBike) {
    result.className = "error";
    result.textContent =
      "Please wait for the bicycle information to load.";
    return;
  }

  result.className = "";
  result.textContent = "Submitting your order...";

  const submitButton =
    orderForm.querySelector("button[type='submit']");

  submitButton.disabled = true;

  const fullName =
    document.getElementById("fullName").value.trim();

  const email =
    document.getElementById("email").value.trim();

  const phone =
    document.getElementById("phone").value.trim();

  const address =
    document.getElementById("address").value.trim();

  const city =
    document.getElementById("city").value.trim();

  const state =
    document.getElementById("state").value.trim();

  const paymentMethod =
    document.getElementById("paymentMethod").value;
const bikeColor =
  document.getElementById("bikeColor").value;
  // Validate required fields
  if (
    !fullName ||
    !email ||
    !phone ||
    !address ||
    !city ||
    !state ||
    !bikeColor ||
    !paymentMethod
  ) {
    result.className = "error";
    result.textContent =
      "Please complete all customer details.";

    submitButton.disabled = false;
    return;
  }

  // Validate US phone number
  const cleanPhone = phone.replace(/\D/g, "");

  if (!/^\d{10}$/.test(cleanPhone)) {
    result.className = "error";
    result.textContent =
      "Please enter exactly 10 digits for the US phone number.";

    submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch("/api/orders", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        bikeId,
        fullName,
        email,
        phone: cleanPhone,
        address,
        city,
        state,
        bikeColor,
        paymentMethod
      })
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(
        body.error || "Unable to submit your order."
      );
    }if (!body.orderId) {
      throw new Error(
        "The server did not return an order reference. Please contact support before trying again."
      );
    }

    // Redirect after successful order submission
    window.location.href =
      `/order-success.html?orderId=${encodeURIComponent(body.orderId)}`;

  } catch (error) {
    console.error(error);

    result.className = "error";
    result.textContent = error.message;

    submitButton.disabled = false;
  }
});

loadBike();