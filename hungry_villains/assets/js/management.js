function updateAdminUI() {
    const adminToggle = document.getElementById('admin-toggle-btn');
    const usersAdminButton = document.getElementById('users-admin-button');
    const ordersAdminButton = document.getElementById('orders-admin-button');
    const transactionHistoryButton = document.getElementById('transaction-history-button');
    const reportsAdminButton = document.getElementById('reports-admin-button');
    const inventoryAdminButton = document.getElementById('inventory-admin-button');
    if(!adminToggle || !usersAdminButton || !ordersAdminButton || !transactionHistoryButton || !reportsAdminButton || !inventoryAdminButton) return;

    const isAdmin = registerStatus === 'online' && currentUser && Number(currentUser.is_admin) === 1;
    const hasCashierAccess = registerStatus === 'online' && currentUser && (isAdmin || Number(currentUser.is_cashier) === 1);
    if (isAdmin) {
        usersAdminButton.style.display = 'inline-flex';
        adminToggle.style.display = 'inline-block';
        adminMode = sessionStorage.getItem('adminMode') === '1';
        adminToggle.lastChild.textContent = adminMode ? ' Editing menu' : ' Manage menu';
    } else {
        usersAdminButton.style.display = 'none';
        adminToggle.style.display = 'none';
        adminMode = false;
    }
    ordersAdminButton.style.display = hasCashierAccess ? 'inline-block' : 'none';
    transactionHistoryButton.style.display = hasCashierAccess ? 'inline-block' : 'none';
    reportsAdminButton.style.display = isAdmin ? 'inline-block' : 'none';
    inventoryAdminButton.style.display = isAdmin ? 'inline-block' : 'none';
}

function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function setUsersAdminStatus(message, isError = false) {
    const status = document.getElementById('users-admin-status');
    status.textContent = message;
    status.classList.toggle('error', isError);
}

function loadManagedUsers() {
    setUsersAdminStatus('Loading users...');
    fetch('api/admin_users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'list' })
    })
    .then(response => response.json().then(data => ({ response, data })))
    .then(({ response, data }) => {
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load users.');
        managedUsers = data.users;
        renderManagedUsers();
        setUsersAdminStatus(`${managedUsers.length} user${managedUsers.length === 1 ? '' : 's'} found.`);
    })
    .catch(error => {
        console.error('User list error:', error);
        setUsersAdminStatus(error.message || 'Unable to load users.', true);
    });
}

function renderManagedUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = managedUsers.map(user => {
        const isCurrentUser = Number(user.id) === Number(currentUser.id);
        const actions = `<button type="button" class="btn-primary user-action" data-action="edit" data-user-id="${Number(user.id)}">Edit</button>
            ${isCurrentUser ? '' : Number(user.has_orders) === 1
                ? '<button type="button" class="btn-cancel user-action" disabled title="Users with order history cannot be deleted">Has order history</button>'
                : `<button type="button" class="btn-cancel user-action" data-action="delete" data-user-id="${Number(user.id)}">Delete</button>`}`;
        return `<tr>
            <td>${escapeHtml(user.username)}${isCurrentUser ? ' (you)' : ''}</td>
            <td>${Number(user.is_cashier) === 1 ? 'Yes' : 'No'}</td>
            <td>${Number(user.is_admin) === 1 ? 'Yes' : 'No'}</td>
            <td>${escapeHtml(user.created_at)}</td>
            <td class="user-actions">${actions}</td>
        </tr>`;
    }).join('');
}

function loadTransactionHistory() {
    const status = document.getElementById('transaction-history-status');
    const tableBody = document.getElementById('transaction-history-body');
    status.textContent = 'Loading transactions...';
    tableBody.innerHTML = '';

    fetch('api/transaction_history.php', { credentials: 'same-origin' })
        .then(response => response.json().then(data => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to load transaction history.');
            }
            renderTransactionHistory(data.transactions);
        })
        .catch(error => {
            console.error('Transaction history error:', error);
            status.textContent = error.message || 'Unable to load transaction history.';
            status.classList.add('error');
        });
}

