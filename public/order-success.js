const params = new URLSearchParams(window.location.search);

const orderId = params.get("orderId");

const orderNumber = document.getElementById("orderNumber");
const uploadForm = document.getElementById("uploadForm");
const paymentScreenshot =
  document.getElementById("paymentScreenshot");
const uploadButton =
  document.getElementById("uploadButton");
const uploadResult =
  document.getElementById("uploadResult");


if (!orderId) {

  orderNumber.textContent = "Order number unavailable";

  uploadForm.style.display = "none";

} else {

  orderNumber.textContent = orderId;

}


uploadForm.addEventListener("submit", async (event) => {

  event.preventDefault();


  if (!orderId) {

    uploadResult.className = "error";

    uploadResult.textContent =
      "Order number is missing.";

    return;
  }


  const file = paymentScreenshot.files[0];


  if (!file) {

    uploadResult.className = "error";

    uploadResult.textContent =
      "Please select your payment confirmation.";

    return;
  }


  uploadButton.disabled = true;

  uploadButton.textContent =
    "Uploading...";

  uploadResult.className = "";

  uploadResult.textContent =
    "Uploading your payment confirmation...";


  try {

    const formData = new FormData();

    formData.append("orderId", orderId);
    formData.append("paymentScreenshot", file);


    const response = await fetch(
      "/api/orders/payment-screenshot",
      {
        method: "POST",
        body: formData
      }
    );


    const data = await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Unable to upload payment confirmation."
      );

    }


    uploadResult.className = "success";

    uploadResult.innerHTML =` 
      <strong>Payment confirmation uploaded successfully.</strong>
      <br>
      Your payment confirmation has been received.
    `;

    uploadButton.disabled = true;

    uploadButton.textContent =
      "Payment Confirmation Uploaded";


  } catch (error) {

    console.error(error);

    uploadResult.className = "error";

    uploadResult.textContent =
      error.message;

    uploadButton.disabled = false;

    uploadButton.textContent =
      "Upload Payment Confirmation";
  }

});