function loadMenuFromServer() {
    return synchronizeRegister();
}

function startApp() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    document.getElementById('welcome-label').textContent = currentUser.username;
    document.getElementById('server-status').hidden = true;
    updateAdminUI();
    updateCartUI();
    showPage('menu');
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

async function logout() {
    if (checkoutInProgress || registerBusy) return;
    try {
        await posFetch('api/logout.php', { method: 'POST' });
    } catch (error) {
        console.warn('The server could not be reached to end the session.');
    }
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('adminMode');
    currentUser = null;
    adminMode = false;
    registerStatus = 'connecting';
    registerCatalog = null;
    registerSales = [];
    historyReceipts.clear();
    managedUsers = [];
    for (const modal of document.querySelectorAll('.modal')) closeModal(modal.id);
    document.getElementById('receipt-details').replaceChildren();
    document.getElementById('receipt-items').replaceChildren();
    document.getElementById('receipt-totals').replaceChildren();
    cart = [];
    menuItems.length = 0;
    document.getElementById('app-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('password').value = '';
    document.getElementById('username').focus();
}

function showPage(pageId) {
    if (!currentUser) return;
    if (!['menu', 'queue'].includes(pageId) && registerStatus !== 'online') {
        alert('This page requires a connection to the server.');
        return;
    }

    const pages = ['menu', 'admin', 'users', 'transactions', 'reports', 'inventory', 'queue'];
    if (!pages.includes(pageId)) return;
    document.querySelector('.mobile-cart-link').hidden = pageId !== 'menu';
    for (const page of pages) {
        document.getElementById(page + '-view').style.display = page === pageId ? 'block' : 'none';
    }
    for (const element of document.querySelectorAll('[data-page]')) {
        element.classList.toggle('active', element.dataset.page === pageId);
    }

    switch (pageId) {
        case 'menu': synchronizeRegister(); break;
        case 'admin': loadOpenSales(); break;
        case 'users': loadManagedUsers(); break;
        case 'transactions': loadTransactionHistory(); break;
        case 'reports': loadSalesReport(); break;
        case 'inventory': loadInventory(); break;
        case 'queue': renderRegisterStatus(); break;
    }
}
