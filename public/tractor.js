async function loadDetails() {
  const id = new URLSearchParams(location.search).get("id");
  const box = document.getElementById("details");
  if (!id) {
    box.innerHTML = '<div class="error">No tractor selected.</div>';
    return;
  }

  const res = await fetch(`/api/bikes/${encodeURIComponent(id)}`);
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

  <div class="price">
    $${t.priceUSD.toLocaleString()}
  </div>

  <ul class="specs">
    <li><strong>Brand:</strong> ${t.brand}</li>
    <li><strong>Model:</strong> ${t.model}</li>
    <li><strong>Bike type:</strong> ${t.bikeType}</li>
    <li><strong>Frame:</strong> ${t.frame}</li>
    <li><strong>Gears:</strong> ${t.gears}</li>
    <li><strong>Brakes:</strong> ${t.brakes}</li>
    <li><strong>Suspension:</strong> ${t.suspension}</li>
    <li>
      <strong>Order deposit (6.5%):</strong>
      $${deposit.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}
    </li>
  </ul>

  <a class="button primary"
     href="/order.html?id=${encodeURIComponent(t.id)}">
    Order This Bike
  </a>
</section>
  `;
}
loadDetails();
