const POS_DB = 'hungry-villains-register';
let registerDb;
let registerStatus = 'connecting';
let registerCatalog = null;
let registerSales = [];
let registerBusy = false;
let registerStorageError = '';

function openRegister() {
    if (!registerDb) {
        registerDb = new Promise((resolve, reject) => {
            const request = indexedDB.open(POS_DB, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore('catalog');
                request.result.createObjectStore('sales', { keyPath: 'sale_key' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return registerDb;
}

// Keep stock reservation and its receipt in the same local write transaction.
async function registerTransaction(mode, operation) {
    const db = await openRegister();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['catalog', 'sales'], mode);
        const catalog = tx.objectStore('catalog');
        const sales = tx.objectStore('sales');
        let result;
        let failure;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || tx.error || new Error('Register storage is unavailable.'));
        operation(catalog, sales, value => { result = value; }, error => {
            failure = error;
            tx.abort();
        });
    });
}

function availableItems(catalog, sales) {
    const reserved = new Map();
    for (const sale of sales) {
        if (sale.state === 'synced') continue;
        for (const line of sale.request.items) {
            reserved.set(line.id, (reserved.get(line.id) || 0) + line.quantity);
        }
    }
    return (catalog?.items || []).map(item => ({
        ...item,
        available_stock: Math.max(0, item.stock_quantity - (reserved.get(item.id) || 0))
    }));
}

async function refreshRegister() {
    if (!currentUser) return;
    const user = Number(currentUser.id);
    const [catalog, sales] = await registerTransaction('readonly', (catalog, sales, done) => {
        const snapshot = catalog.get('current');
        const journal = sales.getAll();
        journal.onsuccess = () => done([snapshot.result, journal.result]);
    });
    if (Number(currentUser?.id) !== user) return;
    registerCatalog = Number(catalog?.user_id) === user ? catalog : null;
    registerSales = sales;
    menuItems.splice(0, menuItems.length, ...availableItems(registerCatalog, sales));
    renderMenu();
    renderRegisterStatus();
}

async function saveLocalSale(sale) {
    return registerTransaction('readwrite', (catalog, sales, done, fail) => {
        const snapshot = catalog.get('current');
        const journal = sales.getAll();
        journal.onsuccess = () => {
            const current = snapshot.result;
            if (Number(current?.user_id) !== sale.user_id || sale.request.sold_at > current.expires_at
                || sale.request.sold_at > sale.request.issued_at + 12 * 3600) {
                fail(new Error('The catalog changed or expired. Refresh and review the cart.'));
                return;
            }
            const items = availableItems(current, journal.result);
            for (const line of sale.request.items) {
                const item = items.find(product => product.id === line.id);
                if (!item || item.available_stock < line.quantity || !item.is_available
                    || Math.round(item.price * 100) !== line.price_cents) {
                    fail(new Error('Stock changed. Review the quantities in your cart.'));
                    return;
                }
            }
            sales.add(sale);
            done(sale);
        };
    });
}

function registerNow() {
    if (!registerCatalog) return 0;
    return Math.floor(Date.now() / 1000) + registerCatalog.clock_offset;
}

function checkoutReady() {
    return !!(registerCatalog && registerNow() <= registerCatalog.expires_at
        && registerStatus !== 'signin' && !registerStorageError);
}

async function posFetch(url, options = {}) {
    return fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options,
        signal: AbortSignal.timeout(5000) });
}

async function storeSaleState(sale, state, message = '', orderId = null) {
    await registerTransaction('readwrite', (catalog, sales) => {
        const entry = sales.get(sale.sale_key);
        entry.onsuccess = () => {
            const stored = entry.result;
            if (!stored || stored.state === 'synced') return;
            sales.put({ ...stored, state, message, order_id: orderId });
            if (state !== 'synced') return;
            const snapshot = catalog.get('current');
            snapshot.onsuccess = () => {
                const current = snapshot.result;
                if (!current) return;
                for (const line of sale.request.items) {
                    const item = current.items.find(product => product.id === line.id);
                    if (item) item.stock_quantity = Math.max(0, item.stock_quantity - line.quantity);
                }
                catalog.put(current, 'current');
            };
        };
    });
}