function renderTransactionHistory(transactions) {
    const status = document.getElementById('transaction-history-status');
    const tableBody = document.getElementById('transaction-history-body');
    if (!Array.isArray(transactions)) {
        status.textContent = 'The server returned invalid transaction history.';
        status.classList.add('error');
        return;
    }

    status.classList.remove('error');
    if (transactions.length === 0) {
        status.textContent = 'No transactions have been recorded.';
        return;
    }

    historyReceipts = new Map();
    tableBody.innerHTML = transactions.map(transaction => {
        if (transaction.receipt_id && transaction.payment_method) historyReceipts.set(Number(transaction.id), transaction);
        const items = Array.isArray(transaction.items)
            ? transaction.items.map(item => {
                const quantity = Number(item.quantity);
                const name = escapeHtml(item.name);
                return `${name}${Number.isInteger(quantity) && quantity > 1 ? ` × ${quantity}` : ''}`;
            }).join(', ')
            : 'Item details unavailable';
        const total = Number(transaction.total_price);
        const formattedTotal = Number.isFinite(total) ? `₱${total.toFixed(2)}` : '—';
        const formattedDate = formatSaleDate(Number(transaction.sale_timestamp));
        return `<tr>
            <td class="reference-cell">${transaction.receipt_id ? escapeHtml(transaction.receipt_id) : `#${Number(transaction.id)}`}</td>
            <td>${formattedDate}</td>
            <td>${escapeHtml(transaction.username)}</td>
            <td>${items}</td>
            <td>${formattedTotal}</td>
            <td>${escapeHtml({cash: 'Cash', ewallet: 'E-wallet', card: 'Card'}[transaction.payment_method] || '—')}</td>
            <td>${escapeHtml(transaction.status)}</td>
            <td class="history-actions">
                ${historyReceipts.has(Number(transaction.id)) ? `<button type="button" class="btn-cancel" data-history-receipt="${Number(transaction.id)}">Receipt</button>` : ''}
                ${transaction.status === 'Completed' ? '' : `<button class="btn-primary" style="width:auto;" onclick="updateOrderStatus(${Number(transaction.id)})">Mark completed</button>`}
            </td>
        </tr>`;
    }).join('');
    status.textContent = `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} found.`;
}

function printHistoryReceipt(id) {
    const transaction = historyReceipts.get(id);
    if (!transaction || registerStatus !== 'online') return;
    showReceipt({
        sale_key: transaction.receipt_id, state: 'synced',
        request: { sold_at: Number(transaction.sale_timestamp) },
        lines: transaction.items.map(item => ({ ...item, price_cents: Math.round(Number(item.price) * 100) })),
        total: Math.round(Number(transaction.total_price) * 100),
        amount: Number(transaction.tendered_cents), method: transaction.payment_method,
        subtotal: Number(transaction.subtotal_cents), discount: Number(transaction.discount_cents)
    });
}

function initializeReportDates() {
    const startDate = document.getElementById('reports-start-date');
    const endDate = document.getElementById('reports-end-date');
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric',
        month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
    startDate.value = `${date.year}-${date.month}-01`;
    endDate.value = `${date.year}-${date.month}-${date.day}`;
}

function loadSalesReport() {
    const status = document.getElementById('reports-status');
    const startDate = document.getElementById('reports-start-date').value;
    const endDate = document.getElementById('reports-end-date').value;
    status.textContent = 'Loading sales report...';
    status.classList.remove('error');

    const query = new URLSearchParams({ start_date: startDate, end_date: endDate });
    fetch(`api/reports.php?${query}`, { credentials: 'same-origin' })
        .then(response => response.json().then(data => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to load sales report.');
            }
            renderSalesReport(data);
        })
        .catch(error => {
            console.error('Sales report error:', error);
            status.textContent = error.message || 'Unable to load sales report.';
            status.classList.add('error');
        });
}

function renderSalesReport(report) {
    const totals = report.totals;
    const status = document.getElementById('reports-status');
    const summary = document.getElementById('reports-summary');
    const dailyBody = document.getElementById('reports-daily-body');
    const productsBody = document.getElementById('reports-products-body');
    const formatCurrency = amount => `₱${Number(amount).toFixed(2)}`;

    summary.innerHTML = `
        <article class="report-card"><span>Net sales</span><strong>${formatCurrency(totals.gross_sales)}</strong></article>
        <article class="report-card"><span>Completed Sales</span><strong>${formatCurrency(totals.completed_sales)}</strong></article>
        <article class="report-card"><span>Open Sales</span><strong>${formatCurrency(totals.open_sales)}</strong></article>
        <article class="report-card"><span>Transactions</span><strong>${Number(totals.transaction_count)}</strong></article>
        <article class="report-card"><span>Completed / Open</span><strong>${Number(totals.completed_count)} / ${Number(totals.open_count)}</strong></article>
        <article class="report-card"><span>Items Sold</span><strong>${Number(totals.items_sold)}</strong></article>`;

    dailyBody.innerHTML = report.daily_sales.length
        ? report.daily_sales.map(day => `<tr>
            <td>${escapeHtml(day.date)}</td>
            <td>${Number(day.transactions)}</td>
            <td>${formatCurrency(day.sales)}</td>
        </tr>`).join('')
        : '<tr><td colspan="3">No sales in this date range.</td></tr>';

    productsBody.innerHTML = report.product_sales.length
        ? report.product_sales.map(product => `<tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${Number(product.quantity)}</td>
            <td>${formatCurrency(product.sales)}</td>
        </tr>`).join('')
        : '<tr><td colspan="3">No products sold in this date range.</td></tr>';

    status.textContent = `Report for ${report.start_date} through ${report.end_date}.`;
}

function loadInventory() {
    const status = document.getElementById('inventory-status');
    const tableBody = document.getElementById('inventory-table-body');
    status.textContent = 'Loading inventory...';
    status.classList.remove('error');
    tableBody.innerHTML = '';

    fetch('api/inventory.php', { credentials: 'same-origin' })
        .then(response => response.json().then(data => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.success || !Array.isArray(data.products)) {
                throw new Error(data.message || 'Unable to load inventory.');
            }
            renderInventory(data.products);
        })
        .catch(error => {
            console.error('Inventory error:', error);
            status.textContent = error.message || 'Unable to load inventory.';
            status.classList.add('error');
        });
}

function renderInventory(products) {
    const status = document.getElementById('inventory-status');
    const tableBody = document.getElementById('inventory-table-body');
    tableBody.innerHTML = products.length
        ? products.map(product => {
            const quantity = Number(product.quantity);
            const productStatus = String(product.status || 'Inactive');
            const availability = productStatus !== 'Active'
                ? 'Inactive'
                : quantity <= 0 ? 'Out of stock' : 'In stock';
            const image = product.image_path || product.icon || '';
            return `<tr>
                <td>${escapeHtml(product.product_code)}</td>
                <td>${escapeHtml(product.product_name)}</td>
                <td>${escapeHtml(product.category || '—')}</td>
                <td>₱${Number(product.price).toFixed(2)}</td>
                <td>${Number.isFinite(quantity) ? quantity : '—'}</td>
                <td><span class="inventory-status-badge ${availability === 'In stock' ? 'in-stock' : 'out-of-stock'}">${availability}</span></td>
                <td>${escapeHtml(product.description || '—')}</td>
                <td>${image ? `<span title="${escapeHtml(image)}">${escapeHtml(image.split('/').pop())}</span>` : '—'}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="8">No products in inventory.</td></tr>';
    status.classList.remove('error');
    status.textContent = `${products.length} product${products.length === 1 ? '' : 's'} in inventory.`;
}

function submitUserChange(payload, form) {
    setUsersAdminStatus(payload.action === 'create' ? 'Creating user...' : 'Saving user...');
    fetch('api/admin_users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
    })
    .then(response => response.json().then(data => ({ response, data })))
    .then(({ response, data }) => {
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save user.');
        if (form) form.reset();
        closeModal('user-editor-modal');
        setUsersAdminStatus(data.message);
        loadManagedUsers();
    })
    .catch(error => {
        console.error('User save error:', error);
        setUsersAdminStatus(error.message || 'Unable to save user.', true);
    });
}

function openUserEditor(user) {
    const isCurrentUser = Number(user.id) === Number(currentUser.id);
    document.getElementById('user-editor-title').textContent = `Edit ${user.username}`;
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-username').value = user.username;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-cashier').checked = Number(user.is_cashier) === 1;
    document.getElementById('edit-user-admin').checked = Number(user.is_admin) === 1;
    document.getElementById('edit-user-admin').disabled = isCurrentUser;
    document.getElementById('user-editor-modal').style.display = 'flex';
}

function deleteManagedUser(user) {
    if (!confirm(`Delete ${user.username}? Accounts with order history cannot be deleted.`)) return;
    setUsersAdminStatus(`Deleting ${user.username}...`);
    fetch('api/admin_users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'delete', id: Number(user.id) })
    })
    .then(response => response.json().then(data => ({ response, data })))
    .then(({ response, data }) => {
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to delete user.');
        setUsersAdminStatus(data.message);
        loadManagedUsers();
    })
    .catch(error => {
        console.error('User delete error:', error);
        setUsersAdminStatus(error.message || 'Unable to delete user.', true);
    });
}

// --- PANGUNAHING SAFETY BOX ---
