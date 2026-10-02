async function loadTractors() {
  const grid = document.getElementById("tractorGrid");
  const res = await fetch("/api/tractors");
  const tractors = await res.json();

  grid.innerHTML = tractors.map(t => {
    const deposit = t.priceUSD * (t.depositPercent / 100);
    return `
      <article class="card">
        <h3>${t.name}</h3>
        <p>${t.description}</p>
        <div class="price">$${t.priceUSD.toLocaleString()}</div>
        <ul class="specs">
          <li>${t.horsepower}</li>
          <li>${t.drive}</li>
          <li>${t.transmission}</li>
          <li>Estimated deposit: $${deposit.toLocaleString()}</li>
        </ul>
        <a class="button secondary" href="/tractor.html?id=${t.id}">View Details</a>
        <a class="button primary" href="/order.html?id=${t.id}">Order Now</a>
      </article>
    `;
  }).join("");
}
loadTractors();
