document.addEventListener('DOMContentLoaded', () => {
    const installButton = document.getElementById('pwa-install-button');
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        pendingInstallPrompt = event;
        if (installButton) installButton.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
        pendingInstallPrompt = null;
        if (installButton) installButton.hidden = true;
    });

    if (installButton) {
        installButton.addEventListener('click', async () => {
            if (!pendingInstallPrompt) return;
            try {
                await pendingInstallPrompt.prompt();
                await pendingInstallPrompt.userChoice;
            } catch (error) {
                console.error('App installation prompt failed:', error);
            }
            pendingInstallPrompt = null;
            installButton.hidden = true;
        });
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(error => console.error('Service worker registration failed:', error));
    }

    window.addEventListener('offline', () => {
        if (registerStatus === 'signin') return;
        registerStatus = 'offline';
        document.getElementById('payment-method').value = 'cash';
        updateAdminUI();
        updateCartUI();
        renderMenu();
    });
    window.addEventListener('online', synchronizeRegister);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) synchronizeRegister();
    });
    window.setInterval(() => {
        if (!document.hidden) synchronizeRegister();
    }, 20000);

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const savedTheme = getSavedTheme();
        document.body.classList.toggle('dark-mode', savedTheme === 'dark');
        updateThemeButton(themeToggle);
        themeToggle.addEventListener('click', toggleTheme);
    }

    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', event => {
            event.preventDefault();
            submitUserChange({
                action: 'create',
                username: document.getElementById('create-user-username').value.trim(),
                password: document.getElementById('create-user-password').value,
                is_cashier: document.getElementById('create-user-cashier').checked,
                is_admin: document.getElementById('create-user-admin').checked
            }, createUserForm);
        });
    }

    const userEditorForm = document.getElementById('user-editor-form');
    if (userEditorForm) {
        userEditorForm.addEventListener('submit', event => {
            event.preventDefault();
            const password = document.getElementById('edit-user-password').value;
            submitUserChange({
                action: 'update',
                id: Number(document.getElementById('edit-user-id').value),
                username: document.getElementById('edit-user-username').value.trim(),
                password: password || undefined,
                is_cashier: document.getElementById('edit-user-cashier').checked,
                is_admin: document.getElementById('edit-user-admin').checked
            });
        });
    }

    const usersTableBody = document.getElementById('users-table-body');
    if (usersTableBody) {
        usersTableBody.addEventListener('click', event => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;
            const user = managedUsers.find(entry => Number(entry.id) === Number(button.dataset.userId));
            if (!user) return;
            if (button.dataset.action === 'edit') openUserEditor(user);
            if (button.dataset.action === 'delete') deleteManagedUser(user);
        });
    }

    const adminToggle = document.getElementById('admin-toggle-btn');
    if(adminToggle) {
        adminToggle.addEventListener('click', () => {
            if (registerStatus !== 'online') return;
            showPage('menu');
            adminMode = !adminMode;
            sessionStorage.setItem('adminMode', adminMode ? '1' : '0');
            updateAdminUI();
            renderMenu();
        });
    }

    const addForm = document.getElementById('add-item-form');
    if(addForm) {
        addForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAdminSubmit(e); 
        });
    }

    const reportFilter = document.getElementById('reports-filter');
    if (reportFilter) {
        initializeReportDates();
        reportFilter.addEventListener('submit', event => {
            event.preventDefault();
            if (reportFilter.reportValidity()) loadSalesReport();
        });
    }

    const inventoryRefreshButton = document.getElementById('inventory-refresh-button');
    if (inventoryRefreshButton) {
        inventoryRefreshButton.addEventListener('click', loadInventory);
    }

    const receiptPrintButton = document.getElementById('receipt-print-button');
    if (receiptPrintButton) {
        receiptPrintButton.addEventListener('click', printReceipt);
    }

    document.getElementById('category-filters').addEventListener('click', event => {
        const button = event.target.closest('[data-category]');
        if (!button) return;
        selectedCategory = button.dataset.category;
        renderMenu();
    });
    document.getElementById('queue-list').addEventListener('click', event => {
        const button = event.target.closest('[data-receipt]');
        const receipt = button && registerSales.find(sale => sale.sale_key === button.dataset.receipt
            && sale.user_id === Number(currentUser?.id));
        if (receipt) showReceipt(receipt);
    });
    document.getElementById('transaction-history-body').addEventListener('click', event => {
        const button = event.target.closest('[data-history-receipt]');
        if (button) printHistoryReceipt(Number(button.dataset.historyReceipt));
    });
    document.getElementById('sync-now').addEventListener('click', retrySales);
    document.getElementById('clear-cart').addEventListener('click', () => {
        if (!cart.length || !confirm('Clear this sale?')) return;
        cart = [];
        for (const id of ['amount-tendered', 'discount-amount', 'discount-reason', 'payment-reference']) {
            document.getElementById(id).value = '';
        }
        updateCartUI();
    });
    document.getElementById('payment-method').addEventListener('change', renderPayment);
    document.getElementById('discount-amount').addEventListener('input', renderPayment);
    document.getElementById('exact-cash').addEventListener('click', () => {
        document.getElementById('amount-tendered').value = (cartTotals().total / 100).toFixed(2);
        renderPayment();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            const modal = [...document.querySelectorAll('.modal')].find(element => element.style.display === 'flex');
            if (modal) closeModal(modal.id);
        }
    });

    const amountTenderedInput = document.getElementById('amount-tendered');
    if (amountTenderedInput) {
        amountTenderedInput.addEventListener('input', renderPayment);
    }
    
    updateAdminUI();
    document.getElementById("product-search").addEventListener("input", renderMenu);
    try {
        currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (currentUser?.id) startApp();
    } catch (error) {
        sessionStorage.removeItem('currentUser');
    }
});

// --- MGA TULONG NA FUNCTION ---

// 1. Modal Function: Magdagdag ng Bagong Item
