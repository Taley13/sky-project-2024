/**
 * Babylon Admin Panel - Dashboard
 * CSP-compliant version (no inline scripts)
 */

// CSRF Token for secure requests
let csrfToken = null;

// Fetch CSRF token on load
async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token', { credentials: 'include' });
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
}

// Helper function for secure fetch with CSRF
// Base path for API calls (handles /admin/ proxy)
const API_BASE = window.location.pathname.includes('/admin') ? '' : '';

async function secureFetch(url, options = {}) {
    // Add CSRF token to all non-GET requests
    if (options.method && options.method !== 'GET') {
        options.headers = options.headers || {};
        options.headers['CSRF-Token'] = csrfToken;
    }
    // Always include credentials for session cookies
    options.credentials = 'include';
    // URL is relative to current path, so /api/... becomes /admin/api/... automatically
    return fetch(url, options);
}

// Current site selection
let currentSite = localStorage.getItem('selectedSite') || 'babylon';

// Available sites configuration
const AVAILABLE_SITES = [
    {
        id: 'babylon',
        name: 'Babylon Aleks Group',
        descriptionKey: 'babylonDescription',
        icon: '&#128736;',
        url: 'https://babylon-aleks-group.pl'
    }
    // HIDDEN 2026-01-12: Mattress site deactivated
    // To restore: uncomment block below
    /*
    ,{
        id: 'mattress',
        nameKey: 'mattressStore',
        descriptionKey: 'mattressDescription',
        icon: '&#128716;',
        url: 'https://babylon-aleks-group.pl/mattresses/'
    }
    */
];

// Current user role
let currentUserRole = 'admin';

// Categories data
let categoriesData = [];

// Products data
let productsData = [];
let productCurrentLang = 'en';

// Orders data
let ordersData = [];
let currentOrderId = null;

// Users data
let usersData = [];

// UI Language
let currentLang = localStorage.getItem('adminLang') || 'ru';

// UI Translations
const uiTranslations = {
    ru: {
        // Navigation
        home: 'Главная',
        contacts: 'Контакты',
        categories: 'Категории',
        productsServices: 'Товары и услуги',
        orders: 'Заявки',
        settings: 'Настройки',
        users: 'Пользователи',
        logout: 'Выйти',

        // Page titles
        pageTitle: 'Главная',
        welcome: 'Добро пожаловать в панель управления',

        // Categories
        categoriesManagement: 'Управление категориями',
        categoriesDescription: 'Добавляйте, редактируйте и сортируйте категории товаров',
        addCategory: 'Добавить категорию',

        // Products
        productsManagement: 'Управление товарами и услугами',
        productsDescription: 'Добавляйте и редактируйте карточки техники и услуг',
        allCategories: 'Все категории',
        addProduct: 'Добавить товар/услугу',
        key: 'Ключ (англ.) *',
        category: 'Категория',
        selectCategory: '-- Выберите --',
        price: 'Цена (за день)',
        image: 'Изображение',

        // Orders
        ordersHistory: 'История заявок',
        ordersDescription: 'Просмотр и управление заявками с сайта',
        new: 'Новые',
        inProgress: 'В работе',
        completed: 'Завершены',

        // Users
        usersManagement: 'Управление пользователями',
        usersDescription: 'Добавляйте и управляйте пользователями системы',
        login: 'Логин',
        role: 'Роль',
        created: 'Создан',
        actions: 'Действия',

        // Buttons
        add: '+ Добавить',
        cancel: 'Отмена',
        save: 'Сохранить',

        // Dashboard
        selectSection: 'Выберите раздел в меню слева для начала работы',
        productsCount: 'Товаров',
        categoriesCount: 'Категорий',
        ordersCount: 'Заявок',
        managedSites: 'Управляемые сайты',
        babylonDescription: 'Аренда строительной техники',
        // HIDDEN 2026-01-12: Mattress translations (restore if needed)
        // mattressStore: 'Магазин матрасов',
        // mattressDescription: 'Продажа матрасов',
        selected: 'Выбран',
        active: 'Активен',
        visitSite: 'На сайт',
        babylonSelector: 'Babylon - Спецтехника',
        // mattressSelector: 'Матрасы',

        // Contacts
        contactsManagement: 'Управление контактами',
        contactsDescription: 'Редактируйте контактные данные сайта Babylon Aleks Group',
        phone: 'Телефон *',
        addressCity: 'Адрес (город, страна)',
        addressStreet: 'Адрес (улица)',
        contactPerson: 'Контактное лицо',
        saveChanges: 'Сохранить изменения',

        // Category form
        nameEN: 'Название EN *',
        nameDE: 'Название DE',
        nameRU: 'Название RU',
        systemKey: 'Системный ключ',
        categoryNameEnHint: 'Основное название категории (обязательно)',
        categoryKeyHint: 'Генерируется автоматически из английского названия',
        translations: 'Переводы (опционально)',
        iconNumber: 'Номер иконки',
        iconHint: 'Число от 1 до 10',
        preview: 'Предпросмотр:',

        // Orders
        allStatuses: 'Все статусы',
        total: 'Всего: 0',
        date: 'Дата',
        name: 'Имя',
        period: 'Период',
        status: 'Статус',
        orderDetails: 'Детали заявки',
        dateLabel: 'Дата:',
        nameLabel: 'Имя:',
        phoneLabel: 'Телефон:',
        rentalPeriod: 'Период аренды:',
        pageLabel: 'Страница:',
        productLabel: 'Товар:',
        commentLabel: 'Комментарий:',
        statusLabel: 'Статус:',
        statusNew: 'Новая',
        statusInProgress: 'В работе',
        statusCompleted: 'Завершена',
        delete: 'Удалить',

        // Settings
        settingsDescription: 'Настройки интеграции с Telegram',
        botTokenHint: 'Получите токен у @BotFather в Telegram',
        chatIdHint: 'ID чата или канала для получения заявок',
        testSend: 'Тест отправки',
        setupInstructions: 'Инструкция по настройке',
        instruction1: 'Откройте @BotFather в Telegram',
        instruction2: 'Отправьте команду /newbot',
        instruction3: 'Следуйте инструкциям и скопируйте токен бота',
        instruction4: 'Добавьте бота в группу или канал',
        instruction5: 'Получите Chat ID (можно использовать @userinfobot)',
        instruction6: 'Вставьте данные в форму выше и нажмите "Тест отправки"',

        // Users
        addUser: 'Добавить пользователя',
        loginLabel: 'Логин *',
        passwordLabel: 'Пароль *',
        roleLabel: 'Роль *',
        administrator: 'Администратор',
        accountant: 'Бухгалтер',
        changePassword: 'Сменить пароль',
        newPassword: 'Новый пароль *',
        noOrders: 'Нет заявок',
        details: 'Подробнее',
        notesLabel: 'Заметки:',
        notesHint: 'Только для внутреннего использования',
        statistics: 'Статистика',
        ordersChart: 'Заявки за последние 7 дней',
        popularProducts: 'Популярные товары',
        auditLog: 'Журнал действий',
        auditDescription: 'История всех изменений в системе',
        allActions: 'Все действия',
        allEntities: 'Все объекты',
        refresh: 'Обновить',
        user: 'Пользователь',
        object: 'Объект'
    },
};

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication first - redirect to login if not authenticated
    try {
        const authCheck = await fetch('/api/auth/me', { credentials: 'include' });
        if (!authCheck.ok) {
            // Not authenticated - redirect to login
            window.location.href = '/admin/login.html';
            return;
        }
    } catch (e) {
        // Auth check failed - redirect to login
        window.location.href = '/admin/login.html';
        return;
    }

    // Fetch CSRF token first
    await fetchCsrfToken();

    // Initialize site selector
    const siteSelector = document.getElementById('siteSelector');
    if (siteSelector) {
        siteSelector.value = currentSite;
        siteSelector.addEventListener('change', (e) => {
            currentSite = e.target.value;
            localStorage.setItem('selectedSite', currentSite);
            renderSiteCards();
            loadCurrentSection();
        });
    }

    // Initialize navigation
    initNavigation();

    // Initialize sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.querySelector('.admin-layout').classList.toggle('sidebar-open');
        });
    }

    // Initialize logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Initialize forms
    initForms();

    // Initialize category form listeners (auto-generate key, preview)
    initCategoryFormListeners();

    // Initialize event delegation for dynamic buttons
    initEventDelegation();

    // Initialize language buttons
    initLanguageButtons();

    // Set active language button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === currentLang) {
            btn.classList.add('active');
        }
    });

    // Apply translations
    applyTranslations();

    // Load initial data
    loadUserInfo();
    renderSiteCards();
    loadDashboardStats();

    // Initialize new features
    initKeyboardShortcuts();
    startOrdersAutoRefresh();
    requestNotificationPermission();
    initDateFilters();
    initThemeToggle();
    initGlobalSearch();

    // Preload data for search
    loadCategories();
    loadProducts();
    loadOrders();
});

// ============ EVENT DELEGATION ============

