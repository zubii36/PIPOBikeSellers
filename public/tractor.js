async function loadDetails() {
  const id = new URLSearchParams(location.search).get("id");
  const box = document.getElementById("details");
  if (!id) {
    box.innerHTML = '<div class="error">No tractor selected.</div>';
    return;
  }

  const res = await fetch(`/api/tractors/${encodeURIComponent(id)}`);
  if (!res.ok) {
    box.innerHTML = '<div class="error">Tractor not found.</div>';
    return;
  }

  const t = await res.json();
  const deposit = t.priceUSD * (t.depositPercent / 100);

  box.innerHTML = `
    <section class="details">
      <h2>${t.name}</h2>
      <p>${t.description}</p>
      <div class="price">$${t.priceUSD.toLocaleString()}</div>
      <ul class="specs">
        <li><strong>Brand:</strong> ${t.brand}</li>
        <li><strong>Model:</strong> ${t.model}</li>
        <li><strong>Horsepower:</strong> ${t.horsepower}</li>
        <li><strong>Engine:</strong> ${t.engine}</li>
        <li><strong>Transmission:</strong> ${t.transmission}</li>
        <li><strong>Drive:</strong> ${t.drive}</li>
        <li><strong>Weight:</strong> ${t.weight}</li>
        <li><strong>Lift capacity:</strong> ${t.liftCapacity}</li>
        <li><strong>Order deposit:</strong> $${deposit.toLocaleString()}</li>
      </ul>
      <a class="button primary" href="/order.html?id=${t.id}">Place Order</a>
    </section>
  `;
}
loadDetails();
