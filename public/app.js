async function loadTractors() {
  const grid = document.getElementById("tractorGrid");
  const res = await fetch("/api/bikes");
  const tractors = await res.json();

  grid.innerHTML = tractors.map(t => {
    const deposit = t.priceUSD * (t.depositPercent / 100);
    return `
      <article class="card">
  <h3>${t.name}</h3>
  <p>${t.description}</p>

  <div class="price">
    $${t.priceUSD.toLocaleString()}
  </div>

  <ul class="specs">
    <li>Type: ${t.bikeType}</li>
    <li>Frame: ${t.frame}</li>
    <li>Gears: ${t.gears}</li>
    <li>Brakes: ${t.brakes}</li>
    <li>Estimated deposit: $${deposit.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}</li>
  </ul>

  <a class="button secondary"
     href="/tractor.html?id=${encodeURIComponent(t.id)}">
    View Details
  </a>

  <a class="button primary"
     href="/order.html?id=${encodeURIComponent(t.id)}">
    Order Now
  </a>
</article>
    `;
  }).join("");
}
loadTractors();
