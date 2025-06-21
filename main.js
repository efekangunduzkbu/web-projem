// Aktif menü vurgusu
const navLinks = document.querySelectorAll('nav a');
navLinks.forEach(link => {
  if (window.location.pathname.endsWith(link.getAttribute('href')) ||
    (window.location.pathname === '/' && link.getAttribute('href') === 'index.html')) {
    link.classList.add('active');
  }
});

// --- Gelişmiş Order Book Script'i ---

const orderBooksContainer = document.getElementById('orderBooksContainer');
const refreshIntervals = {};
const autoRefreshStates = {};
const coinParams = {};
const previousOrders = {};
const orderCounters = {};

function addCoin() {
  const coinInput = document.getElementById('coinInput');
  const coinSymbol = coinInput.value.trim().toUpperCase();
  if (!coinSymbol) return;

  const prefix = coinSymbol.split('-')[0].toLowerCase();
  const minTotal = parseFloat(document.getElementById('minTotalInput').value) || 0;

  coinParams[prefix] = { coinSymbol, minTotal };

  if (document.getElementById(`${prefix}OrderBook`)) {
    alert(`${coinSymbol} zaten ekli.`);
    return;
  }

  const orderBookSection = document.createElement('div');
  orderBookSection.id = `${prefix}OrderBook`;
  orderBookSection.innerHTML = `
    <h2 class="text-center">${coinSymbol}</h2>
    <div class="coin-controls">
      <button class="btn-toggle-refresh" id="${prefix}AutoRefreshBtn" onclick="toggleAutoRefresh('${prefix}')">Oto. Yenile: KAPALI</button>
      <span id="${prefix}LastUpdate"></span>
      <button class="btn-remove" onclick="removeCoin('${prefix}')">Kaldır</button>
    </div>
    <div class="orderbook-container">
      <div class="order-book">
        <h3 class="bids">Alış Emirleri</h3>
        <div class="order-book-table-container">
          <table class="orderbook-table">
            <thead><tr><th>Fiyat</th><th>Sayaç</th><th>Miktar</th><th>Toplam</th></tr></thead>
            <tbody id="${prefix}BidsTableBody"><tr><td colspan="4">Yükleniyor...</td></tr></tbody>
          </table>
        </div>
      </div>
      <div class="order-book">
        <h3 class="asks">Satış Emirleri</h3>
        <div class="order-book-table-container">
          <table class="orderbook-table">
            <thead><tr><th>Fiyat</th><th>Sayaç</th><th>Miktar</th><th>Toplam</th></tr></thead>
            <tbody id="${prefix}AsksTableBody"><tr><td colspan="4">Yükleniyor...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  orderBooksContainer.appendChild(orderBookSection);

  fetchOrderBook(coinSymbol, prefix, minTotal);
  autoRefreshStates[prefix] = false;
  refreshIntervals[prefix] = null;
}

async function fetchOrderBook(pair, prefix, minTotal) {
  try {
    const response = await fetch(`https://api.exchange.coinbase.com/products/${pair}/book?level=2`);
    if (!response.ok) throw new Error(`API Hatası: ${response.status}`);
    const data = await response.json();
    if (!data || !data.bids || !data.asks) throw new Error('Geçersiz API verisi');

    updateOrderBook(data, prefix, minTotal);
    const now = new Date();
    document.getElementById(`${prefix}LastUpdate`).textContent = `Güncelleme: ${now.toLocaleTimeString()}`;
  } catch (error) {
    console.error(`Fetch hatası (${pair}):`, error);
    const errorHtml = `<tr><td colspan="4" class="text-center">${error.message}</td></tr>`;
    document.getElementById(`${prefix}AsksTableBody`).innerHTML = errorHtml;
    document.getElementById(`${prefix}BidsTableBody`).innerHTML = errorHtml;
  }
}

function updateOrderBook(data, prefix, minTotal) {
  if (!previousOrders[prefix]) {
    previousOrders[prefix] = { bids: new Map(), asks: new Map() };
    orderCounters[prefix] = { bids: new Map(), asks: new Map() };
  }

  const processOrders = (orders, type) => {
    return orders
      .filter(order => (parseFloat(order[0]) * parseFloat(order[1])) >= minTotal)
      .slice(0, 120)
      .map(order => {
        const price = parseFloat(order[0]);
        const size = parseFloat(order[1]);
        const total = price * size;
        const orderKey = price.toFixed(4);

        const previousSize = previousOrders[prefix][type].get(orderKey) || 0;
        previousOrders[prefix][type].set(orderKey, size);

        let counter = orderCounters[prefix][type].get(orderKey) || 0;
        if (size < previousSize) {
          if (counter >= 100) {
            addNotification(`${prefix.toUpperCase()} | Fiyat: ${orderKey} | Sayaç (${counter}) sıfırlandı.`);
          }
          counter = 0;
        } else if (size >= previousSize) {
          counter++;
        }
        orderCounters[prefix][type].set(orderKey, counter);

        return `<tr>
                  <td>${price.toFixed(4)}</td>
                  <td>${counter}</td>
                  <td>${size.toFixed(4)}</td>
                  <td>${total.toFixed(2)}</td>
                </tr>`;
      }).join('');
  };

  const bidsHtml = processOrders(data.bids, 'bids');
  document.getElementById(`${prefix}BidsTableBody`).innerHTML = bidsHtml || '<tr><td colspan="4">Emir yok</td></tr>';

  const asksHtml = processOrders(data.asks, 'asks');
  document.getElementById(`${prefix}AsksTableBody`).innerHTML = asksHtml || '<tr><td colspan="4">Emir yok</td></tr>';
}

function removeCoin(prefix) {
  clearInterval(refreshIntervals[prefix]);
  delete previousOrders[prefix];
  delete orderCounters[prefix];
  delete coinParams[prefix];
  const orderBookSection = document.getElementById(`${prefix}OrderBook`);
  if (orderBookSection) {
    orderBooksContainer.removeChild(orderBookSection);
  }
}

function toggleAutoRefresh(prefix) {
  const button = document.getElementById(`${prefix}AutoRefreshBtn`);
  const params = coinParams[prefix];

  if (autoRefreshStates[prefix]) {
    clearInterval(refreshIntervals[prefix]);
    button.textContent = "Oto. Yenile: KAPALI";
    autoRefreshStates[prefix] = false;
  } else {
    refreshIntervals[prefix] = setInterval(() => {
      fetchOrderBook(params.coinSymbol, prefix, params.minTotal);
    }, 5000);
    button.textContent = "Oto. Yenile: AÇIK";
    autoRefreshStates[prefix] = true;
  }
}

function addNotification(message) {
  const notificationsContainer = document.getElementById('notificationsContainer');
  const notification = document.createElement('div');
  notification.className = 'notification';
  const timeString = new Date().toLocaleTimeString();
  notification.innerHTML = `<div>${message}</div><div class="notification-time">${timeString}</div>`;
  notificationsContainer.insertBefore(notification, notificationsContainer.firstChild);
  while (notificationsContainer.children.length > 50) {
    notificationsContainer.removeChild(notificationsContainer.lastChild);
  }
}

window.addEventListener('beforeunload', () => {
  for (const intervalId in refreshIntervals) {
    clearInterval(refreshIntervals[intervalId]);
  }
}); 