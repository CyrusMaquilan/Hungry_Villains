const phpCurrency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function money(cents) {
    return phpCurrency.format(cents / 100);
}

function formatSaleDate(seconds) {
    return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'
    }).format(seconds * 1000);
}

function inputCents(field) {
    const value = document.getElementById(field).value.trim();
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return null;
    return Math.round(Number(value) * 100);
}

function cartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + Math.round(item.price * 100), 0);
    const discount = inputCents('discount-amount') ?? 0;
    return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}

function checkout() {
    if (checkoutInProgress || !cart.length || !checkoutReady()) return;
    const { subtotal, discount, total } = cartTotals();
    const method = document.getElementById('payment-method').value;
    const reference = document.getElementById('payment-reference').value.trim();
    const reason = document.getElementById('discount-reason').value.trim();
    const amount = method === 'cash' ? inputCents('amount-tendered') : total;
    const invalidDiscount = document.getElementById('discount-amount').value.trim() && inputCents('discount-amount') === null;
    if (invalidDiscount || subtotal > 9999999999 || discount > subtotal || (discount && !reason)) {
        return alert('The discount must be within the subtotal and include a reason.');
    }
    if (amount === null || amount < total) return alert('Enter the cash received. It must cover the total.');
    if (method !== 'cash' && (registerStatus !== 'online' || !reference)) {
        return alert('Confirm the payment on your terminal or app, then enter its reference while online.');
    }

    const items = new Map();
    for (const entry of cart) {
        const item = menuItems.find(product => product.id === entry.id);
        if (!item || !item.is_available || item.price !== entry.price) {
            return alert('A product price or availability changed. Remove the product and add it again.');
        }
        const existing = items.get(item.id);
        const quantity = (existing?.quantity || 0) + 1;
        if (quantity > item.available_stock) return alert('Available stock changed. Review the cart quantities.');
        items.set(item.id, { id: item.id, name: item.name, quantity,
            price_cents: Math.round(item.price * 100), quote: item.quote });
    }
    if (items.size > 100) return alert('A single sale can contain up to 100 different products.');
    const lines = [...items.values()];
    pendingCheckout = { subtotal, discount, total, amount, method, reference, reason, lines,
        issued_at: registerCatalog.issued_at };
    document.getElementById('checkout-confirmation-items').innerHTML = lines.map(item =>
        `<li><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${money(item.price_cents * item.quantity)}</strong></li>`
    ).join('');
    document.getElementById('checkout-confirmation-totals').innerHTML = receiptTotals(pendingCheckout);
    document.getElementById('checkout-confirmation-modal').style.display = 'flex';
    document.getElementById('confirm-checkout-button').focus();
}

async function confirmCheckout() {
    if (!pendingCheckout || checkoutInProgress) return;
    const details = pendingCheckout;
    if (!checkoutReady() || (details.method !== 'cash' && registerStatus !== 'online')) {
        closeModal('checkout-confirmation-modal');
        return alert('Register status changed. Review the sale again.');
    }
    checkoutInProgress = true;
    closeModal('checkout-confirmation-modal');
    renderRegisterStatus();
    try {
        const sale_key = crypto.randomUUID();
        const user_id = Number(currentUser.id);
        const sale = {
            ...details, sale_key, user_id, state: 'pending', created: Date.now(),
            request: { sale_key, user_id, sold_at: registerNow(), issued_at: details.issued_at,
                items: details.lines.map(({ name, ...line }) => line),
                amount_cents: details.amount, discount_cents: details.discount,
                discount_reason: details.reason, method: details.method, reference: details.reference,
                offline: registerStatus !== 'online' }
        };
        await saveLocalSale(sale);
        cart = [];
        for (const id of ['amount-tendered', 'discount-amount', 'discount-reason', 'payment-reference']) {
            document.getElementById(id).value = '';
        }
        document.getElementById('payment-method').value = 'cash';
        updateCartUI();
        showReceipt(sale);
        try {
            await refreshRegister();
        } catch (error) {
            registerStorageError = 'Sale saved. The register could not refresh its stock display.';
        }
        if (registerStatus === 'online') {
            synchronizeRegister().then(() => {
                const latest = registerSales.find(entry => entry.sale_key === sale.sale_key);
                if (document.getElementById('receipt-modal').dataset.receipt === sale.sale_key && latest) {
                    renderReceiptDetails(latest);
                }
            });
        }
    } catch (error) {
        alert(error.message || 'Sale could not be saved.');
    } finally {
        checkoutInProgress = false;
        renderRegisterStatus();
    }
}

function receiptTotals(sale) {
    const method = { cash: 'Cash', ewallet: 'E-wallet', card: 'Card' }[sale.method];
    return `
        ${sale.discount ? `<p><span>Subtotal</span><strong>${money(sale.subtotal)}</strong></p>
        <p><span>Discount</span><strong>−${money(sale.discount)}</strong></p>` : ''}
        <p><span>Total</span><strong>${money(sale.total)}</strong></p>
        <p><span>${method}</span><strong>${money(sale.amount)}</strong></p>
        ${sale.method === 'cash' ? `<p><span>Change</span><strong>${money(sale.amount - sale.total)}</strong></p>` : ''}
    `;
}

function renderReceiptDetails(receipt) {
    const status = { pending: 'Saved on this register · pending sync', review: 'Needs review', synced: 'Synced' };
    document.getElementById('receipt-details').innerHTML = `
        <p><strong>Receipt ${escapeHtml(receipt.sale_key)}</strong><br>
        ${escapeHtml(formatSaleDate(receipt.request.sold_at))}<br>${status[receipt.state]}</p>`;
}

function showReceipt(receipt) {
    renderReceiptDetails(receipt);
    document.getElementById('receipt-items').innerHTML = receipt.lines.map(item => `
        <tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.price_cents)}</td>
        <td>${money(item.price_cents * item.quantity)}</td></tr>
    `).join('');
    document.getElementById('receipt-totals').innerHTML = receiptTotals(receipt);
    const modal = document.getElementById('receipt-modal');
    modal.dataset.receipt = receipt.sale_key;
    modal.style.display = 'flex';
    document.getElementById('receipt-print-button').focus();
}

function printReceipt() {
    window.print();
}