function initEventDelegation() {
    // Delegate clicks on dynamic buttons
    document.body.addEventListener('click', function(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;
        const visible = target.dataset.visible;

        switch (action) {
            // Site actions
            case 'selectSite':
                selectSite(id);
                break;
            case 'visitSite':
                e.stopPropagation(); // Don't select site when clicking visit link
                break;

            // Category actions
            case 'showCategoryModal':
                showCategoryModal();
                break;
            case 'closeCategoryModal':
                closeCategoryModal();
                break;
            case 'editCategory':
                editCategory(parseInt(id));
                break;
            case 'deleteCategory':
                deleteCategory(parseInt(id));
                break;
            case 'toggleCategoryVisibility':
                toggleCategoryVisibility(parseInt(id), visible === 'true' || visible === '1');
                break;

            // Hexagon actions
            case 'showHexagonModal':
                showHexagonModal();
                break;
            case 'closeHexagonModal':
                closeHexagonModal();
                break;
            case 'editHexagon':
                showHexagonModal(parseInt(id));
                break;
            case 'deleteHexagon':
                deleteHexagon(parseInt(id));
                break;
            case 'toggleHexagonVisibility':
                toggleHexagonVisibility(parseInt(id), visible);
                break;

            // Product actions
            case 'showProductModal':
                showProductModal();
                break;
            case 'closeProductModal':
                closeProductModal();
                break;
            case 'editProduct':
                editProduct(parseInt(id));
                break;
            case 'duplicateProduct':
                duplicateProduct(parseInt(id));
                break;
            case 'deleteProduct':
                deleteProduct(parseInt(id));
                break;
            case 'toggleProductVisibility':
                toggleProductVisibility(parseInt(id), visible === 'true' || visible === '1');
                break;
            case 'switchProductLang':
                switchProductLang(target.dataset.lang);
                break;

            // Order actions
            case 'showOrderDetails':
                showOrderDetails(parseInt(id));
                break;
            case 'closeOrderModal':
                closeOrderModal();
                break;
            case 'saveOrderStatus':
                saveOrderStatus();
                break;
            case 'deleteCurrentOrder':
                deleteCurrentOrder();
                break;

            // User actions
            case 'showUserModal':
                showUserModal();
                break;
            case 'closeUserModal':
                closeUserModal();
                break;
            case 'editUser':
                editUser(parseInt(id));
                break;
            case 'deleteUser':
                deleteUser(parseInt(id));
                break;
            case 'showPasswordModal':
                showPasswordModal(parseInt(id));
                break;
            case 'closePasswordModal':
                closePasswordModal();
                break;

            // Settings actions
            case 'testTelegram':
                testTelegram();
                break;
        }
    });

    // Handle product image preview
    const productImage = document.getElementById('productImage');
    if (productImage) {
        productImage.addEventListener('change', function() {
            previewProductImage(this);
        });
    }
}

// ============ NAVIGATION ============

function initNavigation() {
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.currentTarget.dataset.section;

            // Update active nav
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            e.currentTarget.parentElement.classList.add('active');

            // Show section
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById('section-' + section).classList.add('active');

            // Update title
            document.getElementById('pageTitle').textContent = e.currentTarget.querySelector('.nav-text').textContent;

            // Load section data
            if (section === 'contacts') {
                loadContacts();
            } else if (section === 'categories') {
                loadCategories();
            } else if (section === 'products') {
                loadCategoriesForProducts();
            } else if (section === 'orders') {
                loadOrders();
            } else if (section === 'settings') {
                loadSettings();
            } else if (section === 'users') {
                loadUsers();
            }

            // Close sidebar on mobile
            document.querySelector('.admin-layout').classList.remove('sidebar-open');
        });
    });
}

// ============ FORMS ============

function initForms() {
    // Contacts form
    const contactsForm = document.getElementById('contactsForm');
    if (contactsForm) {
        contactsForm.addEventListener('submit', handleContactsSubmit);
    }

    // Category form
    const categoryForm = document.getElementById('categoryForm');
    if (categoryForm) {
        categoryForm.addEventListener('submit', handleCategorySubmit);
    }

    // Hexagon form
    const hexagonForm = document.getElementById('hexagonForm');
    if (hexagonForm) {
        hexagonForm.addEventListener('submit', saveHexagon);
    }

    // Product form
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
    }

    // Product category filter
    const productCategoryFilter = document.getElementById('productCategoryFilter');
    if (productCategoryFilter) {
        productCategoryFilter.addEventListener('change', loadProducts);
    }

    // Order status filter
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener('change', loadOrders);
        const orderSearchInput = document.getElementById("orderSearchInput");
        if (orderSearchInput) {
            let searchTimeout;
            orderSearchInput.addEventListener("input", (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => loadOrders(), 300);
            });
        }
    }

    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSettingsSubmit);
    }

    // User form
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', handleUserSubmit);
    }

    // Password form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
    }
}

// ============ LANGUAGE ============

function initLanguageButtons() {
    document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => switchAdminLang(btn.dataset.lang));
    });
}

function switchAdminLang(lang) {
    currentLang = lang;
    localStorage.setItem('adminLang', lang);

    // Update active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Apply translations
    applyTranslations();
}

function applyTranslations() {
    const t = uiTranslations[currentLang];

    // Update elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.tagName === 'INPUT' && el.type === 'button') {
                el.value = t[key];
            } else if (el.tagName === 'OPTION') {
                el.textContent = t[key];
            } else {
                el.textContent = t[key];
            }
        }
    });

    // Re-render dynamic content
    renderSiteCards();

    // Re-render lists with new translations
    if (ordersData.length > 0) renderOrders();
    if (categoriesData.length > 0) populateCategorySelects();
}

// ============ AUTH ============

