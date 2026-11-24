// --- DATOS ---
const menuItems = [];

let cart = [];
let pendingCheckout = null;
let checkoutInProgress = false;
let currentUser = null; 
let adminMode = false;
let managedUsers = [];
let historyReceipts = new Map();
const PRODUCT_IMAGE_STORAGE_PREFIX = 'hungryVillainsProductImage:';
const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024;
let pendingInstallPrompt = null;

function getSavedTheme() {
    try {
        return localStorage.getItem('hungryVillainsTheme');
    } catch (error) {
        console.warn('Unable to read the saved theme preference:', error);
        return null;
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem('hungryVillainsTheme', theme);
    } catch (error) {
        console.warn('Unable to save the theme preference:', error);
    }
}

function getStoredProductImage(itemId) {
    try {
        return localStorage.getItem(`${PRODUCT_IMAGE_STORAGE_PREFIX}${itemId}`);
    } catch (error) {
        console.warn('Unable to read a saved product image:', error);
        return null;
    }
}

function readProductImage(file) {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
        return Promise.reject(new Error('Choose a JPG, PNG, WEBP, or GIF image.'));
    }
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
        return Promise.reject(new Error('Product images must be 2 MB or smaller.'));
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Unable to read the selected product image.'));
            }
        });
        reader.addEventListener('error', () => {
            reject(reader.error || new Error('Unable to read the selected product image.'));
        });
        reader.readAsDataURL(file);
    });
}

function updateThemeButton(button) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    button.textContent = isDarkMode ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-pressed', String(isDarkMode));
}

function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) updateThemeButton(themeToggle);
    saveTheme(isDarkMode ? 'dark' : 'light');
}

const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const notice = document.getElementById('server-status');
    const button = loginForm.querySelector('button');
    button.disabled = true;
    notice.hidden = true;
    try {
        const response = await posFetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        });
        const account = await response.json();
        if (!response.ok || !account.success) throw new Error(account.message || 'Unable to sign in.');
        currentUser = account;
        sessionStorage.setItem('currentUser', JSON.stringify(account));
        sessionStorage.removeItem('adminMode');
        document.getElementById('password').value = '';
        startApp();
    } catch (error) {
        notice.textContent = ['TypeError', 'TimeoutError', 'SyntaxError'].includes(error.name)
            ? 'The server is unreachable. Connect and try again.' : error.message;
        notice.hidden = false;
    } finally {
        button.disabled = false;
    }
});
