let selectedCategory = '';
function renderMenu() {
    const query = document.getElementById('product-search').value.trim().toLowerCase();
    const products = menuItems.filter(item => adminMode || item.is_available);
    const categories = [...new Set(products.map(item => item.category || 'Other'))].sort();
    if (!categories.includes(selectedCategory)) selectedCategory = '';
    document.getElementById('category-filters').innerHTML = ['', ...categories].map(category => `
        <button type="button" data-category="${escapeHtml(category)}"
            aria-pressed="${category === selectedCategory}">${escapeHtml(category || 'All products')}</button>
    `).join('');

    const list = products.filter(item => (!selectedCategory || (item.category || 'Other') === selectedCategory)
        && `${item.name} ${item.sku || ''} ${item.description || ''}`.toLowerCase().includes(query));
    document.getElementById('results-count').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
    const container = document.getElementById('menu-container');
    container.innerHTML = list.map(item => {
        const unavailable = !item.is_available || item.available_stock < 1;
        const source = item.image_path || item.icon || '';
        const image = /^(?:https?:\/\/|(?:\.\/)?pictures\/)/i.test(source)
            ? `<img src="${escapeHtml(source)}" alt="" loading="lazy">`
            : '';
        const stock = !item.is_available ? 'Inactive' : unavailable ? 'Sold out' : `${item.available_stock} available`;
        const actions = adminMode
            ? `<div class="product-actions"><button class="btn-cancel" onclick="openEditModal(${item.id})">Edit</button>
              <button class="btn-cancel" onclick="deleteItem(${item.id})" ${item.is_available ? '' : 'disabled'}>Deactivate</button></div>`
            : `<button class="add-product" onclick="addToCart(${item.id})" aria-label="Add ${escapeHtml(item.name)}"
              ${unavailable ? 'disabled' : ''}>+</button>`;

        return `<article class="catalog-card">
            <div class="product-photo">${image}<span>${escapeHtml(item.category || 'Other')}</span></div>
            <div class="product-info">
                <div class="product-heading"><h3>${escapeHtml(item.name)}</h3>
                    <span class="stock-pill" data-low="${item.available_stock <= 5}">${stock}</span></div>
                <p>${escapeHtml(item.sku || '')}</p>
                <div class="product-bottom"><strong>${money(Math.round(item.price * 100))}</strong>${actions}</div>
            </div>
        </article>`;
    }).join('');

    if (adminMode) container.insertAdjacentHTML('beforeend',
        '<button type="button" class="add-item-card" onclick="openAddModal()">+ Add product</button>');
    if (!list.length && !adminMode) {
        container.innerHTML = `<div class="empty-products">${products.length ? 'No products match your search.' : 'No catalog available.'}</div>`;
    }
}

async function deleteItem(id) {
    if (registerStatus !== 'online' || !confirm('Deactivate this product?')) return;
    try {
        const response = await posFetch('api/delete_item.php', {method: 'POST',
            headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id})});
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        await synchronizeRegister();
    } catch (error) {
        alert(error.message || 'Could not deactivate the product.');
    }
}

function addToCart(id) {
    if (checkoutInProgress || !checkoutReady()) return;
    const item = menuItems.find(product => product.id === id && product.is_available);
    if (!item || !item.available_stock) return;
    const inCart = cart.filter(product => product.id === id);
    if (inCart.length >= Math.min(item.available_stock, 999)) return alert('Available quantity reached.');
    if (inCart.some(product => product.price !== item.price)) return alert('The price changed. Remove this item before adding it again.');
    cart.push(item);
    updateCartUI();
}

function removeItemFromCart(id) {
    if (checkoutInProgress) return;
    const index = cart.findIndex(item => item.id === id);
    if (index !== -1) cart.splice(index, 1);
    updateCartUI();
}

function renderPayment() {
    const method = document.getElementById('payment-method');
    for (const option of method.options) {
        option.disabled = option.value !== 'cash' && registerStatus !== 'online';
    }
    const isCash = method.value === 'cash';
    document.getElementById('cash-fields').hidden = !isCash;
    document.getElementById('reference-field').hidden = isCash;
    const change = Math.max(0, (inputCents('amount-tendered') || 0) - cartTotals().total);
    document.getElementById('change-preview').textContent = money(change);
    const total = money(cartTotals().total);
    document.getElementById('cart-total').textContent = total;
    document.getElementById('mobile-cart-total').textContent = total;
    document.getElementById('cart-subtotal').textContent = money(cartTotals().subtotal);
}

function updateCartUI() {
    document.getElementById('cart-count').textContent = cart.length;
    document.getElementById('mobile-cart-count').textContent = cart.length;
    const groups = new Map();
    for (const item of cart) {
        const group = groups.get(item.id) || { item, quantity: 0 };
        group.quantity++;
        groups.set(item.id, group);
    }

    document.getElementById('cart-items-container').innerHTML = groups.size ? [...groups.values()].map(({item, quantity}) => `
        <div class="cart-line">
            <div><strong>${escapeHtml(item.name)}</strong><small>${money(Math.round(item.price * 100))} each</small></div>
            <div class="quantity">
                <button type="button" onclick="removeItemFromCart(${item.id})" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
                <span>${quantity}</span>
                <button type="button" onclick="addToCart(${item.id})" aria-label="Add one ${escapeHtml(item.name)}">+</button>
            </div>
            <strong>${money(Math.round(item.price * 100) * quantity)}</strong>
        </div>`).join('') : '<div class="empty-cart"><strong>Cart is empty</strong><p>Select a product to start a sale.</p></div>';
    document.getElementById('clear-cart').disabled = !groups.size || checkoutInProgress;
    renderPayment();
    renderRegisterStatus();
}

function closeModal(id) {
    if (id === 'checkout-confirmation-modal') pendingCheckout = null;
    document.getElementById(id).style.display = 'none';
}
