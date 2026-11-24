const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const elements = new Map();
const document = {
    getElementById(id) {
        if (!elements.has(id)) elements.set(id, { value: '', options: [], textContent: '', innerHTML: '' });
        return elements.get(id);
    }
};
document.getElementById('payment-method').value = 'cash';
const context = vm.createContext({
    document, alert() {}, checkoutReady: () => true, renderRegisterStatus() {},
    menuItems: [{ id: 1, name: 'Burger', price: 125.50, available_stock: 2, is_available: 1 }],
    cart: [], checkoutInProgress: false, escapeHtml: String, registerStatus: 'online'
});
for (const file of ['checkout.js', 'catalog-cart.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', file), 'utf8'), context);
}

vm.runInContext('addToCart(1); addToCart(1); addToCart(1);', context);
assert.equal(context.cart.length, 2);
document.getElementById('amount-tendered').value = '300';
vm.runInContext('updateCartUI()', context);
assert.equal(document.getElementById('change-preview').textContent, '₱49.00');
document.getElementById('discount-amount').value = '1.25';
vm.runInContext('renderPayment()', context);
assert.equal(document.getElementById('change-preview').textContent, '₱50.25');
vm.runInContext('removeItemFromCart(1)', context);
assert.equal(context.cart.length, 1);
console.log('Cart stock limit, discount, change and quantity removal passed.');
