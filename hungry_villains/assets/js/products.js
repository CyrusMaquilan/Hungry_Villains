function openAddModal() {
    if (registerStatus !== 'online') return;
    document.getElementById('new-category').value = '';
    document.getElementById('new-id').value = '';
    document.getElementById('new-name').value = '';
    document.getElementById('new-price').value = '';
    document.getElementById('new-stock').value = '';
    document.getElementById('new-availability').value = '1';
    document.getElementById('new-icon').value = '';
    document.getElementById('new-image').value = '';
    document.getElementById('new-description').value = '';
    
    const title = document.querySelector('#add-modal h3');
    if(title) title.innerText = "Add New Menu Item";
    
    document.getElementById('add-modal').style.display = 'flex';
}

// 2. Modal Function: I-edit ang Umiiral na Item
function openEditModal(id) {
    const item = menuItems.find(m => m.id === id);
    if (!item) return;
    document.getElementById('new-id').value = item.id;
    document.getElementById('new-name').value = item.name;
    document.getElementById('new-price').value = item.price;
    document.getElementById('new-category').value = item.category || '';
    document.getElementById('expected-stock').value = item.stock_quantity;
    document.getElementById('new-stock').value = item.stock_quantity;
    document.getElementById('new-availability').value = item.is_available;
    document.getElementById('new-icon').value = item.icon;
    document.getElementById('new-image').value = '';
    document.getElementById('new-description').value = item.description || '';

    const title = document.querySelector('#add-modal h3');
    if(title) title.innerText = "Edit Menu Item";

    document.getElementById('add-modal').style.display = 'flex';
}

// Mark an open sale as completed.
function updateOrderStatus(orderId) {
    if(!confirm("Mark Sale #" + orderId + " as completed?")) return;
    fetch('api/update_order_status.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ order_id: orderId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            loadOpenSales();
            if (document.getElementById('transactions-view').style.display === 'block') {
                loadTransactionHistory();
            }
        } else { alert("Error: " + data.message); }
    });
}

// Load sales that still need to be completed.
function loadOpenSales() {
    fetch('api/get_all_orders.php', { credentials: 'same-origin' })
        .then(response => response.json().then(data => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load open sales.');
            renderOpenSales(data.orders);
        })
        .catch(error => {
            console.error('Open sales error:', error);
            document.getElementById('admin-orders-list').textContent = error.message || 'Unable to load open sales.';
        });
}

function renderOpenSales(orders) {
    const container = document.getElementById('admin-orders-list'); 
    if (!orders.length) { container.innerHTML = "<p>No open sales.</p>"; return; }
    container.innerHTML = orders.map(order => {
        let items;
        try {
            items = JSON.parse(order.items);
        } catch (error) {
            console.error(`Invalid item details for sale #${order.id}:`, error);
            items = null;
        }
        const validItems = Array.isArray(items)
            ? items.filter(item => item && typeof item === 'object')
            : [];
        const receiptItems = validItems.length
            ? validItems.map(item => {
                const quantity = Number(item.quantity);
                const price = Number(item.price);
                const validQuantity = Number.isInteger(quantity) && quantity > 0;
                const validPrice = Number.isFinite(price) && price >= 0;
                const subtotal = validQuantity && validPrice ? `₱${(quantity * price).toFixed(2)}` : '—';
                return `<tr>
                    <td>${escapeHtml(item.name || 'Item')}</td>
                    <td>${validQuantity ? quantity : '—'}</td>
                    <td>${validPrice ? `₱${price.toFixed(2)}` : '—'}</td>
                    <td>${subtotal}</td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="4">Receipt item details unavailable.</td></tr>';
        const total = Number(order.total_price);
        const formattedTotal = Number.isFinite(total) ? `₱${total.toFixed(2)}` : '—';
        const createdAt = new Date(order.created_at);
        const formattedDate = Number.isNaN(createdAt.getTime())
            ? escapeHtml(order.created_at || 'Date unavailable')
            : escapeHtml(createdAt.toLocaleString());
        return `
            <div class="food-card sale-card">
                <h4>Sale #${Number(order.id)} <span class="sale-card-cashier">Recorded by: ${escapeHtml(order.username)}</span></h4>
                <p class="sale-card-meta"><strong>Date:</strong> ${formattedDate} <span><strong>Status:</strong> ${escapeHtml(order.status || 'Pending')}</span></p>
                <div class="sale-receipt" aria-label="Receipt details for sale #${Number(order.id)}">
                    <h5>Receipt Summary</h5>
                    <table>
                        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
                        <tbody>${receiptItems}</tbody>
                    </table>
                    <p class="sale-receipt-total"><strong>Total</strong><strong>${formattedTotal}</strong></p>
                </div>
                <button class="btn-primary" style="width: auto;" onclick="updateOrderStatus(${Number(order.id)})">Mark Completed</button>
            </div>`;
    }).join('');
}

// 6. Admin Function: I-submit ang Produkto (Magdagdag o Mag-edit)
async function handleAdminSubmit(e) {
    if (registerStatus !== 'online' || !currentUser || Number(currentUser.is_admin) !== 1) return alert('Online admin access required.');

    const imageFile = document.getElementById('new-image').files[0];
    const icon = document.getElementById('new-icon').value.trim();

    let localImage = null;
    try {
        if (imageFile) localImage = await readProductImage(imageFile);
    } catch (error) {
        alert(error.message);
        return;
    }

    const bodyData = {
        id: document.getElementById('new-id').value ? Number(document.getElementById('new-id').value) : null,
        name: document.getElementById('new-name').value,
        price: Number(document.getElementById('new-price').value),
        category: document.getElementById('new-category').value.trim(),
        expected_stock: Number(document.getElementById('expected-stock').value),
        stock_quantity: Number(document.getElementById('new-stock').value), // Kunin ang stock mula sa input
        is_available: Number(document.getElementById('new-availability').value), // Kunin ang availability mula sa dropdown
        icon: icon || '🍔',
        description: document.getElementById('new-description').value,
        image_data: localImage
    };

    const url = bodyData.id ? 'api/update_item.php' : 'api/add_item.php';
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Unable to save the product.');
        }

        const itemId = bodyData.id || Number(data.id);
        const message = 'Item Saved!';
        if (localImage) {
            try {
                localStorage.removeItem(`${PRODUCT_IMAGE_STORAGE_PREFIX}${itemId}`);
            } catch (error) {
                console.error('Unable to clear the browser-cached product image:', error);
            }
        }
        await loadMenuFromServer();
        alert(message);
        closeModal('add-modal');
    } catch (error) {
        console.error('Product save error:', error);
        alert(error.message || 'Unable to save the product. Please try again.');
    }
}

// 7. Core Function: I-load ang mga Item mula sa Database