async function handleLogout() {
    try {
        const response = await secureFetch('/api/auth/logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            window.location.href = data.redirect;
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function loadUserInfo() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('userName').textContent = data.username;
            currentUserRole = data.role || 'admin';
            applyRoleRestrictions(currentUserRole);
        } else {
            // Fallback to old API
            const statusResponse = await fetch('/api/auth/status', { credentials: 'include' });
            const statusData = await statusResponse.json();
            if (statusData.authenticated) {
                document.getElementById('userName').textContent = statusData.username;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

function applyRoleRestrictions(role) {
    if (role === 'accountant') {
        // Hide admin-only menu items
        document.querySelectorAll('[data-admin-only]').forEach(el => {
            el.style.display = 'none';
        });

        // Make products the active section
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const productsNav = document.querySelector('[data-section="products"]');
        if (productsNav) {
            productsNav.parentElement.classList.add('active');
        }

        // Show products section
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById('section-products').classList.add('active');
        document.getElementById('pageTitle').textContent = 'Товары и услуги';

        // Load products
        loadCategoriesForProducts();
    }
}

function canDeleteProducts() {
    return currentUserRole === 'admin';
}

// ============ SITES ============

function renderSiteCards() {
    const grid = document.getElementById('sitesGrid');
    if (!grid) return;

    const t = typeof uiTranslations !== 'undefined' ? uiTranslations[currentLang] : {};
    grid.innerHTML = AVAILABLE_SITES.map(site => {
        const siteName = site.nameKey ? (t[site.nameKey] || site.name || site.nameKey) : site.name;
        const siteDesc = t[site.descriptionKey] || site.descriptionKey;
        const statusText = currentSite === site.id ? (t.selected || 'Выбран') : (t.active || 'Активен');
        const visitText = t.visitSite || 'На сайт';
        return `
        <div class="site-card clickable ${currentSite === site.id ? 'selected active' : ''}" data-action="selectSite" data-id="${site.id}">
            <div class="site-icon">${site.icon}</div>
            <div class="site-info">
                <h4>${siteName}</h4>
                <p>${siteDesc}</p>
            </div>
            <div class="site-actions">
                <span class="site-status">${statusText}</span>
                <a href="${site.url}" target="_blank" class="btn-visit-site" data-action="visitSite" title="${visitText}">&#128279;</a>
            </div>
        </div>
    `}).join('');
}

function selectSite(siteId) {
    currentSite = siteId;
    localStorage.setItem('selectedSite', currentSite);
    document.getElementById('siteSelector').value = currentSite;
    renderSiteCards();
    loadCurrentSection();
}

function loadCurrentSection() {
    const activeNav = document.querySelector('.nav-item.active a');
    const section = activeNav ? activeNav.dataset.section : 'dashboard';

    if (section === 'dashboard') {
        loadDashboardStats();
    } else if (section === 'contacts') {
        loadContacts();
    } else if (section === 'categories') {
        loadCategories();
    } else if (section === 'products') {
        loadCategoriesForProducts();
    } else if (section === 'orders') {
        loadOrders();
    } else if (section === 'settings') {
        loadSettings();
    }
}

// ============ DASHBOARD ============

async function loadDashboardStats() {
    try {
        const [productsRes, categoriesRes, ordersRes] = await Promise.all([
            fetch(`/api/products/${currentSite}`, { credentials: 'include' }),
            fetch(`/api/categories/${currentSite}`, { credentials: 'include' }),
            fetch(`/api/orders/${currentSite}/stats`, { credentials: 'include' })
        ]);

        if (productsRes.ok) {
            const products = await productsRes.json();
            document.getElementById('statProducts').textContent = products.length;
        }

        if (categoriesRes.ok) {
            const categories = await categoriesRes.json();
            document.getElementById('statCategories').textContent = categories.length;
        }

        if (ordersRes.ok) {
            const stats = await ordersRes.json();
            document.getElementById('statOrders').textContent = stats.total;

            // Update badge in sidebar
            const badge = document.getElementById('ordersCount');
            if (stats.new > 0) {
                badge.textContent = stats.new;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }

        // Load charts after stats
        loadDashboardCharts();
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// ============ CONTACTS ============

async function loadContacts() {
    try {
        const response = await fetch(`/api/contacts/${currentSite}`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('contactPhone').value = data.phone || '';
            document.getElementById('contactEmail').value = data.email || '';
            document.getElementById('contactAddress').value = data.address || '';
            document.getElementById('contactAddress2').value = data.address_line2 || '';
            document.getElementById('contactNip').value = data.nip || '';
            document.getElementById('contactTelegram').value = data.telegram || '';
            document.getElementById('contactPerson').value = data.contact_person || '';
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
    }
}

async function handleContactsSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const status = document.getElementById('contactsSaveStatus');

    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    btn.disabled = true;
    status.textContent = '';
    status.className = 'save-status';

    const formData = {
        phone: document.getElementById('contactPhone').value,
        email: document.getElementById('contactEmail').value,
        address: document.getElementById('contactAddress').value,
        address_line2: document.getElementById('contactAddress2').value,
        nip: document.getElementById('contactNip').value,
        telegram: document.getElementById('contactTelegram').value,
        contact_person: document.getElementById('contactPerson').value
    };

    try {
        const response = await secureFetch(`/api/contacts/${currentSite}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            status.textContent = 'Сохранено!';
            status.className = 'save-status success';
        } else {
            status.textContent = data.error || 'Ошибка сохранения';
            status.className = 'save-status error';
        }
    } catch (error) {
        status.textContent = 'Ошибка соединения';
        status.className = 'save-status error';
    }

    btnText.style.display = 'inline-block';
    btnLoader.style.display = 'none';
    btn.disabled = false;

    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}

// ============ CATEGORIES ============

// Generate category key from English name
function generateCategoryKey(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        // Special characters
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ç]/g, 'c')
        .replace(/[ñ]/g, 'n')
        .replace(/[òôõö]/g, 'o')
        .replace(/[šş]/g, 's')
        .replace(/[ž]/g, 'z')
        .replace(/[üù]/g, 'u')
        // Russian characters (transliteration)
        .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v')
        .replace(/г/g, 'g').replace(/д/g, 'd').replace(/е/g, 'e')
        .replace(/ё/g, 'yo').replace(/ж/g, 'zh').replace(/з/g, 'z')
        .replace(/и/g, 'i').replace(/й/g, 'y').replace(/к/g, 'k')
        .replace(/л/g, 'l').replace(/м/g, 'm').replace(/н/g, 'n')
        .replace(/о/g, 'o').replace(/п/g, 'p').replace(/р/g, 'r')
        .replace(/с/g, 's').replace(/т/g, 't').replace(/у/g, 'u')
        .replace(/ф/g, 'f').replace(/х/g, 'h').replace(/ц/g, 'ts')
        .replace(/ч/g, 'ch').replace(/ш/g, 'sh').replace(/щ/g, 'sch')
        .replace(/ъ/g, '').replace(/ы/g, 'y').replace(/ь/g, '')
        .replace(/э/g, 'e').replace(/ю/g, 'yu').replace(/я/g, 'ya')
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Remove all non-alphanumeric except hyphens
        .replace(/[^a-z0-9-]/g, '')
        // Remove multiple hyphens
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-|-$/g, '');
}

// Validate that category key is unique
function validateCategoryKeyUnique(key, currentId) {
    const existingCategory = categoriesData.find(c =>
        c.key === key && c.id !== parseInt(currentId)
    );
    return !existingCategory;
}

// Update category preview in modal
function updateCategoryPreview() {
    const nameEn = document.getElementById('categoryNameEn').value;
    const key = document.getElementById('categoryKey').value;
    const icon = document.getElementById('categoryIcon')?.value || '?';

    document.getElementById('previewNameEn').textContent = nameEn || '-';
    document.getElementById('previewKey').textContent = key || '-';
    document.getElementById('previewIcon').textContent = icon || '?';
}

// Initialize category form listeners
function initCategoryFormListeners() {
    const nameEnInput = document.getElementById('categoryNameEn');
    const keyInput = document.getElementById('categoryKey');
    const iconInput = document.getElementById('categoryIcon');
    const keyError = document.getElementById('categoryKeyError');

    if (nameEnInput) {
        nameEnInput.addEventListener('input', function() {
            const categoryId = document.getElementById('categoryId').value;
            // Only auto-generate key for new categories (no ID)
            if (!categoryId) {
                const generatedKey = generateCategoryKey(this.value);
                keyInput.value = generatedKey;

                // Validate uniqueness
                if (generatedKey && !validateCategoryKeyUnique(generatedKey, categoryId)) {
                    keyError.textContent = 'Такой ключ уже существует!';
                    keyError.style.display = 'block';
                } else {
                    keyError.style.display = 'none';
                }
            }
            updateCategoryPreview();
        });
    }

    if (iconInput) {
        iconInput.addEventListener('input', updateCategoryPreview);
    }
}

async function loadCategories() {
    try {
        const response = await secureFetch(`/api/categories/${currentSite}`);
        if (response.ok) {
            categoriesData = await response.json();
            renderCategories();
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderCategories() {
    const list = document.getElementById('categoriesList');
    if (categoriesData.length === 0) {
        list.innerHTML = '<p class="empty-message">Нет категорий</p>';
        destroyCategoriesSortable();
        return;
    }

    list.innerHTML = categoriesData.map(cat => `
        <div class="category-item ${cat.visible ? '' : 'hidden-cat'}" data-id="${cat.id}">
            <div class="drag-handle" title="Перетащите для сортировки">&#9776;</div>
            <div class="category-info">
                <span class="category-name">${cat.name_ru || cat.name_en}</span>
                <span class="category-key">${cat.key}</span>
            </div>
            <div class="category-langs">
                <span class="lang-tag ${cat.name_en ? 'active' : ''}">EN</span>
                <span class="lang-tag ${cat.name_de ? 'active' : ''}">DE</span>
                <span class="lang-tag ${cat.name_ru ? 'active' : ''}">RU</span>
            </div>
            <div class="category-actions">
                <button class="btn-icon" data-action="toggleCategoryVisibility" data-id="${cat.id}" data-visible="${cat.visible}" title="${cat.visible ? 'Скрыть' : 'Показать'}">
                    ${cat.visible ? '&#128065;' : '&#128064;'}
                </button>
                <button class="btn-icon" data-action="editCategory" data-id="${cat.id}" title="Редактировать">&#9998;</button>
                <button class="btn-icon btn-danger" data-action="deleteCategory" data-id="${cat.id}" title="Удалить">&#128465;</button>
            </div>
        </div>
    `).join('');

    // Initialize sortable after rendering
    destroyCategoriesSortable();
    setTimeout(() => initCategoriesSortable(), 100);
}

function showCategoryModal(id = null) {
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');
    const form = document.getElementById('categoryForm');
    const keyInput = document.getElementById('categoryKey');
    const keyError = document.getElementById('categoryKeyError');

    // Hide any previous error
    if (keyError) keyError.style.display = 'none';

    if (id) {
        title.textContent = 'Редактировать категорию';
        const cat = categoriesData.find(c => c.id === id);
        if (cat) {
            document.getElementById('categoryId').value = cat.id;
            document.getElementById('categoryKey').value = cat.key;
            document.getElementById('categoryNameEn').value = cat.name_en || '';
            document.getElementById('categoryNameDe').value = cat.name_de || '';
            document.getElementById('categoryNameRu').value = cat.name_ru || '';
            // Icon field (new)
            const iconInput = document.getElementById('categoryIcon');
            if (iconInput) iconInput.value = cat.icon || '';
            // For editing, key is read-only but editable via direct input if needed
            keyInput.readOnly = true;
            keyInput.classList.add('input-readonly');
        }
    } else {
        title.textContent = 'Добавить категорию';
        form.reset();
        document.getElementById('categoryId').value = '';
        // For new categories, key is auto-generated but user can override
        keyInput.readOnly = true;
        keyInput.classList.add('input-readonly');
    }

    // Update preview
    updateCategoryPreview();

    modal.classList.add('active');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
}

function editCategory(id) {
    showCategoryModal(id);
}

async function toggleCategoryVisibility(id, current) {
    try {
        await secureFetch(`/api/categories/${currentSite}/` + id + '/visibility', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visible: !current })
        });
        loadCategories();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteCategory(id) {
    if (!confirm('Удалить эту категорию?')) return;
    try {
        await secureFetch(`/api/categories/${currentSite}/` + id, { method: 'DELETE' });
        loadCategories();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const keyInput = document.getElementById('categoryKey');
    const keyError = document.getElementById('categoryKeyError');

    // Validate key uniqueness before submit
    const key = keyInput.value;
    if (!validateCategoryKeyUnique(key, id)) {
        if (keyError) {
            keyError.textContent = 'Такой ключ уже существует! Измените название.';
            keyError.style.display = 'block';
        }
        return;
    }

    // Get current visibility from existing category or default to true for new
    let currentVisible = true;
    if (id) {
        const cat = categoriesData.find(c => c.id === parseInt(id));
        if (cat) {
            currentVisible = cat.visible;
        }
    }

    // Get icon value (new field)
    const iconInput = document.getElementById('categoryIcon');
    const icon = iconInput ? iconInput.value : '';

    const data = {
        key: key,
        name_en: document.getElementById('categoryNameEn').value,
        name_de: document.getElementById('categoryNameDe').value,
        name_ru: document.getElementById('categoryNameRu').value,
        icon: icon,
        visible: currentVisible
    };

    const url = id ? `/api/categories/${currentSite}/` + id : `/api/categories/${currentSite}`;
    const method = id ? 'PUT' : 'POST';

    try {
        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        closeCategoryModal();
        loadCategories();
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============ HEXAGONS ============

let hexagonsData = [];

async function loadHexagons() {
    try {
        const response = await secureFetch(`/api/hexagons/${currentSite}`);
        hexagonsData = await response.json();
        renderHexagons();
    } catch (error) {
        console.error('Error loading hexagons:', error);
        showNotification('Failed to load hexagons', 'error');
    }
}

function renderHexagons() {
    const list = document.getElementById('hexagonsList');
    if (!list) return;

    list.innerHTML = hexagonsData.map(hex => `
        <div class="category-item ${hex.visible ? '' : 'hidden-cat'}" data-id="${hex.id}">
            <div class="drag-handle">&#9776;</div>
            <div class="category-info">
                <strong>${hex.name_en || hex.key}</strong>
                <span class="cat-meta">Key: ${hex.key} | Icon: ${hex.icon_number}</span>
            </div>
            <div class="category-actions">
                <button class="btn-icon"
                        data-action="toggleHexagonVisibility"
                        data-id="${hex.id}"
                        data-visible="${hex.visible}"
                        title="${hex.visible ? 'Hide' : 'Show'}">
                    ${hex.visible ? '👁️' : '👁️‍🗨️'}
                </button>
                <button class="btn-icon" data-action="editHexagon" data-id="${hex.id}" title="Edit">✏️</button>
                <button class="btn-icon btn-danger" data-action="deleteHexagon" data-id="${hex.id}" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');

    initHexagonsSortable();
}

function initHexagonsSortable() {
    const list = document.getElementById('hexagonsList');
    if (!list || !window.Sortable) return;

    new Sortable(list, {
        handle: '.drag-handle',
        animation: 150,
        onEnd: async function() {
            const items = list.querySelectorAll('.category-item');
            const order = Array.from(items).map((item, index) => ({
                id: parseInt(item.dataset.id),
                sort_order: index
            }));

            try {
                await secureFetch(`/api/hexagons/${currentSite}/reorder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order })
                });
                showNotification('Order updated', 'success');
            } catch (error) {
                console.error('Error reordering:', error);
                showNotification('Failed to update order', 'error');
            }
        }
    });
}

async function toggleHexagonVisibility(id, currentVisible) {
    try {
        await secureFetch(`/api/hexagons/${currentSite}/${id}/visibility`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visible: currentVisible === '1' ? 0 : 1 })
        });
        showNotification('Visibility updated', 'success');
        loadHexagons();
    } catch (error) {
        console.error('Error toggling visibility:', error);
        showNotification('Failed to update visibility', 'error');
    }
}

function showHexagonModal(id = null) {
    const modal = document.getElementById('hexagonModal');
    const form = document.getElementById('hexagonForm');
    const title = document.getElementById('hexagonModalTitle');

    form.reset();
    title.textContent = id ? 'Edit Hexagon' : 'Add Hexagon';

    if (id) {
        const hexagon = hexagonsData.find(h => h.id === id);
        if (hexagon) {
            document.getElementById('hexagonId').value = hexagon.id;
            document.getElementById('hexagonKey').value = hexagon.key;
            document.getElementById('hexagonIcon').value = hexagon.icon_number;
            document.getElementById('hexagonNameEn').value = hexagon.name_en;
            document.getElementById('hexagonNameDe').value = hexagon.name_de;
            document.getElementById('hexagonNameRu').value = hexagon.name_ru;
        }
    }

    modal.classList.add('active');
}

function closeHexagonModal() {
    const modal = document.getElementById('hexagonModal');
    modal.classList.remove('active');
}

async function saveHexagon(e) {
    e.preventDefault();
    const id = document.getElementById('hexagonId').value;
    const url = id
        ? `/api/hexagons/${currentSite}/${id}`
        : `/api/hexagons/${currentSite}`;
    const method = id ? 'PUT' : 'POST';

    try {
        await secureFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: document.getElementById('hexagonKey').value,
                name_en: document.getElementById('hexagonNameEn').value,
                name_de: document.getElementById('hexagonNameDe').value,
                name_ru: document.getElementById('hexagonNameRu').value,
                icon_number: parseInt(document.getElementById('hexagonIcon').value) || 0
            })
        });

        showNotification(id ? 'Hexagon updated' : 'Hexagon created', 'success');
        closeHexagonModal();
        loadHexagons();
    } catch (error) {
        console.error('Error saving hexagon:', error);
        showNotification('Failed to save hexagon', 'error');
    }
}

async function deleteHexagon(id) {
    if (!confirm('Delete this hexagon?')) return;

    try {
        await secureFetch(`/api/hexagons/${currentSite}/${id}`, {
            method: 'DELETE'
        });
        showNotification('Hexagon deleted', 'success');
        loadHexagons();
    } catch (error) {
        console.error('Error deleting:', error);
        showNotification('Failed to delete', 'error');
    }
}

// ============ PRODUCTS ============

async function loadProducts() {
    const categoryId = document.getElementById('productCategoryFilter').value;
    let url = `/api/products/${currentSite}`;
    if (categoryId) {
        url += '?category_id=' + categoryId;
    }

    try {
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) {
            productsData = await response.json();
            renderProducts();
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProducts() {
    const list = document.getElementById('productsList');
    if (productsData.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>Нет товаров и услуг</p></div>';
        destroyProductsSortable();
        updateBatchActionsBar();
        return;
    }

    const showDelete = canDeleteProducts();
    list.innerHTML = productsData.map(p => {
        const title = p.translations?.ru?.title || p.translations?.en?.title || p.product_key;
        const subtitle = p.translations?.ru?.subtitle || p.translations?.en?.subtitle || '';
        const description = p.translations?.ru?.description || p.translations?.en?.description || '';
        const truncatedDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;
        const categoryName = p.category_name_ru || p.category_name_en || '';
        return `
        <div class="product-card ${p.visible ? '' : 'hidden-card'}" data-id="${p.id}">
            <input type="checkbox" class="product-checkbox" data-id="${p.id}" onchange="updateBatchActionsBar()">
            <div class="product-drag-handle" title="Перетащите для сортировки">&#9776;</div>
            <div class="product-image">
                ${p.image ? `<img src="${p.image}" alt="${title}">` : '<div class="no-image">&#128247;</div>'}
            </div>
            <div class="product-info">
                <h4>${title}</h4>
                ${subtitle ? `<span class="product-subtitle">${subtitle}</span>` : ''}
                <span class="product-category">${categoryName}</span>
                ${truncatedDesc ? `<p class="product-description">${truncatedDesc}</p>` : ''}
                ${p.price ? `<span class="product-price">${p.price}</span>` : ''}
            </div>
            <div class="product-actions">
                <button class="btn-icon" data-action="toggleProductVisibility" data-id="${p.id}" data-visible="${p.visible}" title="${p.visible ? 'Скрыть' : 'Показать'}">
                    ${p.visible ? '&#128065;' : '&#128064;'}
                </button>
                <button class="btn-icon" data-action="duplicateProduct" data-id="${p.id}" title="Дублировать">&#128203;</button>
                <button class="btn-icon" data-action="editProduct" data-id="${p.id}" title="Редактировать">&#9998;</button>
                ${showDelete ? `<button class="btn-icon btn-danger" data-action="deleteProduct" data-id="${p.id}" title="Удалить">&#128465;</button>` : ''}
            </div>
        </div>
    `}).join('');

    // Initialize sortable after rendering
    destroyProductsSortable();
    setTimeout(() => initProductsSortable(), 100);
    updateBatchActionsBar();
}

function populateCategorySelects() {
    const filterSelect = document.getElementById('productCategoryFilter');
    const formSelect = document.getElementById('productCategory');

    const options = categoriesData.filter(c => c.visible).map(c =>
        `<option value="${c.id}">${c.name_ru || c.name_en}</option>`
    ).join('');

    const t = typeof uiTranslations !== 'undefined' ? uiTranslations[currentLang] : {};
    filterSelect.innerHTML = `<option value="">${t.allCategories || 'Все категории'}</option>` + options;
    formSelect.innerHTML = `<option value="">${t.selectCategory || '-- Выберите --'}</option>` + options;

    // Add change listener to toggle subcategory type field
    formSelect.removeEventListener('change', handleCategoryChange);
    formSelect.addEventListener('change', handleCategoryChange);
}

function handleCategoryChange(e) {
    toggleSubcategoryTypeField(e.target.value);
}

function toggleSubcategoryTypeField(categoryId) {
    const subcategoryGroup = document.getElementById('subcategoryTypeGroup');
    if (!subcategoryGroup) return;

    // Find category and check if it has subcategories
    const category = categoriesData.find(c => c.id === parseInt(categoryId));
    if (category && category.has_subcategories === 1) {
        subcategoryGroup.style.display = 'block';
    } else {
        subcategoryGroup.style.display = 'none';
        document.getElementById('productSubcategoryType').value = '';
    }
}

function showProductModal(id = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    populateCategorySelects();
    switchProductLang('en');

    if (id) {
        title.textContent = 'Редактировать товар/услугу';
        const p = productsData.find(prod => prod.id === id);
        if (p) {
            document.getElementById('productId').value = p.id;
            document.getElementById('productKey').value = p.product_key;
            document.getElementById('productCategory').value = p.category_id || '';
            document.getElementById('productPrice').value = p.price || '';
            document.getElementById('productSubcategoryType').value = p.subcategory_type || '';

            // Show/hide subcategory type field
            toggleSubcategoryTypeField(p.category_id);

            // Set image preview
            const preview = document.getElementById('productImagePreview');
            if (p.image) {
                preview.innerHTML = `<img src="${p.image}" alt="Preview">`;
            } else {
                preview.innerHTML = '';
            }

            // Set translations
            ['en', 'de', 'ru'].forEach(lang => {
                const t = p.translations?.[lang] || {};
                document.getElementById('productTitle' + capitalize(lang)).value = t.title || '';
                document.getElementById('productSubtitle' + capitalize(lang)).value = t.subtitle || '';
                document.getElementById('productDescription' + capitalize(lang)).value = t.description || '';
                document.getElementById('productAdvantages' + capitalize(lang)).value = t.advantages || '';
                document.getElementById('productSpecs' + capitalize(lang)).value = t.specs || '';
            });
        }
    } else {
        title.textContent = 'Добавить товар/услугу';
        form.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productImagePreview').innerHTML = '';

        // Clear all translation fields
        ['en', 'de', 'ru'].forEach(lang => {
            document.getElementById('productTitle' + capitalize(lang)).value = '';
            document.getElementById('productSubtitle' + capitalize(lang)).value = '';
            document.getElementById('productDescription' + capitalize(lang)).value = '';
            document.getElementById('productAdvantages' + capitalize(lang)).value = '';
            document.getElementById('productSpecs' + capitalize(lang)).value = '';
        });
    }

    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

function editProduct(id) {
    showProductModal(id);
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function switchProductLang(lang) {
    productCurrentLang = lang;
    document.querySelectorAll('#productModal .lang-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === lang.toUpperCase());
    });
    document.querySelectorAll('#productModal .lang-content').forEach(content => {
        content.classList.toggle('active', content.id === 'productLang' + capitalize(lang));
    });
}

function previewProductImage(input) {
    const preview = document.getElementById('productImagePreview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function duplicateProduct(id) {
    const p = productsData.find(prod => prod.id === id);
    if (!p) return;

    // Open modal with product data but without ID (will create new)
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    populateCategorySelects();
    switchProductLang('en');

    title.textContent = 'Дублировать товар/услугу';

    // Clear ID to create new product
    document.getElementById('productId').value = '';
    document.getElementById('productKey').value = p.product_key + '_copy';
    document.getElementById('productCategory').value = p.category_id || '';
    document.getElementById('productPrice').value = p.price || '';

    // Clear image (user needs to upload new one)
    document.getElementById('productImagePreview').innerHTML = '';

    // Copy translations
    ['en', 'de', 'ru'].forEach(lang => {
        const t = p.translations?.[lang] || {};
        document.getElementById('productTitle' + capitalize(lang)).value = t.title ? t.title + ' (копия)' : '';
        document.getElementById('productSubtitle' + capitalize(lang)).value = t.subtitle || '';
        document.getElementById('productDescription' + capitalize(lang)).value = t.description || '';
        document.getElementById('productAdvantages' + capitalize(lang)).value = t.advantages || '';
        document.getElementById('productSpecs' + capitalize(lang)).value = t.specs || '';
    });

    modal.classList.add('active');
    showToast('Копия товара создана. Отредактируйте и сохраните.', 'info');
}

async function toggleProductVisibility(id, current) {
    try {
        await secureFetch(`/api/products/${currentSite}/` + id + '/visibility', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visible: !current })
        });
        loadProducts();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteProduct(id) {
    if (!confirm('Удалить этот товар?')) return;
    try {
        await secureFetch(`/api/products/${currentSite}/` + id, { method: 'DELETE' });
        loadProducts();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;

    // Get current visibility from existing product or default to true for new
    let currentVisible = 1;
    if (id) {
        const prod = productsData.find(p => p.id === parseInt(id));
        if (prod) {
            currentVisible = prod.visible ? 1 : 0;
        }
    }

    const formData = new FormData();
    formData.append('product_key', document.getElementById('productKey').value);
    formData.append('category_id', document.getElementById('productCategory').value);
    formData.append('price', document.getElementById('productPrice').value);
    formData.append('visible', currentVisible.toString());

    // Add subcategory_type if present
    const subcategoryType = document.getElementById('productSubcategoryType').value;
    if (subcategoryType) {
        formData.append('subcategory_type', subcategoryType);
    }

    const imageFile = document.getElementById('productImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const translations = {};
    ['en', 'de', 'ru'].forEach(lang => {
        translations[lang] = {
            title: document.getElementById('productTitle' + capitalize(lang)).value,
            subtitle: document.getElementById('productSubtitle' + capitalize(lang)).value,
            description: document.getElementById('productDescription' + capitalize(lang)).value,
            advantages: document.getElementById('productAdvantages' + capitalize(lang)).value,
            specs: document.getElementById('productSpecs' + capitalize(lang)).value
        };
    });
    formData.append('translations', JSON.stringify(translations));

    const url = id ? `/api/products/${currentSite}/` + id : `/api/products/${currentSite}`;
    const method = id ? 'PUT' : 'POST';

    try {
        await fetch(url, { method, body: formData, credentials: 'include' });
        closeProductModal();
        loadProducts();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadCategoriesForProducts() {
    if (categoriesData.length === 0) {
        await loadCategories();
    }
    populateCategorySelects();
    loadProducts();
}

// ============ ORDERS ============

async function loadOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    const dateFrom = document.getElementById('orderDateFrom')?.value;
    const dateTo = document.getElementById('orderDateTo')?.value;

    let url = `/api/orders/${currentSite}`;
    const params = [];
    if (status !== 'all') params.push(`status=${status}`);
    if (dateFrom) params.push(`from=${dateFrom}`);
    if (dateTo) params.push(`to=${dateTo}`);
    if (params.length > 0) url += '?' + params.join('&');

    try {
        const [ordersRes, statsRes] = await Promise.all([
            fetch(url, { credentials: 'include' }),
            fetch(`/api/orders/${currentSite}/stats`, { credentials: 'include' })
        ]);

        if (ordersRes.ok) {
            ordersData = await ordersRes.json();
            renderOrders();
        }

        if (statsRes.ok) {
            const stats = await statsRes.json();
            document.getElementById('ordersStatNew').textContent = stats.new;
            document.getElementById('ordersStatProgress').textContent = stats.in_progress;
            document.getElementById('ordersStatDone').textContent = stats.completed;
            document.getElementById('ordersTotal').textContent = 'Всего: ' + stats.total;

            // Update badge in sidebar
            const badge = document.getElementById('ordersCount');
            if (stats.new > 0) {
                badge.textContent = stats.new;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrders() {
    const ITEMS_PER_PAGE = 50;
    const currentPage = window.ordersCurrentPage || 1;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const searchInput = document.getElementById("orderSearchInput");
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    // Filter orders by search query
    let filteredOrders = ordersData;
    const totalItems = filteredOrders.length;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
    if (searchQuery) {
        filteredOrders = ordersData.filter(order => {
            const name = (order.name || "").toLowerCase();
            const phone = (order.phone || "").toLowerCase();
            const email = (order.email || "").toLowerCase();
            const product = (order.product || "").toLowerCase();
            return name.includes(searchQuery) || phone.includes(searchQuery) || 
                   email.includes(searchQuery) || product.includes(searchQuery);
        });
    }
    const tbody = document.getElementById('ordersTableBody');
    const t = typeof uiTranslations !== 'undefined' ? uiTranslations[currentLang] : {};
    if (totalItems === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">${t.noOrders || 'Нет заявок'}</td></tr>`;
        return;
    }

    tbody.innerHTML = paginatedOrders.map(o => {
        const statusClass = o.status === 'new' ? 'status-new' :
                            o.status === 'in_progress' ? 'status-progress' : 'status-done';
        const statusText = o.status === 'new' ? (t.statusNew || 'Новая') :
                           o.status === 'in_progress' ? (t.statusInProgress || 'В работе') : (t.statusCompleted || 'Завершена');
        const detailsText = t.details || 'Подробнее';
        return `
        <tr class="${o.status === 'new' ? 'row-new' : ''}">
            <td>${formatDateTime(o.created_at)}</td>
            <td>${o.name || '-'}</td>
            <td><a href="tel:${o.phone}">${o.phone || '-'}</a></td>
            <td>${o.rental_period || '-'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-icon" data-action="showOrderDetails" data-id="${o.id}" title="${detailsText}">&#128065;</button>
            </td>
        </tr>
    `}).join('');
    // Pagination update - see below
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
}

function showOrderDetails(id) {
    currentOrderId = id;
    const order = ordersData.find(o => o.id === id);
    if (!order) return;

    document.getElementById('orderDetailDate').textContent = formatDateTime(order.created_at);
    document.getElementById('orderDetailName').textContent = order.name || '-';
    document.getElementById('orderDetailPhone').textContent = order.phone || '-';
    document.getElementById('orderDetailEmail').textContent = order.email || '-';
    document.getElementById('orderDetailPeriod').textContent = order.rental_period || '-';
    document.getElementById('orderDetailPage').textContent = order.page || '-';
    document.getElementById('orderDetailProduct').textContent = order.product_key || '-';
    document.getElementById('orderDetailComment').textContent = order.comment || '-';
    document.getElementById('orderDetailStatus').value = order.status;
    document.getElementById('orderDetailNotes').value = order.notes || '';

    document.getElementById('orderModal').classList.add('active');
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
    currentOrderId = null;
}

async function saveOrderStatus() {
    if (!currentOrderId) return;
    const status = document.getElementById('orderDetailStatus').value;
    const notes = document.getElementById('orderDetailNotes').value;

    try {
        // Save status
        await secureFetch(`/api/orders/${currentSite}/` + currentOrderId + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        // Save notes
        await secureFetch(`/api/orders/${currentSite}/` + currentOrderId + '/notes', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        showToast('Заявка сохранена', 'success');
        closeOrderModal();
        loadOrders();
    } catch (error) {
        console.error('Error:', error);
        showToast('Ошибка сохранения', 'error');
    }
}

async function deleteCurrentOrder() {
    if (!currentOrderId) return;
    if (!confirm('Удалить эту заявку?')) return;

    try {
        await secureFetch(`/api/orders/${currentSite}/` + currentOrderId, { method: 'DELETE' });
        closeOrderModal();
        loadOrders();
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============ SETTINGS ============

async function loadSettings() {
    try {
        const response = await fetch(`/api/settings/${currentSite}`, { credentials: 'include' });
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('telegramBotToken').value = settings.telegram_bot_token || '';
            document.getElementById('telegramChatId').value = settings.telegram_chat_id || '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    const status = document.getElementById('settingsSaveStatus');

    const data = {
        telegram_bot_token: document.getElementById('telegramBotToken').value,
        telegram_chat_id: document.getElementById('telegramChatId').value
    };

    try {
        const response = await secureFetch(`/api/settings/${currentSite}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            status.textContent = 'Сохранено!';
            status.className = 'save-status success';
        } else {
            status.textContent = 'Ошибка сохранения';
            status.className = 'save-status error';
        }
    } catch (error) {
        status.textContent = 'Ошибка соединения';
        status.className = 'save-status error';
    }

    setTimeout(() => { status.textContent = ''; }, 3000);
}

async function testTelegram() {
    const status = document.getElementById('settingsSaveStatus');

    // First save settings
    const data = {
        telegram_bot_token: document.getElementById('telegramBotToken').value,
        telegram_chat_id: document.getElementById('telegramChatId').value
    };

    if (!data.telegram_bot_token || !data.telegram_chat_id) {
        status.textContent = 'Заполните токен и Chat ID';
        status.className = 'save-status error';
        setTimeout(() => { status.textContent = ''; }, 3000);
        return;
    }

    try {
        // Save first
        await secureFetch(`/api/settings/${currentSite}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        // Test
        status.textContent = 'Отправка...';
        status.className = 'save-status';

        const response = await secureFetch(`/api/settings/${currentSite}/test-telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();
        if (result.success) {
            status.textContent = 'Тестовое сообщение отправлено!';
            status.className = 'save-status success';
        } else {
            status.textContent = result.error || 'Ошибка отправки';
            status.className = 'save-status error';
        }
    } catch (error) {
        status.textContent = 'Ошибка соединения';
        status.className = 'save-status error';
    }

    setTimeout(() => { status.textContent = ''; }, 5000);
}

// ============ USERS ============

async function loadUsers() {
    try {
        const response = await secureFetch('/api/users');
        if (response.ok) {
            usersData = await response.json();
            renderUsers();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (usersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Нет пользователей</td></tr>';
        return;
    }

    tbody.innerHTML = usersData.map(u => {
        const roleText = u.role === 'admin' ? 'Администратор' : 'Бухгалтер';
        const roleClass = u.role === 'admin' ? 'role-admin' : 'role-accountant';
        return `
        <tr>
            <td><strong>${u.username}</strong></td>
            <td><span class="role-badge ${roleClass}">${roleText}</span></td>
            <td>${formatDate(u.created_at)}</td>
            <td>
                <button class="btn-icon" data-action="showPasswordModal" data-id="${u.id}" title="Сменить пароль">&#128273;</button>
                <button class="btn-icon" data-action="editUser" data-id="${u.id}" title="Редактировать">&#9998;</button>
                <button class="btn-icon btn-danger" data-action="deleteUser" data-id="${u.id}" title="Удалить">&#128465;</button>
            </td>
        </tr>
    `}).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
}

function showUserModal(id = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    const passwordGroup = document.getElementById('userPasswordGroup');
    const usernameInput = document.getElementById('userUsername');

    if (id) {
        title.textContent = 'Редактировать пользователя';
        const user = usersData.find(u => u.id === id);
        if (user) {
            document.getElementById('userId').value = user.id;
            document.getElementById('userUsername').value = user.username;
            document.getElementById('userRole').value = user.role;
            usernameInput.readOnly = true;
            passwordGroup.style.display = 'none';
        }
    } else {
        title.textContent = 'Добавить пользователя';
        form.reset();
        document.getElementById('userId').value = '';
        usernameInput.readOnly = false;
        passwordGroup.style.display = 'block';
        document.getElementById('userPassword').required = true;
    }
    modal.classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

function editUser(id) {
    showUserModal(id);
}

async function deleteUser(id) {
    if (!confirm('Удалить этого пользователя?')) return;
    try {
        const response = await secureFetch('/api/users/' + id, { method: 'DELETE' });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
        } else {
            loadUsers();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleUserSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('userId').value;

    if (id) {
        // Update role only
        const data = {
            role: document.getElementById('userRole').value
        };
        try {
            const response = await secureFetch('/api/users/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.error) {
                alert(result.error);
            } else {
                closeUserModal();
                loadUsers();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    } else {
        // Create new user
        const data = {
            username: document.getElementById('userUsername').value,
            password: document.getElementById('userPassword').value,
            role: document.getElementById('userRole').value
        };
        try {
            const response = await secureFetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.error) {
                alert(result.error);
            } else {
                closeUserModal();
                loadUsers();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

function showPasswordModal(id) {
    document.getElementById('passwordUserId').value = id;
    document.getElementById('newPassword').value = '';
    document.getElementById('passwordModal').classList.add('active');
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
}

async function handlePasswordSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('passwordUserId').value;
    const password = document.getElementById('newPassword').value;

    try {
        const response = await secureFetch('/api/users/' + id + '/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const result = await response.json();
        if (result.error) {
            showToast(result.error, 'error');
        } else {
            closePasswordModal();
            showToast('Пароль изменён', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// ============ TOAST NOTIFICATIONS ============

function showToast(message, type = 'info') {
    // Create container if doesn't exist
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============ AUTO-REFRESH ORDERS ============

let ordersAutoRefreshInterval = null;
let lastOrdersCount = 0;
let originalTitle = document.title;

function startOrdersAutoRefresh() {
    // Only start if not already running
    if (ordersAutoRefreshInterval) return;

    ordersAutoRefreshInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/orders/${currentSite}/stats`, { credentials: 'include' });
            if (response.ok) {
                const stats = await response.json();

                // Update badge in sidebar
                const badge = document.getElementById('ordersCount');
                if (stats.new > 0) {
                    badge.textContent = stats.new;
                    badge.style.display = 'inline';

                    // Update page title with badge
                    document.title = `(${stats.new}) ${originalTitle}`;

                    // If new orders appeared, show notification
                    if (stats.new > lastOrdersCount && lastOrdersCount > 0) {
                        showToast(`Новая заявка! Всего: ${stats.new}`, 'success');
                        playNotificationSound();

                        // Show browser notification
                        showBrowserNotification('Новая заявка', `Поступила новая заявка. Всего новых: ${stats.new}`);
                    }
                } else {
                    badge.style.display = 'none';
                    document.title = originalTitle;
                }

                lastOrdersCount = stats.new;

                // Update stats if on orders section
                const ordersSection = document.getElementById('section-orders');
                if (ordersSection && ordersSection.classList.contains('active')) {
                    document.getElementById('ordersStatNew').textContent = stats.new;
                    document.getElementById('ordersStatProgress').textContent = stats.in_progress;
                    document.getElementById('ordersStatDone').textContent = stats.completed;
                    document.getElementById('ordersTotal').textContent = 'Всего: ' + stats.total;
                }
            }
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }, 30000); // Every 30 seconds
}

function stopOrdersAutoRefresh() {
    if (ordersAutoRefreshInterval) {
        clearInterval(ordersAutoRefreshInterval);
        ordersAutoRefreshInterval = null;
    }
}

// Play notification sound
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC8NP5fO3a1rGgU0teleq3szIk+x7duXTC4gY7vw0YJIJiZbuubCb0ApNmu67sSCUDA+eM3oxH1GOEyEz+3HeU5HTobP6cF0R0pKh8/pwHJGSEiHz+q/cUVGRofQ6r5wRERFh9Hrvm9DQkOI0uy+bkFAQYnT7L1tP0E/itTsvWw+PT6L1e29az08PYvW7r1qPDo7jNfuvWk7ODmM2O+9aDk2N43Z8L1nODQ1jtr');
        audio.volume = 0.5;
        audio.play().catch(() => {}); // Ignore errors if autoplay blocked
    } catch (e) {
        // Audio not supported
    }
}

// Browser notifications
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function showBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/images/Logo-clean.png',
            tag: 'new-order'
        });
    }
}

// ============ KEYBOARD SHORTCUTS ============

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Esc - close any open modal
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            }
        }

        // Ctrl+S - save active form
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                const form = activeModal.querySelector('form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            } else {
                // Check for visible forms on page
                const contactsForm = document.getElementById('contactsForm');
                const settingsForm = document.getElementById('settingsForm');
                const activeSection = document.querySelector('.content-section.active');

                if (activeSection?.id === 'section-contacts' && contactsForm) {
                    contactsForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                } else if (activeSection?.id === 'section-settings' && settingsForm) {
                    settingsForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }
        }
    });
}

// ============ EXPORT TO CSV ============

function exportOrdersToCSV() {
    if (totalItems === 0) {
        showToast('Нет заявок для экспорта', 'error');
        return;
    }

    const headers = ['Дата', 'Имя', 'Телефон', 'Email', 'Период', 'Страница', 'Товар', 'Комментарий', 'Статус'];
    const statusMap = {
        'new': 'Новая',
        'in_progress': 'В работе',
        'completed': 'Завершена'
    };

    const rows = ordersData.map(o => [
        formatDateTime(o.created_at),
        o.name || '',
        o.phone || '',
        o.email || '',
        o.rental_period || '',
        o.page || '',
        o.product_key || '',
        (o.comment || '').replace(/"/g, '""'),
        statusMap[o.status] || o.status
    ]);

    // Build CSV content
    let csv = '\uFEFF'; // BOM for Excel
    csv += headers.join(';') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(';') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders_${currentSite}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Экспорт завершен', 'success');
}

// ============ DARK THEME ============

function initThemeToggle() {
    // Check saved theme
    const savedTheme = localStorage.getItem('adminTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Create toggle button if not exists
    const topBar = document.querySelector('.top-bar');
    const topBarTitle = document.querySelector('.top-bar-title');

    if (topBar && !document.querySelector('.theme-toggle')) {
        const themeBtn = document.createElement('button');
        themeBtn.className = 'theme-toggle';
        themeBtn.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
        themeBtn.title = savedTheme === 'dark' ? 'Светлая тема' : 'Темная тема';
        themeBtn.onclick = toggleTheme;

        // Insert before lang switcher
        const langSwitcher = document.querySelector('.lang-switcher');
        if (langSwitcher) {
            langSwitcher.parentNode.insertBefore(themeBtn, langSwitcher);
        } else {
            topBar.insertBefore(themeBtn, topBarTitle.nextSibling);
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('adminTheme', newTheme);

    // Update button
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
        themeBtn.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        themeBtn.title = newTheme === 'dark' ? 'Светлая тема' : 'Темная тема';
    }

    showToast(newTheme === 'dark' ? 'Темная тема включена' : 'Светлая тема включена', 'info');
}

// ============ GLOBAL SEARCH ============

function initGlobalSearch() {
    const topBar = document.querySelector('.top-bar');
    const topBarTitle = document.querySelector('.top-bar-title');

    if (topBar && !document.querySelector('.global-search')) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'global-search';
        searchContainer.innerHTML = `
            <input type="text" id="globalSearchInput" placeholder="Поиск..." autocomplete="off">
            <div class="search-results-dropdown" id="searchResultsDropdown"></div>
        `;

        // Insert after site selector
        const siteSelector = document.getElementById('siteSelector');
        if (siteSelector) {
            siteSelector.parentNode.insertBefore(searchContainer, siteSelector.nextSibling);
        } else {
            topBar.insertBefore(searchContainer, topBarTitle.nextSibling);
        }

        // Add event listeners
        const input = document.getElementById('globalSearchInput');
        const dropdown = document.getElementById('searchResultsDropdown');

        input.addEventListener('input', debounce(performGlobalSearch, 300));
        input.addEventListener('focus', () => {
            if (dropdown.children.length > 0) {
                dropdown.classList.add('active');
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchContainer.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function performGlobalSearch() {
    const query = document.getElementById('globalSearchInput').value.trim().toLowerCase();
    const dropdown = document.getElementById('searchResultsDropdown');

    if (query.length < 2) {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
        return;
    }

    const results = [];

    // Search in products
    if (productsData.length > 0) {
        productsData.forEach(p => {
            const title = p.translations?.ru?.title || p.translations?.en?.title || p.product_key;
            const subtitle = p.translations?.ru?.subtitle || p.translations?.en?.subtitle || '';
            if (title.toLowerCase().includes(query) || subtitle.toLowerCase().includes(query) || p.product_key.toLowerCase().includes(query)) {
                results.push({
                    type: 'Товар',
                    title: title,
                    subtitle: subtitle,
                    action: () => {
                        navigateToSection('products');
                        setTimeout(() => editProduct(p.id), 300);
                    }
                });
            }
        });
    }

    // Search in categories
    if (categoriesData.length > 0) {
        categoriesData.forEach(c => {
            const name = c.name_ru || c.name_en;
            if (name.toLowerCase().includes(query) || c.key.toLowerCase().includes(query)) {
                results.push({
                    type: 'Категория',
                    title: name,
                    subtitle: c.key,
                    action: () => {
                        navigateToSection('categories');
                        setTimeout(() => editCategory(c.id), 300);
                    }
                });
            }
        });
    }

    // Search in orders
    if (ordersData.length > 0) {
        ordersData.forEach(o => {
            if (o.name?.toLowerCase().includes(query) || o.phone?.includes(query) || o.email?.toLowerCase().includes(query)) {
                results.push({
                    type: 'Заявка',
                    title: o.name || 'Без имени',
                    subtitle: `${o.phone || ''} - ${formatDateTime(o.created_at)}`,
                    action: () => {
                        navigateToSection('orders');
                        setTimeout(() => showOrderDetails(o.id), 300);
                    }
                });
            }
        });
    }

    // Render results
    if (results.length > 0) {
        dropdown.innerHTML = results.slice(0, 10).map((r, i) => `
            <div class="search-result-item" data-index="${i}">
                <div class="search-result-type">${r.type}</div>
                <div class="search-result-title">${r.title}</div>
                ${r.subtitle ? `<div class="search-result-subtitle">${r.subtitle}</div>` : ''}
            </div>
        `).join('');

        dropdown.classList.add('active');

        // Add click handlers
        dropdown.querySelectorAll('.search-result-item').forEach((item, i) => {
            item.onclick = () => {
                results[i].action();
                dropdown.classList.remove('active');
                document.getElementById('globalSearchInput').value = '';
            };
        });
    } else {
        dropdown.innerHTML = '<div class="search-result-item"><div class="search-result-title">Ничего не найдено</div></div>';
        dropdown.classList.add('active');
    }
}

function navigateToSection(section) {
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navLink = document.querySelector(`[data-section="${section}"]`);
    if (navLink) {
        navLink.parentElement.classList.add('active');
    }

    // Show section
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + section).classList.add('active');

    // Load section data
    if (section === 'contacts') loadContacts();
    else if (section === 'categories') loadCategories();
    else if (section === 'hexagons') loadHexagons();
    else if (section === 'products') loadCategoriesForProducts();
    else if (section === 'orders') loadOrders();
    else if (section === 'settings') loadSettings();
    else if (section === 'users') loadUsers();
    else if (section === 'audit') { loadAuditLog(); initAuditFilters(); }
}

// ============ AUDIT LOG ============

let auditData = [];
let currentAuditOffset = 0;
let totalAuditCount = 0;

async function loadAuditLog(offset = 0) {
    if (offset < 0) offset = 0;
    currentAuditOffset = offset;

    const actionFilter = document.getElementById('auditActionFilter')?.value || '';
    const entityFilter = document.getElementById('auditEntityFilter')?.value || '';

    try {
        let url = `/api/audit?limit=50&offset=${offset}`;
        if (actionFilter) url += `&action=${encodeURIComponent(actionFilter)}`;
        if (entityFilter) url += `&entity_type=${encodeURIComponent(entityFilter)}`;

        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) {
            const result = await response.json();
            auditData = result.data;
            totalAuditCount = result.total;
            renderAuditLog();
            loadAuditFilters();
        }
    } catch (error) {
        console.error('Error loading audit log:', error);
    }
}

async function loadAuditFilters() {
    try {
        // Load actions
        const actionsRes = await fetch('/api/audit/actions', { credentials: 'include' });
        if (actionsRes.ok) {
            const actions = await actionsRes.json();
            const actionSelect = document.getElementById('auditActionFilter');
            const currentValue = actionSelect.value;
            actionSelect.innerHTML = '<option value="">Все действия</option>' +
                actions.map(a => `<option value="${a}" ${a === currentValue ? 'selected' : ''}>${getActionLabel(a)}</option>`).join('');
        }

        // Load entities
        const entitiesRes = await fetch('/api/audit/entities', { credentials: 'include' });
        if (entitiesRes.ok) {
            const entities = await entitiesRes.json();
            const entitySelect = document.getElementById('auditEntityFilter');
            const currentValue = entitySelect.value;
            entitySelect.innerHTML = '<option value="">Все объекты</option>' +
                entities.map(e => `<option value="${e}" ${e === currentValue ? 'selected' : ''}>${getEntityLabel(e)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading audit filters:', error);
    }
}

function getActionLabel(action) {
    const labels = {
        'login': 'Вход в систему',
        'logout': 'Выход',
        'create': 'Создание',
        'update': 'Редактирование',
        'delete': 'Удаление',
        'visibility_change': 'Изменение видимости',
        'status_change': 'Изменение статуса',
        'batch_update': 'Массовое обновление',
        'batch_delete': 'Массовое удаление'
    };
    return labels[action] || action;
}

function getEntityLabel(entity) {
    const labels = {
        'product': 'Товар',
        'category': 'Категория',
        'order': 'Заявка',
        'user': 'Пользователь',
        'contact': 'Контакты',
        'settings': 'Настройки'
    };
    return labels[entity] || entity;
}

function renderAuditLog() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    if (auditData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Нет записей</td></tr>';
        return;
    }

    tbody.innerHTML = auditData.map(log => `
        <tr>
            <td>${formatDateTime(log.created_at)}</td>
            <td><span class="audit-user">${log.username || 'Система'}</span></td>
            <td><span class="audit-action audit-action-${log.action}">${getActionLabel(log.action)}</span></td>
            <td>
                ${log.entity_type ? `<span class="audit-entity">${getEntityLabel(log.entity_type)}</span>` : '-'}
                ${log.entity_name ? `<br><small>${log.entity_name}</small>` : ''}
            </td>
            <td><small>${log.details || '-'}</small></td>
        </tr>
    `).join('');

    // Update pagination
    const prevBtn = document.getElementById('auditPrevBtn');
    const nextBtn = document.getElementById('auditNextBtn');
    const pageInfo = document.getElementById('auditPageInfo');

    if (prevBtn) prevBtn.disabled = currentAuditOffset === 0;
    if (nextBtn) nextBtn.disabled = currentAuditOffset + 50 >= totalAuditCount;

    const from = currentAuditOffset + 1;
    const to = Math.min(currentAuditOffset + 50, totalAuditCount);
    if (pageInfo) pageInfo.textContent = `${from}-${to} из ${totalAuditCount}`;
}

function initAuditFilters() {
    const actionFilter = document.getElementById('auditActionFilter');
    const entityFilter = document.getElementById('auditEntityFilter');

    if (actionFilter) {
        actionFilter.addEventListener('change', () => loadAuditLog(0));
    }
    if (entityFilter) {
        entityFilter.addEventListener('change', () => loadAuditLog(0));
    }
}

// ============ BATCH OPERATIONS ============

let selectedProductIds = [];

function updateBatchActionsBar() {
    const checkboxes = document.querySelectorAll('.product-checkbox:checked');
    selectedProductIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));

    let bar = document.getElementById('batchActionsBar');

    if (selectedProductIds.length > 0) {
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'batchActionsBar';
            bar.className = 'batch-actions-bar';
            bar.innerHTML = `
                <span class="batch-count"><span id="batchSelectedCount">0</span> выбрано</span>
                <div class="batch-buttons">
                    <button class="btn btn-sm" onclick="batchSelectAll()">Выбрать все</button>
                    <button class="btn btn-sm" onclick="batchDeselectAll()">Снять выбор</button>
                    <button class="btn btn-sm btn-secondary" onclick="batchHideProducts()">Скрыть</button>
                    <button class="btn btn-sm btn-secondary" onclick="batchShowProducts()">Показать</button>
                    <button class="btn btn-sm btn-secondary" onclick="showBatchCategoryModal()">Сменить категорию</button>
                    ${canDeleteProducts() ? '<button class="btn btn-sm btn-danger" onclick="batchDeleteProducts()">Удалить</button>' : ''}
                </div>
            `;
            document.body.appendChild(bar);
        }
        document.getElementById('batchSelectedCount').textContent = selectedProductIds.length;
        bar.classList.add('active');
    } else if (bar) {
        bar.classList.remove('active');
    }
}

function batchSelectAll() {
    document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = true);
    updateBatchActionsBar();
}

function batchDeselectAll() {
    document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = false);
    updateBatchActionsBar();
}

async function batchHideProducts() {
    if (selectedProductIds.length === 0) return;

    try {
        const response = await secureFetch(`/api/products/${currentSite}/batch/visibility`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedProductIds, visible: false })
        });

        if (response.ok) {
            showToast(`${selectedProductIds.length} товаров скрыто`, 'success');
            batchDeselectAll();
            loadProducts();
        } else {
            showToast('Ошибка выполнения операции', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

async function batchShowProducts() {
    if (selectedProductIds.length === 0) return;

    try {
        const response = await secureFetch(`/api/products/${currentSite}/batch/visibility`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedProductIds, visible: true })
        });

        if (response.ok) {
            showToast(`${selectedProductIds.length} товаров показано`, 'success');
            batchDeselectAll();
            loadProducts();
        } else {
            showToast('Ошибка выполнения операции', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

async function batchDeleteProducts() {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Удалить ${selectedProductIds.length} товаров? Это действие нельзя отменить.`)) return;

    try {
        const response = await secureFetch(`/api/products/${currentSite}/batch/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedProductIds })
        });

        if (response.ok) {
            showToast(`${selectedProductIds.length} товаров удалено`, 'success');
            batchDeselectAll();
            loadProducts();
        } else {
            showToast('Ошибка удаления', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

function showBatchCategoryModal() {
    if (selectedProductIds.length === 0) return;

    // Create modal dynamically
    let modal = document.getElementById('batchCategoryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'batchCategoryModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Сменить категорию</h3>
                    <button class="modal-close" onclick="closeBatchCategoryModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Выбрано товаров: <strong id="batchCategoryCount">0</strong></p>
                    <div class="form-group">
                        <label>Новая категория</label>
                        <select id="batchCategorySelect" class="filter-select">
                            <option value="">-- Выберите --</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeBatchCategoryModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="applyBatchCategory()">Применить</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Populate categories
    const select = document.getElementById('batchCategorySelect');
    select.innerHTML = '<option value="">-- Выберите --</option>' +
        categoriesData.filter(c => c.visible).map(c =>
            `<option value="${c.id}">${c.name_ru || c.name_en}</option>`
        ).join('');

    document.getElementById('batchCategoryCount').textContent = selectedProductIds.length;
    modal.classList.add('active');
}

function closeBatchCategoryModal() {
    const modal = document.getElementById('batchCategoryModal');
    if (modal) modal.classList.remove('active');
}

async function applyBatchCategory() {
    const categoryId = document.getElementById('batchCategorySelect').value;
    if (!categoryId) {
        showToast('Выберите категорию', 'error');
        return;
    }

    try {
        const response = await secureFetch(`/api/products/${currentSite}/batch/category`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedProductIds, category_id: parseInt(categoryId) })
        });

        if (response.ok) {
            showToast(`Категория изменена для ${selectedProductIds.length} товаров`, 'success');
            closeBatchCategoryModal();
            batchDeselectAll();
            loadProducts();
        } else {
            showToast('Ошибка выполнения операции', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// ============ STATISTICS AND CHARTS ============

let ordersChart = null;

async function loadDashboardCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }

    try {
        // Load orders chart data
        const chartResponse = await fetch(`/api/orders/${currentSite}/stats/chart`, { credentials: 'include' });
        if (chartResponse.ok) {
            const chartData = await chartResponse.json();
            renderOrdersChart(chartData);
        }

        // Load popular products
        const popularResponse = await fetch(`/api/orders/${currentSite}/stats/popular`, { credentials: 'include' });
        if (popularResponse.ok) {
            const popularData = await popularResponse.json();
            renderPopularProducts(popularData);
        }
    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

function renderOrdersChart(data) {
    const canvas = document.getElementById('ordersChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if exists
    if (ordersChart) {
        ordersChart.destroy();
    }

    // Format dates for display
    const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    });

    const counts = data.map(d => d.count);

    // Determine if dark theme is active
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#c9d1d9' : '#1a1a2e';
    const gridColor = isDark ? '#30363d' : '#e9ecef';

    ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Заявки',
                data: counts,
                borderColor: '#d4a039',
                backgroundColor: 'rgba(212, 160, 57, 0.1)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#d4a039',
                pointBorderColor: '#d4a039',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isDark ? '#161b22' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderPopularProducts(data) {
    const container = document.getElementById('popularProductsList');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = '<p class="empty-message">Нет данных</p>';
        return;
    }

    const maxCount = Math.max(...data.map(d => d.count));

    container.innerHTML = data.map((item, index) => {
        const percentage = (item.count / maxCount) * 100;
        return `
            <div class="popular-product-item">
                <div class="popular-product-rank">#${index + 1}</div>
                <div class="popular-product-info">
                    <span class="popular-product-name">${item.product_key}</span>
                    <div class="popular-product-bar">
                        <div class="popular-product-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <span class="popular-product-count">${item.count}</span>
            </div>
        `;
    }).join('');
}

// ============ DRAG AND DROP SORTING ============

let categoriesSortable = null;
let productsSortable = null;

function initDragAndDrop() {
    // Will be initialized when sections are rendered
}

function initCategoriesSortable() {
    const categoriesList = document.getElementById('categoriesList');
    if (!categoriesList || categoriesSortable) return;

    // Check if Sortable is loaded
    if (typeof Sortable === 'undefined') {
        console.warn('Sortable.js not loaded');
        return;
    }

    categoriesSortable = new Sortable(categoriesList, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: async function(evt) {
            const items = categoriesList.querySelectorAll('.category-item');
            const order = Array.from(items).map((item, index) => ({
                id: parseInt(item.dataset.id),
                sort_order: index
            }));

            try {
                const response = await secureFetch(`/api/categories/${currentSite}/reorder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order })
                });

                if (response.ok) {
                    showToast('Порядок сохранён', 'success');
                } else {
                    showToast('Ошибка сохранения порядка', 'error');
                    loadCategories(); // Reload to restore order
                }
            } catch (error) {
                console.error('Error saving category order:', error);
                showToast('Ошибка сохранения', 'error');
            }
        }
    });
}

function initProductsSortable() {
    const productsList = document.getElementById('productsList');
    if (!productsList || productsSortable) return;

    if (typeof Sortable === 'undefined') {
        console.warn('Sortable.js not loaded');
        return;
    }

    productsSortable = new Sortable(productsList, {
        animation: 150,
        handle: '.product-drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: async function(evt) {
            const items = productsList.querySelectorAll('.product-card');
            const order = Array.from(items).map((item, index) => ({
                id: parseInt(item.dataset.id),
                sort_order: index
            }));

            try {
                const response = await secureFetch(`/api/products/${currentSite}/reorder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order })
                });

                if (response.ok) {
                    showToast('Порядок сохранён', 'success');
                } else {
                    showToast('Ошибка сохранения порядка', 'error');
                    loadProducts();
                }
            } catch (error) {
                console.error('Error saving product order:', error);
                showToast('Ошибка сохранения', 'error');
            }
        }
    });
}

// Destroy sortable instances when needed
function destroyCategoriesSortable() {
    if (categoriesSortable) {
        categoriesSortable.destroy();
        categoriesSortable = null;
    }
}

function destroyProductsSortable() {
    if (productsSortable) {
        productsSortable.destroy();
        productsSortable = null;
    }
}

// ============ DATE FILTERS ============

function initDateFilters() {
    // Create date filter inputs if they don't exist
    const ordersHeader = document.querySelector('#section-orders .card-header');
    if (ordersHeader && !document.getElementById('orderDateFrom')) {
        const filterContainer = ordersHeader.querySelector('.products-filter') || document.createElement('div');
        if (!filterContainer.classList.contains('products-filter')) {
            filterContainer.className = 'products-filter';
            const statusFilter = ordersHeader.querySelector('.filter-select');
            if (statusFilter) {
                statusFilter.parentNode.insertBefore(filterContainer, statusFilter);
                filterContainer.appendChild(statusFilter);
            }
        }

        // Add date inputs
        const dateFromInput = document.createElement('input');
        dateFromInput.type = 'date';
        dateFromInput.id = 'orderDateFrom';
        dateFromInput.className = 'filter-select';
        dateFromInput.style.minWidth = '140px';
        dateFromInput.title = 'От даты';
        dateFromInput.addEventListener('change', loadOrders);

        const dateToInput = document.createElement('input');
        dateToInput.type = 'date';
        dateToInput.id = 'orderDateTo';
        dateToInput.className = 'filter-select';
        dateToInput.style.minWidth = '140px';
        dateToInput.title = 'До даты';
        dateToInput.addEventListener('change', loadOrders);

        // Add export button
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-sm btn-secondary';
        exportBtn.innerHTML = '📥 CSV';
        exportBtn.title = 'Экспорт в CSV';
        exportBtn.onclick = exportOrdersToCSV;

        filterContainer.appendChild(dateFromInput);
        filterContainer.appendChild(dateToInput);
        filterContainer.appendChild(exportBtn);
    }
}
