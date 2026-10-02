const params = new URLSearchParams(window.location.search);
const tractorId = params.get("id");

const tractorSummary = document.getElementById("tractorSummary");
const orderForm = document.getElementById("orderForm");
const result = document.getElementById("result");

let selectedTractor = null;

// Load selected tractor
async function loadTractor() {
  try {
    const response = await fetch("/api/tractors");
    const tractors = await response.json();

    selectedTractor = tractors.find(
      tractor => tractor.id === tractorId
    );

    if (!selectedTractor) {
      tractorSummary.innerHTML =` 
        <div class="error">
          Tractor not found.
        </div>
      `;

      orderForm.style.display = "none";
      return;
    }

    const depositAmount =
      selectedTractor.priceUSD *
      (selectedTractor.depositPercent / 100);

    tractorSummary.innerHTML =` 
      <h2>${selectedTractor.name}</h2>

      <p>
        <strong>Price:</strong>
        $${selectedTractor.priceUSD.toLocaleString()}
      </p>

      <p>
        <strong>Deposit:</strong>
        ${selectedTractor.depositPercent}%
        ($${depositAmount.toLocaleString()})
      </p>
    `;

  } catch (error) {
    console.error(error);

    tractorSummary.innerHTML =` 
      <div class="error">
        Unable to load tractor information.
      </div>
    `;
  }
}


// Submit order
orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  result.className = "";
  result.textContent = "Submitting your order...";

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

  // Check required fields
  if (
    !fullName ||
    !email ||
    !phone ||
    !address ||
    !city ||
    !state||
    !paymentMethod
  ) {
    result.className = "error";

    result.textContent =
      "Please complete all customer details.";

    return;
  }


  // Check US phone number
  const cleanPhone = phone.replace(/\D/g, "");

  if (!/^\d{10}$/.test(cleanPhone)) {
    result.className = "error";

    result.textContent =
      "Please enter exactly 10 digits for the US phone number.";

    return;
  }


  try {

    // Create order
    const response = await fetch("/api/orders", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        tractorId,
        fullName,
        email,
        phone: cleanPhone,
        address,
        city,
        state,
        paymentMethod
      })
    });


    const body = await response.json();


    if (!response.ok) {
      throw new Error(
        body.error || "Unable to submit your order."
      );
    }


    // Successful order
    window.location.href =
  `/order-success.html?orderId=${encodeURIComponent(body.orderId)}`;


    // Disable the form after successful submission
    orderForm.querySelector("button[type='submit']").disabled = true;


  } catch (error) {

    console.error(error);

    result.className = "error";

    result.textContent = error.message;
  }
});


loadTractor();