// Aktif menü vurgusu
const navLinks = document.querySelectorAll('nav a');
navLinks.forEach(link => {
  if (window.location.pathname.endsWith(link.getAttribute('href'))) {
    link.classList.add('active');
  }
});

// Demo order book verisi (sadece index.html için)
if (document.getElementById('orderbook-body')) {
  const bids = [
    { price: 64200, amount: 0.5 },
    { price: 64180, amount: 0.8 },
    { price: 64150, amount: 1.2 }
  ];
  const asks = [
    { price: 64220, amount: 0.4 },
    { price: 64250, amount: 0.7 },
    { price: 64280, amount: 1.1 }
  ];
  const tbody = document.getElementById('orderbook-body');
  bids.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.price}</td><td>${row.amount}</td><td>Alış</td>`;
    tbody.appendChild(tr);
  });
  asks.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.price}</td><td>${row.amount}</td><td>Satış</td>`;
    tbody.appendChild(tr);
  });
} 