async function synchronizeRegister() {
    if (!currentUser || registerBusy) return;
    registerBusy = true;
    const user = Number(currentUser.id);

    const sync = async () => {
        if (Number(currentUser?.id) !== user) return;
        await refreshRegister();
        try {
            const session = await posFetch('api/session.php');
            if ([401, 403].includes(session.status)) {
                registerStatus = 'signin';
                return;
            }
            if (!session.ok) throw new Error('Session unavailable.');
            const account = (await session.json()).user;
            if (Number(account?.id) !== user) {
                registerStatus = 'signin';
                return;
            }
            currentUser = account;
            registerStatus = 'online';

            const pending = registerSales
                .filter(sale => sale.user_id === user && sale.state === 'pending')
                .sort((a, b) => a.request.sold_at - b.request.sold_at || a.created - b.created);
            for (const sale of pending) {
                const response = await posFetch('api/place_order.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sale.request)
                });
                if ([401, 403].includes(response.status)) {
                    registerStatus = 'signin';
                    return;
                }
                if (!response.ok && ![409, 422].includes(response.status)) throw new Error('Sale sync unavailable.');
                const data = await response.json();
                if (response.ok && data.success && data.receipt_id === sale.sale_key) {
                    await storeSaleState(sale, 'synced', '', data.order_id);
                } else if ([409, 422].includes(response.status)) {
                    await storeSaleState(sale, 'review', data.message || 'Sale requires review.');
                } else {
                    throw new Error('Invalid sale response.');
                }
            }

            const response = await posFetch('api/get_items.php');
            if ([401, 403].includes(response.status)) {
                registerStatus = 'signin';
                return;
            }
            if (!response.ok) throw new Error('Catalog unavailable.');
            const snapshot = await response.json();
            if (!snapshot.success || Number(snapshot.user_id) !== user || !Array.isArray(snapshot.items)) {
                throw new Error('Invalid catalog response.');
            }
            snapshot.clock_offset = snapshot.issued_at - Math.floor(Date.now() / 1000);
            snapshot.items = snapshot.items.map(item => ({
                ...item, id: Number(item.id), price: Number(item.price),
                stock_quantity: Number(item.stock_quantity), is_available: Number(item.is_available)
            }));
            // Keep conflicting stock reserved. Other users' ambiguous uploads cannot
            // be verified with this account, so retain the conservative reservation.
            await registerTransaction('readwrite', (catalog) => catalog.put(snapshot, 'current'));
        } catch (error) {
            registerStatus = 'offline';
            console.warn('Register could not reach the server:', error.message);
        }
    };

    try {
        if (navigator.locks) await navigator.locks.request(POS_DB + '-sync', sync);
        else await sync();
        registerStorageError = '';
    } catch (error) {
        registerStorageError = 'Register storage is unavailable. Sales cannot be saved.';
        console.error(error);
    } finally {
        try {
            await refreshRegister();
        } catch (error) {
            registerStorageError = 'Register storage is unavailable. Sales cannot be saved.';
        }
        registerBusy = false;
        updateAdminUI();
        renderMenu();
        renderRegisterStatus();
        renderPayment();
        const digital = document.getElementById('payment-method');
        if (registerStatus !== 'online' && digital.value !== 'cash' && !checkoutInProgress) {
            digital.value = 'cash';
            updateCartUI();
        }
    }
}

function renderRegisterStatus() {
    const status = document.getElementById('connection-pill');
    status.dataset.state = registerStatus;
    status.textContent = { connecting: 'Connecting', online: 'Online', offline: 'Offline',
        signin: 'Sign-in required' }[registerStatus];

    const own = registerSales.filter(sale => sale.user_id === Number(currentUser?.id));
    const pending = own.filter(sale => sale.state === 'pending').length;
    const review = own.filter(sale => sale.state === 'review').length;
    const others = registerSales.filter(sale => sale.user_id !== Number(currentUser?.id) && sale.state !== 'synced').length;
    document.getElementById('queue-count').textContent = pending + review + others || '';
    document.getElementById('queue-summary').textContent =
        `${pending} pending · ${review} need review${others ? ` · ${others} from other accounts on this register` : ''}`;

    const notice = document.getElementById('register-notice');
    let message = registerStorageError;
    if (!message && registerStatus === 'signin') message = 'Sign out and sign in online to continue. This register keeps your pending sales.';
    if (!message && registerStatus === 'offline') {
        message = checkoutReady()
            ? 'Cash sales are saved on this register and sync when the server is reachable.'
            : 'Connect to the server to download or renew the catalog before taking sales.';
    }
    if (!message && registerStatus === 'online' && !checkoutReady()) message = 'Refreshing the register catalog…';
    notice.textContent = message;
    notice.hidden = !message;
    document.getElementById('complete-sale-button').disabled = !checkoutReady() || checkoutInProgress || !cart.length;

    const openReceipt = document.getElementById('receipt-modal');
    if (openReceipt.style.display === 'flex') {
        const latest = own.find(sale => sale.sale_key === openReceipt.dataset.receipt);
        if (latest) renderReceiptDetails(latest);
    }
    const list = document.getElementById('queue-list');
    list.innerHTML = own.sort((a, b) => (a.state === 'synced') - (b.state === 'synced') || b.created - a.created).slice(0, 100).map(sale => `
        <tr><td class="reference-cell">${escapeHtml(sale.sale_key)}</td>
        <td>${escapeHtml(formatSaleDate(sale.request.sold_at))}</td>
        <td>${money(sale.total)}</td>
        <td><span class="queue-state" data-state="${sale.state}">${{ pending: 'Pending', review: 'Needs review', synced: 'Synced' }[sale.state]}</span>
        ${sale.message ? `<div class="row-note">${escapeHtml(sale.message)}</div>` : ''}</td>
        <td><button type="button" class="btn-cancel" data-receipt="${sale.sale_key}">Receipt</button></td></tr>
    `).join('');
    document.getElementById('queue-empty').hidden = own.length > 0;
    document.getElementById('sync-now').disabled = registerBusy || registerStatus === 'signin';
}

async function retrySales() {
    if (!currentUser || registerBusy) return;
    const user = Number(currentUser.id);
    try {
        await registerTransaction('readwrite', (catalog, sales) => {
            const request = sales.getAll();
            request.onsuccess = () => {
                for (const sale of request.result) {
                    if (sale.user_id === user && sale.state === 'review') sales.put({ ...sale, state: 'pending', message: '' });
                }
            };
        });
        await synchronizeRegister();
    } catch (error) {
        registerStorageError = error.message;
        renderRegisterStatus();
    }
}
