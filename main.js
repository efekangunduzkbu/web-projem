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
  const apiSelector = document.getElementById('apiSelector');
  const coinSymbol = coinInput.value.trim().toUpperCase();
  if (!coinSymbol) return;

  const selectedApi = apiSelector.value;
  const prefix = `${selectedApi}-${coinSymbol.split('-')[0].toLowerCase()}`;
  const minTotal = parseFloat(document.getElementById('minTotalInput').value) || 0;

  coinParams[prefix] = {
    api: selectedApi,
    coinSymbol,
    minTotal,
    displayCountBids: 50, // Initial display count
    displayCountAsks: 50,
    fullBids: [],
    fullAsks: []
  };

  if (document.getElementById(`${prefix}OrderBook`)) {
    alert(`${coinSymbol} zaten ekli.`);
    return;
  }

  const orderBookSection = document.createElement('div');
  orderBookSection.id = `${prefix}OrderBook`;
  orderBookSection.className = 'order-book-section';
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
            <thead><tr><th>Fiyat</th><th>S</th><th>Miktar</th><th>Toplam</th></tr></thead>
            <tbody id="${prefix}BidsTableBody"><tr><td colspan="4">Yükleniyor...</td></tr></tbody>
            <tfoot><tr><td colspan="4"><button class="btn-more" id="${prefix}BidsMoreBtn" onclick="showMore('${prefix}', 'bids')">Daha Fazla</button></td></tr></tfoot>
          </table>
        </div>
      </div>
      <div class="order-book">
        <h3 class="asks">Satış Emirleri</h3>
        <div class="order-book-table-container">
          <table class="orderbook-table">
            <thead><tr><th>Fiyat</th><th>S</th><th>Miktar</th><th>Toplam</th></tr></thead>
            <tbody id="${prefix}AsksTableBody"><tr><td colspan="4">Yükleniyor...</td></tr></tbody>
            <tfoot><tr><td colspan="4"><button class="btn-more" id="${prefix}AsksMoreBtn" onclick="showMore('${prefix}', 'asks')">Daha Fazla</button></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  `;
  orderBooksContainer.appendChild(orderBookSection);
  makeDraggable(orderBookSection);

  fetchOrderBook(prefix, true);
  autoRefreshStates[prefix] = false;
  refreshIntervals[prefix] = null;
}

async function fetchOrderBook(prefix, resetDisplayCount = false) {
  const params = coinParams[prefix];
  if (!params) return;

  const { api, coinSymbol, minTotal } = params;
  let url;

  try {
    if (api === 'binance') {
      const formattedPair = coinSymbol.replace('-', '').replace('/', ''); // BTC-USD -> BTCUSDT
      url = `https://api.binance.us/api/v3/depth?symbol=${formattedPair}&limit=1000`;
    } else { // Default to Coinbase
      url = `https://api.exchange.coinbase.com/products/${coinSymbol}/book?level=2`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`API Hatası: ${response.status}`);
    const data = await response.json();

    if (!data || !data.bids || !data.asks) throw new Error('Geçersiz API verisi');

    // Store the full data
    params.fullBids = data.bids;
    params.fullAsks = data.asks;

    if (resetDisplayCount) {
      params.displayCountBids = 50;
      params.displayCountAsks = 50;
    }

    updateOrderBook(prefix);
    const now = new Date();
    document.getElementById(`${prefix}LastUpdate`).textContent = `Güncelleme: ${now.toLocaleTimeString()}`;

  } catch (error) {
    console.error(`Fetch hatası (${coinSymbol}):`, error);
    const errorHtml = `<tr><td colspan="4" class="text-center">${error.message}</td></tr>`;
    const asksBody = document.getElementById(`${prefix}AsksTableBody`);
    const bidsBody = document.getElementById(`${prefix}BidsTableBody`);
    if (asksBody) asksBody.innerHTML = errorHtml;
    if (bidsBody) bidsBody.innerHTML = errorHtml;
  }
}

function updateOrderBook(prefix) {
  const params = coinParams[prefix];
  if (!params) return;

  if (!previousOrders[prefix]) {
    previousOrders[prefix] = { bids: new Map(), asks: new Map() };
    orderCounters[prefix] = { bids: new Map(), asks: new Map() };
  }

  renderTable(prefix, 'bids');
  renderTable(prefix, 'asks');
}

function renderTable(prefix, type) {
  const params = coinParams[prefix];
  if (!params) return;

  const { minTotal } = params;
  const tableBodyId = type === 'bids' ? `${prefix}BidsTableBody` : `${prefix}AsksTableBody`;
  const moreBtnId = type === 'bids' ? `${prefix}BidsMoreBtn` : `${prefix}AsksMoreBtn`;
  const tableBody = document.getElementById(tableBodyId);
  const moreBtn = document.getElementById(moreBtnId);

  const orders = type === 'bids' ? params.fullBids : params.fullAsks;
  const displayCount = type === 'bids' ? params.displayCountBids : params.displayCountAsks;

  if (!orders) return;

  const html = orders
    .filter(order => (parseFloat(order[0]) * parseFloat(order[1])) >= minTotal)
    .slice(0, displayCount)
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
                <td>${size.toFixed(1)}</td>
                <td>${total.toFixed(0)}</td>
              </tr>`;
    }).join('');

  tableBody.innerHTML = html || `<tr><td colspan="4">Emir yok</td></tr>`;

  // Show/hide the 'More' button
  if (displayCount >= orders.filter(order => (parseFloat(order[0]) * parseFloat(order[1])) >= minTotal).length) {
    moreBtn.style.display = 'none';
  } else {
    moreBtn.style.display = 'block';
  }
}

function showMore(prefix, type) {
  const params = coinParams[prefix];
  if (!params) return;

  if (type === 'bids') {
    params.displayCountBids += 50;
  } else {
    params.displayCountAsks += 50;
  }
  renderTable(prefix, type);
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
  if (!params) return;

  if (autoRefreshStates[prefix]) {
    clearInterval(refreshIntervals[prefix]);
    button.textContent = "Oto. Yenile: KAPALI";
    autoRefreshStates[prefix] = false;
  } else {
    refreshIntervals[prefix] = setInterval(() => {
      fetchOrderBook(prefix, false);
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

function makeDraggable(element) {
  const dragHandle = element.querySelector('h2');
  let isDragging = false;
  let currentTranslateX = 0;
  let currentTranslateY = 0;
  let initialMouseX = 0;
  let initialMouseY = 0;

  dragHandle.addEventListener('mousedown', function (e) {
    e.preventDefault();
    const style = window.getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform);
    currentTranslateX = matrix.m41;
    currentTranslateY = matrix.m42;
    initialMouseX = e.clientX;
    initialMouseY = e.clientY;
    isDragging = true;
    element.classList.add('dragging');
    document.body.classList.add('drag-active');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - initialMouseX;
    const dy = e.clientY - initialMouseY;
    const newTranslateX = currentTranslateX + dx;
    const newTranslateY = currentTranslateY + dy;
    element.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`;
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    element.classList.remove('dragging');
    document.body.classList.remove('drag-active');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

window.addEventListener('beforeunload', () => {
  for (const intervalId in refreshIntervals) {
    clearInterval(refreshIntervals[intervalId]);
  }
}); 