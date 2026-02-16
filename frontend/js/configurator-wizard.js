/**
 * Configurator Wizard — Sky Template (Premium Edition)
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';
    const SITE_KEY = CONFIG.SITE_KEY || 'mybusiness';
    const STEPS = { SITE_TYPE: 1, MODULES: 2, SUMMARY: 3, CONTACT: 4 };

    const CURRENCIES = {
        EUR: { symbol: '€', rate: 1 },
        USD: { symbol: '$', rate: 1.08 },
        RUB: { symbol: '₽', rate: 105 }
    };

    function fmtPrice(eurAmount, opts = {}) {
        const cur = CURRENCIES[state.currency] || CURRENCIES.EUR;
        const converted = Math.round(eurAmount * cur.rate);
        const prefix = opts.plus ? '+' : '';
        const minus = opts.minus ? '−' : '';
        return `${minus}${prefix}${cur.symbol}${converted}`;
    }

    let state = {
        currentStep: STEPS.SITE_TYPE,
        selectedSiteType: null,
        selectedModules: [],
        selectedPackage: null,
        botConfig: { tierId: 'basic', addons: [] },
        contactData: {},
        modulesData: null,
        viewingDetail: false,
        currency: localStorage.getItem('sky_currency') || 'EUR',
        modalSetup: false
    };

    const wizardContent = document.getElementById('wizardContent');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const nav = document.getElementById('wizardNavigation');

    async function init() {
        try {
            state.modulesData = await loadModulesData();
            loadStateFromStorage();
            renderCurrencySwitcher();
            renderStep(state.currentStep);
            updateUI();
            setupNavigation();
        } catch (error) {
            console.error('Wizard init failed:', error);
            wizardContent.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-light);">Failed to load. Please refresh.</div>';
        }
    }

    function lang() {
        return (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';
    }

    function loc(obj, field) {
        return obj[`${field}_${lang()}`] || obj[`${field}_en`] || obj[field] || '';
    }

    const labels = () => {
        const m = {
            en: { from:'from',more:'Learn more',back:'Back to list',included:"What's included",choose:'Select & continue',timeline:'Delivery',popular:'Most popular',fast:'Fastest',modules_title:'Enhance your site',modules_sub:'Select additional modules to extend functionality',rec_for:'Recommended for your',other_modules:'Additional modules',total_base:'Base',total_modules:'Modules',total:'Total',contact_title:'Your contact details',contact_sub:'We will reach out to discuss the details',name:'Name',phone:'Phone',email:'Email (optional)',name_ph:'Your name',phone_ph:'+7 XXX XXX XX XX',email_ph:'your@email.com',name_err:'Minimum 2 characters',phone_err:'Minimum 9 digits',sum_type:'Site type',sum_mod:'Selected modules',sum_contact:'Contact details',sum_total:'Total',no_mod:'No additional modules',submit:'Send request',sending:'Sending...',ok_title:'Thank you!',ok_msg:'We received your configuration and will contact you shortly.',prev:'Back',next:'Next',you_are_here:'You are here',step1:'Site Type',step2:'Modules',step3:'Contact',step4:'Summary',pkg_title:'Choose a package',pkg_sub:'Quick start — or customize below',pkg_recommended:'Recommended',pkg_save:'Save',pkg_custom:'or customize modules individually below',vat_notice:'Final price is calculated for the European market and includes applicable taxes. For other regions — contact our manager.',sum_package:'Package',sum_discount:'Package discount',bot_level:'Choose bot level',bot_addons:'Additional features',bot_boost:'Boost conversion 15–30% with messenger automation',bot_tier:'Bot tier',bot_features:'Bot features',apply:'Add to project',applied:'Added ✓',cart_title:'Your project',cart_add_hint:'Add modules →' },
            de: { from:'ab',more:'Mehr erfahren',back:'Zurück zur Liste',included:'Was ist enthalten',choose:'Auswählen & weiter',timeline:'Lieferzeit',popular:'Beliebteste',fast:'Schnellste',modules_title:'Erweitern Sie Ihre Website',modules_sub:'Wählen Sie Module für zusätzliche Funktionen',rec_for:'Empfohlen für Ihren',other_modules:'Weitere Module',total_base:'Basis',total_modules:'Module',total:'Gesamt',contact_title:'Ihre Kontaktdaten',contact_sub:'Wir melden uns bei Ihnen',name:'Name',phone:'Telefon',email:'E-Mail (optional)',name_ph:'Ihr Name',phone_ph:'+7 XXX XXX XX XX',email_ph:'ihre@email.com',name_err:'Mindestens 2 Zeichen',phone_err:'Mindestens 9 Ziffern',sum_type:'Website-Typ',sum_mod:'Gewählte Module',sum_contact:'Kontaktdaten',sum_total:'Gesamt',no_mod:'Keine zusätzlichen Module',submit:'Anfrage senden',sending:'Senden...',ok_title:'Vielen Dank!',ok_msg:'Wir haben Ihre Konfiguration erhalten und melden uns bei Ihnen.',prev:'Zurück',next:'Weiter',you_are_here:'Sie sind hier',step1:'Website-Typ',step2:'Module',step3:'Kontakt',step4:'Zusammenfassung',pkg_title:'Paket wählen',pkg_sub:'Schnellstart — oder unten anpassen',pkg_recommended:'Empfohlen',pkg_save:'Sparen',pkg_custom:'oder Module unten individuell anpassen',vat_notice:'Der Endpreis gilt für den europäischen Markt und enthält die anfallenden Steuern. Für andere Regionen — kontaktieren Sie unseren Manager.',sum_package:'Paket',sum_discount:'Paketrabatt',bot_level:'Bot-Level wählen',bot_addons:'Zusätzliche Funktionen',bot_boost:'Conversion um 15–30% steigern durch Messenger-Automatisierung',bot_tier:'Bot-Level',bot_features:'Bot-Funktionen',apply:'Zum Projekt',applied:'Hinzugefügt ✓',cart_title:'Ihr Projekt',cart_add_hint:'Module hinzufügen →' },
            ru: { from:'от',more:'Подробнее',back:'Назад к списку',included:'Что входит',choose:'Выбрать и продолжить',timeline:'Срок',popular:'Самый популярный',fast:'Самый быстрый',modules_title:'Расширьте возможности',modules_sub:'Выберите дополнительные модули для вашего сайта',rec_for:'Рекомендуем для вашего',other_modules:'Дополнительные модули',total_base:'База',total_modules:'Модули',total:'Итого',contact_title:'Ваши контактные данные',contact_sub:'Мы свяжемся с вами для обсуждения деталей',name:'Имя',phone:'Телефон',email:'Email (необязательно)',name_ph:'Ваше имя',phone_ph:'+7 XXX XXX XX XX',email_ph:'ваш@email.com',name_err:'Минимум 2 символа',phone_err:'Минимум 9 цифр',sum_type:'Тип сайта',sum_mod:'Выбранные модули',sum_contact:'Контактные данные',sum_total:'Итого',no_mod:'Без дополнительных модулей',submit:'Отправить заявку',sending:'Отправка...',ok_title:'Спасибо!',ok_msg:'Мы получили вашу конфигурацию и свяжемся с вами в ближайшее время.',prev:'Назад',next:'Далее',you_are_here:'Вы здесь',step1:'Тип сайта',step2:'Модули',step3:'Контакты',step4:'Итог',pkg_title:'Выберите пакет',pkg_sub:'Быстрый старт — или настройте модули ниже',pkg_recommended:'Рекомендуем',pkg_save:'Экономия',pkg_custom:'или настройте модули индивидуально ниже',vat_notice:'Итоговая цена рассчитана для европейского рынка и включает применимые налоги. Для других регионов — свяжитесь с менеджером.',sum_package:'Пакет',sum_discount:'Скидка за пакет',bot_level:'Выберите уровень бота',bot_addons:'Дополнительные функции',bot_boost:'Увеличьте конверсию на 15–30% с автоматизацией в мессенджере',bot_tier:'Уровень бота',bot_features:'Функции бота',apply:'Добавить',applied:'Добавлено ✓',cart_title:'Ваш проект',cart_add_hint:'Добавьте модули →' }
        };
        return m[lang()] || m.en;
    };

    function renderCurrencySwitcher() {
        const header = document.querySelector('.wizard-header');
        if (!header || document.getElementById('currencySwitcher')) return;
        const switcher = document.createElement('div');
        switcher.className = 'currency-switcher';
        switcher.id = 'currencySwitcher';
        switcher.innerHTML = Object.keys(CURRENCIES).map(code => {
            const cur = CURRENCIES[code];
            return `<button class="currency-btn ${code === state.currency ? 'active' : ''}" data-currency="${code}">${cur.symbol} ${code}</button>`;
        }).join('');
        header.appendChild(switcher);

        switcher.addEventListener('click', (e) => {
            const btn = e.target.closest('.currency-btn');
            if (!btn) return;
            state.currency = btn.dataset.currency;
            localStorage.setItem('sky_currency', state.currency);
            switcher.querySelectorAll('.currency-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.currency === state.currency)
            );
            renderStep(state.currentStep);
        });
    }

    async function loadModulesData() {
        const r = await fetch('/data/modules.json');
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
    }

    function loadStateFromStorage() {
        try {
            const saved = localStorage.getItem('configurator_state');
            if (saved) {
                const s = JSON.parse(saved);
                // Clear stale state or old format without version
                if (!s.version || s.version < 4 || Date.now() - s.timestamp > 24 * 60 * 60 * 1000) {
                    localStorage.removeItem('configurator_state');
                    return;
                }
                state = { ...state, ...s, viewingDetail: false };
            }
        } catch (e) { localStorage.removeItem('configurator_state'); }
    }

    function saveState() {
        try {
            localStorage.setItem('configurator_state', JSON.stringify({ ...state, version: 4, timestamp: Date.now() }));
        } catch (e) {}
    }

    function renderStep(step) {
        const wizard = document.getElementById('configuratorWizard');
        if (wizard) wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        wizardContent.style.opacity = '0';
        wizardContent.style.transform = 'translateY(12px)';
        setTimeout(() => {
            switch (step) {
                case STEPS.SITE_TYPE: renderSiteTypeStep(); break;
                case STEPS.MODULES:   renderModulesStep();  break;
                case STEPS.CONTACT:   renderContactStep();  break;
                case STEPS.SUMMARY:   renderSummaryStep();  break;
            }
            requestAnimationFrame(() => {
                wizardContent.style.opacity = '1';
                wizardContent.style.transform = 'translateY(0)';
            });
        }, 200);
    }

    function getDiscountPercent() {
        return state.selectedPackage ? (state.selectedPackage.discount || 0) : 0;
    }

    function getEffectiveModulePrice(m) {
        if (m.id === 'telegram_bot' && m.tiers) {
            const tier = m.tiers.find(t => t.id === state.botConfig.tierId);
            const tierPrice = tier ? tier.price : m.price;
            const addonsPrice = (state.botConfig.addons || []).reduce((s, aid) => {
                const addon = (m.addons || []).find(a => a.id === aid);
                return s + (addon ? addon.price : 0);
            }, 0);
            return tierPrice + addonsPrice;
        }
        return parseFloat(m.price || 0);
    }

    function calculateTotal() {
        const b = getBreakdown();
        return b.total;
    }

    function getBreakdown() {
        const base = state.selectedSiteType ? parseFloat(state.selectedSiteType.basePrice) : 0;
        const modulesSum = state.selectedModules.reduce((s, m) => s + getEffectiveModulePrice(m), 0);
        const subtotal = base + modulesSum;
        const discountPct = getDiscountPercent();
        const discountAmt = discountPct > 0 ? Math.round(subtotal * discountPct / 100) : 0;
        return { base, modulesSum, discountPct, discountAmt, total: subtotal - discountAmt };
    }

    function renderRunningTotal() {
        const l = labels();
        const b = getBreakdown();
        return `
            <div class="running-total" id="runningTotal">
                <div class="running-total-breakdown">
                    <div class="running-total-row">
                        <span>${l.total_base}:</span>
                        <span>${fmtPrice(b.base)}</span>
                    </div>
                    <div class="running-total-row">
                        <span>${l.total_modules}:</span>
                        <span data-modules-sum>${fmtPrice(b.modulesSum)}</span>
                    </div>
                    ${b.discountPct > 0 ? `
                        <div class="running-total-row running-total-discount">
                            <span>${l.sum_discount} (${b.discountPct}%):</span>
                            <span data-discount>${fmtPrice(b.discountAmt, {minus:true})}</span>
                        </div>
                    ` : ''}
                    <div class="running-total-divider"></div>
                </div>
                <div class="running-total-main">
                    <span class="running-total-label">${l.total}:</span>
                    <span class="running-total-value" data-value="${b.total}">${fmtPrice(b.total)}</span>
                </div>
            </div>
        `;
    }

    function updateRunningTotal() {
        const b = getBreakdown();
        const bar = document.getElementById('runningTotal');
        if (!bar) return;

        // Update modules sum
        const ms = bar.querySelector('[data-modules-sum]');
        if (ms) ms.textContent = fmtPrice(b.modulesSum);

        // Update discount row
        const ds = bar.querySelector('[data-discount]');
        if (ds) ds.textContent = fmtPrice(b.discountAmt, {minus:true});

        // Re-render running total if discount state changed (row added/removed)
        const hasDiscountRow = !!bar.querySelector('.running-total-discount');
        if ((b.discountPct > 0) !== hasDiscountRow) {
            bar.outerHTML = renderRunningTotal();
            return;
        }

        // Animate total
        const el = bar.querySelector('.running-total-value');
        if (!el) return;
        const oldVal = parseInt(el.dataset.value) || 0;
        const newVal = b.total;
        el.dataset.value = newVal;

        if (oldVal === newVal) return;

        // Count-up animation
        const duration = 400;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
            const current = Math.round(oldVal + (newVal - oldVal) * ease);
            el.textContent = fmtPrice(current);
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        // Pulse
        bar.classList.add('total-pulse');
        setTimeout(() => bar.classList.remove('total-pulse'), 500);
    }

    function updateModulesCounter() {
        const el = document.getElementById('modulesCounter');
        if (!el) return;
        const total = state.modulesData ? state.modulesData.modules.length : 0;
        el.textContent = `${state.selectedModules.length} / ${total}`;
    }

    // ═══════════════════════════════════════
    // STEP 1: Site Type Cards
    // ═══════════════════════════════════════
    function renderSiteTypeStep() {
        const l = labels();
        const types = state.modulesData.siteTypes;
        const badges = { popular: l.popular, fast: l.fast };

        wizardContent.innerHTML = `
            <div class="site-types-grid">
                ${types.map(type => `
                    <div class="site-type-card" data-type-id="${type.id}">
                        ${type.badge ? `<div class="card-badge badge-${type.badge}">${badges[type.badge] || ''}</div>` : ''}
                        <div class="site-type-icon">${type.icon}</div>
                        <h3 class="site-type-name">${loc(type, 'name')}</h3>
                        <p class="site-type-description">${loc(type, 'description')}</p>
                        <div class="site-type-price-block">
                            <span class="site-type-price-label">${l.from}</span>
                            <span class="site-type-price">${fmtPrice(type.basePrice)}</span>
                        </div>
                        <div class="site-type-meta">⏱ ${loc(type, 'timeline')}</div>
                        <div class="site-type-cta">${l.more} →</div>
                    </div>
                `).join('')}
            </div>
        `;

        if (nav) nav.style.display = 'none';

        document.querySelectorAll('.site-type-card').forEach(card =>
            card.addEventListener('click', () => {
                const type = types.find(t => t.id === card.dataset.typeId);
                renderSiteTypeDetail(type);
            })
        );
    }

    // ═══════════════════════════════════════
    // DETAIL: Full service page
    // ═══════════════════════════════════════
    function renderSiteTypeDetail(type) {
        const l = labels();
        const features = type[`features_${lang()}`] || type.features_en || [];

        wizardContent.innerHTML = `
            <div class="service-detail">
                <button class="service-detail-back" id="detailBack">← ${l.back}</button>

                <div class="service-detail-hero">
                    <div class="service-detail-icon">${type.icon}</div>
                    <h2 class="service-detail-title">${loc(type, 'name')}</h2>
                    <p class="service-detail-desc">${loc(type, 'description')}</p>
                    <div class="service-detail-badges">
                        <span class="detail-badge">⏱ ${loc(type, 'timeline')}</span>
                        <span class="detail-badge">💰 ${l.from} ${fmtPrice(type.basePrice)}</span>
                    </div>
                </div>

                <div class="service-detail-body">
                    <div class="service-detail-features">
                        <h3 class="service-detail-section-title">${l.included}</h3>
                        <ul class="service-detail-list">
                            ${features.map((f, i) => `
                                <li style="animation-delay:${i * 50}ms">
                                    <span class="detail-check">✓</span>
                                    <span>${f}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>

                    <div class="service-detail-sidebar">
                        <div class="service-detail-price-card">
                            <div class="service-detail-price-label">${l.from}</div>
                            <div class="service-detail-price">${fmtPrice(type.basePrice)}</div>
                            <div class="service-detail-timeline">⏱ ${loc(type, 'timeline')}</div>
                            <button class="btn btn-primary service-detail-btn" id="detailChoose">${l.choose}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (nav) nav.style.display = 'none';

        document.getElementById('detailBack').addEventListener('click', () => renderSiteTypeStep());
        document.getElementById('detailChoose').addEventListener('click', () => {
            state.selectedSiteType = type;
            saveState();
            if (nav) nav.style.display = '';
            state.currentStep = STEPS.MODULES;
            renderStep(state.currentStep);
            updateUI();
        });
    }

    // ═══════════════════════════════════════
    // STEP 2: Modules (Accordion Layout)
    // ═══════════════════════════════════════
    let expandedModuleId = null;
    let recAutoSelected = false;

    function getPackagesForType(typeId) {
        return state.modulesData.packages ? (state.modulesData.packages[typeId] || []) : [];
    }

    function calcPackagePrice(pkg) {
        const base = state.selectedSiteType ? parseFloat(state.selectedSiteType.basePrice) : 0;
        const modules = state.modulesData.modules;
        const modSum = (pkg.modules || []).reduce((s, mid) => {
            const m = modules.find(x => x.id === mid);
            return s + (m ? parseFloat(m.price) : 0);
        }, 0);
        const subtotal = base + modSum;
        const discount = pkg.discount || 0;
        return Math.round(subtotal - subtotal * discount / 100);
    }

    function renderCart() {
        const l = labels();
        const b = getBreakdown();
        const siteType = state.selectedSiteType;

        const modulesHtml = state.selectedModules.length > 0
            ? state.selectedModules.map(m => {
                const price = m.tiers ? getEffectiveModulePrice(m) : m.price;
                return `
                    <div class="cart-module-item" data-module-id="${m.id}">
                        <span class="cart-module-icon">${m.icon}</span>
                        <span class="cart-module-name">${loc(m, 'name')}</span>
                        <span class="cart-module-price">${fmtPrice(price, {plus:true})}</span>
                        <button class="cart-module-remove" data-module-id="${m.id}">×</button>
                    </div>
                `;
            }).join('')
            : `<div class="cart-empty">${l.cart_add_hint}</div>`;

        return `
            <div class="cart-title">${l.cart_title}</div>
            <div class="cart-site-type">
                <span class="cart-site-type-icon">${siteType.icon}</span>
                <span class="cart-site-type-name">${loc(siteType, 'name')}</span>
                <span class="cart-site-type-price">${fmtPrice(siteType.basePrice)}</span>
            </div>
            <div class="cart-divider"></div>
            <div class="cart-modules-list">
                ${modulesHtml}
            </div>
            <div class="cart-divider"></div>
            ${b.discountPct > 0 ? `
                <div class="cart-discount-row">
                    <span>${l.sum_discount} (${b.discountPct}%):</span>
                    <span>${fmtPrice(b.discountAmt, {minus:true})}</span>
                </div>
            ` : ''}
            <div class="cart-total">
                <span class="cart-total-label">${l.total}:</span>
                <span class="cart-total-value">${fmtPrice(b.total)}</span>
            </div>
        `;
    }

    function updateCart() {
        const cartEl = document.getElementById('modulesCart');
        if (!cartEl) return;
        cartEl.innerHTML = renderCart();
        bindCartRemoveButtons();
    }

    function bindCartRemoveButtons() {
        document.querySelectorAll('.cart-module-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mid = btn.dataset.moduleId;
                const idx = state.selectedModules.findIndex(m => m.id === mid);
                if (idx > -1) {
                    state.selectedModules.splice(idx, 1);
                    state.selectedPackage = null;
                    saveState();

                    const item = document.querySelector(`.module-item[data-module-id="${mid}"]`);
                    if (item) {
                        item.classList.remove('module-item--selected');
                        const checkEl = item.querySelector('.module-item-check');
                        if (checkEl) { checkEl.textContent = ''; checkEl.classList.remove('module-item-check--pop'); }
                        const applyBtn = item.querySelector('.module-item-apply');
                        if (applyBtn) {
                            applyBtn.classList.remove('module-item-apply--active');
                            applyBtn.textContent = labels().apply;
                        }
                    }
                    document.querySelectorAll('.package-card').forEach(c => c.classList.remove('active'));

                    updateCart();
                    updateModulesCounter();
                }
            });
        });
    }

    function renderModulesStep() {
        const l = labels();
        const modules = state.modulesData.modules;
        const rec = state.selectedSiteType?.recommended_modules || [];
        const siteTypeName = loc(state.selectedSiteType, 'name');
        const packages = getPackagesForType(state.selectedSiteType?.id);

        if (nav) nav.style.display = '';

        // Auto-select recommended modules on first visit
        if (!recAutoSelected && state.selectedModules.length === 0) {
            recAutoSelected = true;
            const optPkg = packages.find(p => p.badge === 'recommended');
            if (optPkg) {
                state.selectedPackage = optPkg;
                modules.forEach(m => {
                    if (optPkg.modules.includes(m.id)) state.selectedModules.push(m);
                });
            } else {
                modules.forEach(m => {
                    if (rec.includes(m.id)) state.selectedModules.push(m);
                });
            }
            saveState();
        }

        const recModules = modules.filter(m => rec.includes(m.id));
        const otherModules = modules.filter(m => !rec.includes(m.id));

        wizardContent.innerHTML = `
            <div class="modules-step">
                <div class="modules-split">
                    <div class="modules-cart" id="modulesCart">
                        ${renderCart()}
                    </div>
                    <div class="modules-shop">
                        ${packages.length ? `
                            <div class="packages-section">
                                <div class="step-intro">
                                    <h3>${l.pkg_title}</h3>
                                    <p>${l.pkg_sub}</p>
                                </div>
                                <div class="packages-grid">
                                    ${packages.map(pkg => {
                                        const price = calcPackagePrice(pkg);
                                        const isActive = state.selectedPackage?.id === pkg.id;
                                        return `
                                            <div class="package-card ${isActive ? 'active' : ''} ${pkg.badge === 'recommended' ? 'package-card--recommended' : ''}" data-package-id="${pkg.id}">
                                                ${pkg.badge === 'recommended' ? `<div class="package-badge">${l.pkg_recommended}</div>` : ''}
                                                <div class="package-name">${loc(pkg, 'name')}</div>
                                                <div class="package-price">${fmtPrice(price)}</div>
                                                ${pkg.discount > 0 ? `<div class="package-save">${l.pkg_save} ${pkg.discount}%</div>` : ''}
                                                <div class="package-desc">${loc(pkg, 'description')}</div>
                                                <div class="package-modules">
                                                    <span class="package-module-tag package-module-tag--base">📦 ${l.total_base}</span>
                                                    ${(pkg.modules || []).map(mid => {
                                                        const m = modules.find(x => x.id === mid);
                                                        return m ? `<span class="package-module-tag">${m.icon} ${loc(m, 'name')}</span>` : '';
                                                    }).join('')}
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                                <div class="packages-divider">
                                    <span>${l.pkg_custom}</span>
                                </div>
                            </div>
                        ` : ''}

                        <div class="step-intro">
                            <h3>${l.modules_title} <span class="modules-counter" id="modulesCounter">${state.selectedModules.length} / ${modules.length}</span></h3>
                            <p>${l.modules_sub}</p>
                        </div>

                        <div class="modules-accordion">
                            ${recModules.length ? `
                                <div class="modules-group modules-group--rec">
                                    <div class="modules-group-header modules-group-header--rec">
                                        <span class="modules-group-icon">★</span>
                                        <span>${l.rec_for} ${siteTypeName}</span>
                                    </div>
                                    ${recModules.map(m => renderModuleItem(m)).join('')}
                                </div>
                            ` : ''}

                            ${otherModules.length ? `
                                <div class="modules-group modules-group--other">
                                    <div class="modules-group-header modules-group-header--other">
                                        <span>${l.other_modules}</span>
                                    </div>
                                    ${otherModules.map(m => renderModuleItem(m)).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindAccordionEvents(modules);
        bindPackageEvents(packages, modules);
        bindCartRemoveButtons();
    }

    function renderModuleItem(m) {
        const selected = state.selectedModules.some(x => x.id === m.id);
        const expanded = expandedModuleId === m.id;
        const price = m.tiers ? getEffectiveModulePrice(m) : m.price;
        const l = labels();

        return `
            <div class="module-item ${selected ? 'module-item--selected' : ''} ${expanded ? 'module-item--expanded' : ''}" data-module-id="${m.id}">
                <div class="module-item-header">
                    <div class="module-item-check">${selected ? '✓' : ''}</div>
                    <div class="module-item-icon">${m.icon}</div>
                    <div class="module-item-info">
                        <div class="module-item-name">${loc(m, 'name')}${m.tiers ? ' <span class="module-item-pro">PRO</span>' : ''}</div>
                        <div class="module-item-value">${loc(m, 'value') || loc(m, 'description')}</div>
                    </div>
                    <div class="module-item-price" data-price-for="${m.id}">${fmtPrice(price, {plus:true})}</div>
                    <div class="module-item-arrow"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></div>
                </div>
                <div class="module-item-body">
                    <div class="module-item-body-inner">
                        ${renderModuleBody(m)}
                    </div>
                </div>
            </div>
        `;
    }

    function renderModuleBody(m) {
        if (m.tiers) return renderTieredBody(m);
        const l = labels();
        const features = m[`features_${lang()}`] || m.features_en || [];
        const selected = state.selectedModules.some(x => x.id === m.id);

        return `
            <p class="module-body-desc">${loc(m, 'description')}</p>
            ${features.length ? `
                <ul class="module-body-features">
                    ${features.map(f => `<li><span class="detail-check">✓</span><span>${f}</span></li>`).join('')}
                </ul>
            ` : ''}
            <button class="module-item-apply ${selected ? 'module-item-apply--active' : ''}" data-module-id="${m.id}">
                ${selected ? l.applied : l.apply}
            </button>
        `;
    }

    function renderTieredBody(m) {
        const l = labels();
        const currentTier = m.tiers.find(t => t.id === state.botConfig.tierId) || m.tiers[0];
        const tierFeatures = currentTier[`features_${lang()}`] || currentTier.features_en || [];
        const selected = state.selectedModules.some(x => x.id === m.id);

        return `
            <div class="bot-boost-text">${l.bot_boost}</div>

            <div class="tier-switcher">
                ${m.tiers.map(tier => `
                    <button class="tier-btn ${tier.id === state.botConfig.tierId ? 'tier-btn--active' : ''}" data-tier-id="${tier.id}">
                        ${tier.badge === 'recommended' ? '<span class="tier-btn-star">★</span>' : ''}
                        <span class="tier-btn-name">${loc(tier, 'name')}</span>
                        <span class="tier-btn-price">${fmtPrice(tier.price)}</span>
                    </button>
                `).join('')}
            </div>

            <div class="tier-desc" id="tierDesc">${loc(currentTier, 'description')}</div>

            <ul class="module-body-features" id="tierFeatures">
                ${tierFeatures.map(f => `<li><span class="detail-check">✓</span><span>${f}</span></li>`).join('')}
            </ul>

            <div class="tier-addons">
                <h5 class="tier-addons-title">${l.bot_addons}</h5>
                ${m.addons.map(addon => `
                    <label class="addon-check ${state.botConfig.addons.includes(addon.id) ? 'addon-check--active' : ''}" data-addon-id="${addon.id}">
                        <input type="checkbox" ${state.botConfig.addons.includes(addon.id) ? 'checked' : ''}>
                        <span class="addon-check-info">
                            <span class="addon-check-name">${loc(addon, 'name')}</span>
                            <span class="addon-check-desc">${loc(addon, 'description')}</span>
                        </span>
                        <span class="addon-check-price">${fmtPrice(addon.price, {plus:true})}</span>
                    </label>
                `).join('')}
            </div>

            <button class="module-item-apply ${selected ? 'module-item-apply--active' : ''}" data-module-id="${m.id}">
                ${selected ? l.applied : l.apply}
            </button>
        `;
    }

    function quickToggleModule(mid, modules) {
        const mod = modules.find(m => m.id === mid);
        if (!mod) return;
        const item = document.querySelector(`.module-item[data-module-id="${mid}"]`);
        if (!item) return;
        const l = labels();

        const idx = state.selectedModules.findIndex(m => m.id === mid);
        const checkEl = item.querySelector('.module-item-check');

        if (idx > -1) {
            state.selectedModules.splice(idx, 1);
            item.classList.remove('module-item--selected');
            if (checkEl) { checkEl.textContent = ''; checkEl.classList.remove('module-item-check--pop'); }
        } else {
            state.selectedModules.push(mod);
            item.classList.add('module-item--selected');
            if (checkEl) { checkEl.textContent = '✓'; checkEl.classList.add('module-item-check--pop'); }
        }

        // Обновить кнопку Apply если раскрыт
        const applyBtn = item.querySelector('.module-item-apply');
        if (applyBtn) {
            const sel = state.selectedModules.some(m => m.id === mid);
            applyBtn.classList.toggle('module-item-apply--active', sel);
            applyBtn.textContent = sel ? l.applied : l.apply;
        }

        state.selectedPackage = null;
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('active'));
        saveState();

        const price = mod.tiers ? getEffectiveModulePrice(mod) : mod.price;
        const priceEl = item.querySelector(`[data-price-for="${mod.id}"]`);
        if (priceEl) priceEl.textContent = fmtPrice(price, {plus:true});

        updateRunningTotal();
        updateModulesCounter();
        updateCart();
    }

    function bindAccordionEvents(modules) {
        // Check-circle click → quick toggle (кроме tiered-модулей — для них раскрываем)
        document.querySelectorAll('.module-item-check').forEach(check => {
            check.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = check.closest('.module-item');
                const mid = item.dataset.moduleId;
                const mod = modules.find(m => m.id === mid);

                // Tiered-модуль без выбора → раскрыть для настройки
                if (mod && mod.tiers && !state.selectedModules.some(m => m.id === mid)) {
                    const prev = document.querySelector('.module-item--expanded');
                    if (prev) prev.classList.remove('module-item--expanded');
                    item.classList.add('module-item--expanded');
                    expandedModuleId = mid;
                    setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
                    return;
                }

                quickToggleModule(mid, modules);
            });
        });

        // Header click → expand / collapse
        document.querySelectorAll('.module-item-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // Если клик был по check — он обработан выше
                if (e.target.closest('.module-item-check')) return;

                const item = header.closest('.module-item');
                const mid = item.dataset.moduleId;

                if (expandedModuleId === mid) {
                    item.classList.remove('module-item--expanded');
                    expandedModuleId = null;
                } else {
                    const prev = document.querySelector('.module-item--expanded');
                    if (prev) prev.classList.remove('module-item--expanded');
                    item.classList.add('module-item--expanded');
                    expandedModuleId = mid;
                    // Auto-scroll к раскрытому модулю
                    setTimeout(() => item.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
                }
            });
        });

        // Apply buttons
        document.querySelectorAll('.module-item-apply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mid = btn.dataset.moduleId;
                const mod = modules.find(m => m.id === mid);
                const item = btn.closest('.module-item');
                const l = labels();

                const idx = state.selectedModules.findIndex(m => m.id === mid);
                if (idx > -1) {
                    state.selectedModules.splice(idx, 1);
                    item.classList.remove('module-item--selected');
                    btn.classList.remove('module-item-apply--active');
                    btn.textContent = l.apply;
                    item.querySelector('.module-item-check').textContent = '';
                } else {
                    state.selectedModules.push(mod);
                    item.classList.add('module-item--selected');
                    btn.classList.add('module-item-apply--active');
                    btn.textContent = l.applied;
                    item.querySelector('.module-item-check').textContent = '✓';
                }

                // Clear package selection
                state.selectedPackage = null;
                document.querySelectorAll('.package-card').forEach(c => c.classList.remove('active'));
                saveState();

                // Collapse
                item.classList.remove('module-item--expanded');
                expandedModuleId = null;

                // Checkmark pop
                const checkEl = item.querySelector('.module-item-check');
                if (checkEl && state.selectedModules.some(m => m.id === mid)) {
                    checkEl.classList.add('module-item-check--pop');
                }

                // Update price
                const price = mod.tiers ? getEffectiveModulePrice(mod) : mod.price;
                const priceEl = item.querySelector(`[data-price-for="${mod.id}"]`);
                if (priceEl) priceEl.textContent = fmtPrice(price, {plus:true});

                updateRunningTotal();
                updateModulesCounter();
                updateCart();
            });
        });

        // Tier switcher buttons
        document.querySelectorAll('.tier-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tierId = btn.dataset.tierId;
                state.botConfig.tierId = tierId;

                if (tierId === 'advanced' && !state.botConfig.addons.includes('api_integration')) {
                    state.botConfig.addons.push('api_integration');
                }
                saveState();

                document.querySelectorAll('.tier-btn').forEach(b =>
                    b.classList.toggle('tier-btn--active', b.dataset.tierId === tierId)
                );

                const mod = modules.find(m => m.id === 'telegram_bot');
                if (mod) {
                    const tier = mod.tiers.find(t => t.id === tierId);
                    const features = tier[`features_${lang()}`] || tier.features_en || [];
                    const featuresEl = document.getElementById('tierFeatures');
                    if (featuresEl) {
                        featuresEl.innerHTML = features.map(f =>
                            `<li><span class="detail-check">✓</span><span>${f}</span></li>`
                        ).join('');
                    }
                    const descEl = document.getElementById('tierDesc');
                    if (descEl) descEl.textContent = loc(tier, 'description');

                    // Update addon checkboxes (auto-selected api_integration)
                    document.querySelectorAll('.addon-check').forEach(item => {
                        const aid = item.dataset.addonId;
                        const isChecked = state.botConfig.addons.includes(aid);
                        item.classList.toggle('addon-check--active', isChecked);
                        item.querySelector('input').checked = isChecked;
                    });

                    const newPrice = getEffectiveModulePrice(mod);
                    const priceEl = document.querySelector(`[data-price-for="${mod.id}"]`);
                    if (priceEl) priceEl.textContent = fmtPrice(newPrice, {plus:true});
                    updateRunningTotal();
                    updateCart();
                }
            });
        });

        // Addon checkboxes
        document.querySelectorAll('.addon-check').forEach(label => {
            label.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const aid = label.dataset.addonId;
                const idx = state.botConfig.addons.indexOf(aid);
                if (idx > -1) state.botConfig.addons.splice(idx, 1);
                else state.botConfig.addons.push(aid);
                saveState();

                const isChecked = state.botConfig.addons.includes(aid);
                label.classList.toggle('addon-check--active', isChecked);
                label.querySelector('input').checked = isChecked;

                const mod = modules.find(m => m.id === 'telegram_bot');
                if (mod) {
                    const newPrice = getEffectiveModulePrice(mod);
                    const priceEl = document.querySelector(`[data-price-for="${mod.id}"]`);
                    if (priceEl) priceEl.textContent = fmtPrice(newPrice, {plus:true});
                    updateRunningTotal();
                    updateCart();
                }
            });
        });
    }

    function bindPackageEvents(packages, modules) {
        document.querySelectorAll('.package-card').forEach(card => {
            card.addEventListener('click', () => {
                const pkgId = card.dataset.packageId;
                const pkg = packages.find(p => p.id === pkgId);
                if (!pkg) return;

                state.selectedPackage = pkg;
                state.selectedModules = [];
                (pkg.modules || []).forEach(mid => {
                    const m = modules.find(x => x.id === mid);
                    if (m) state.selectedModules.push(m);
                });
                saveState();

                document.querySelectorAll('.package-card').forEach(c =>
                    c.classList.toggle('active', c.dataset.packageId === pkgId)
                );

                // Update module items
                const l = labels();
                document.querySelectorAll('.module-item').forEach(item => {
                    const mid = item.dataset.moduleId;
                    const selected = state.selectedModules.some(m => m.id === mid);
                    item.classList.toggle('module-item--selected', selected);
                    const checkEl = item.querySelector('.module-item-check');
                    if (checkEl) {
                        checkEl.textContent = selected ? '✓' : '';
                        checkEl.classList.toggle('module-item-check--pop', selected);
                    }
                    const applyBtn = item.querySelector('.module-item-apply');
                    if (applyBtn) {
                        applyBtn.classList.toggle('module-item-apply--active', selected);
                        applyBtn.textContent = selected ? l.applied : l.apply;
                    }
                });

                updateRunningTotal();
                updateModulesCounter();
                updateCart();
            });
        });
    }

    // ═══════════════════════════════════════
    // STEP 4: Contact
    // ═══════════════════════════════════════
    function renderContactStep() {
        const l = labels();
        if (nav) nav.style.display = '';

        wizardContent.innerHTML = `
            <div class="contact-step">
                <div class="step-intro">
                    <h3>${l.contact_title}</h3>
                    <p>${l.contact_sub}</p>
                </div>
                <form class="wizard-contact-form" id="contactForm" novalidate>
                    <div class="form-group">
                        <label>${l.name} *</label>
                        <input type="text" id="clientName" name="clientName" required minlength="2"
                               placeholder="${l.name_ph}" value="${state.contactData.name || ''}">
                        <div class="field-error" id="nameError">${l.name_err}</div>
                    </div>
                    <div class="form-group">
                        <label>${l.phone} *</label>
                        <input type="tel" id="clientPhone" name="clientPhone" required
                               placeholder="${l.phone_ph}" value="${state.contactData.phone || ''}">
                        <div class="field-error" id="phoneError">${l.phone_err}</div>
                    </div>
                    <div class="form-group">
                        <label>${l.email}</label>
                        <input type="email" id="clientEmail" name="clientEmail"
                               placeholder="${l.email_ph}" value="${state.contactData.email || ''}">
                    </div>
                </form>
                ${renderRunningTotal()}
            </div>
        `;

        document.getElementById('contactForm').addEventListener('input', (e) => {
            const fd = new FormData(e.currentTarget);
            state.contactData = { name: fd.get('clientName'), phone: fd.get('clientPhone'), email: fd.get('clientEmail') };
            saveState();
            document.querySelectorAll('.field-error').forEach(el => el.classList.remove('visible'));
            document.querySelectorAll('.form-group input').forEach(i => i.classList.remove('input-error'));
        });

        // Маска телефона: +XX XXX XXX XXX
        const phoneInput = document.getElementById('clientPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', () => {
                let val = phoneInput.value.replace(/[^\d+]/g, '');
                if (!val) return;
                const hasPlus = val.startsWith('+');
                const digits = val.replace(/\D/g, '');
                let formatted = hasPlus ? '+' : '';
                for (let i = 0; i < digits.length; i++) {
                    if (i > 0 && i % 3 === (hasPlus ? 2 : 0) && i < 11) formatted += ' ';
                    formatted += digits[i];
                }
                phoneInput.value = formatted;
                state.contactData.phone = formatted;
                saveState();
            });
        }
    }

    // ═══════════════════════════════════════
    // STEP 3: Summary
    // ═══════════════════════════════════════
    function renderSummaryStep() {
        const l = labels();
        const b = getBreakdown();
        if (nav) nav.style.display = '';

        wizardContent.innerHTML = `
            <div class="summary-container">
                <div class="summary-section">
                    <div class="summary-section-header">
                        <h3>${l.sum_type}</h3>
                        <button class="summary-edit-btn" data-goto="1">✎</button>
                    </div>
                    <div class="summary-item">
                        <span>${state.selectedSiteType.icon} ${loc(state.selectedSiteType, 'name')}</span>
                        <span class="summary-price">${fmtPrice(state.selectedSiteType.basePrice)}</span>
                    </div>
                </div>

                <div class="summary-section">
                    <div class="summary-section-header">
                        <h3>${l.sum_mod}</h3>
                        <button class="summary-edit-btn" data-goto="2">✎</button>
                    </div>
                    ${state.selectedPackage ? `
                        <div class="summary-package-badge">${l.sum_package}: ${loc(state.selectedPackage, 'name')}</div>
                    ` : ''}
                    ${state.selectedModules.length ? `
                        <ul class="summary-modules-list">
                            ${state.selectedModules.map(m => {
                                const value = loc(m, 'value');
                                const price = getEffectiveModulePrice(m);
                                let botDetails = '';
                                if (m.id === 'telegram_bot' && m.tiers) {
                                    const tier = m.tiers.find(t => t.id === state.botConfig.tierId);
                                    const addonNames = (state.botConfig.addons || []).map(aid => {
                                        const addon = (m.addons || []).find(a => a.id === aid);
                                        return addon ? loc(addon, 'name') : '';
                                    }).filter(Boolean);
                                    botDetails = `<div class="summary-bot-details">
                                        <span class="summary-bot-tier">${l.bot_tier}: ${tier ? loc(tier, 'name') : ''}</span>
                                        ${addonNames.length ? `<span class="summary-bot-addons">+ ${addonNames.join(', ')}</span>` : ''}
                                    </div>`;
                                }
                                return `<li>
                                    <span>${m.icon} <strong>${loc(m, 'name')}</strong>${value ? ` — ${value}` : ''}${botDetails}</span>
                                    <span class="summary-price">${fmtPrice(price, {plus:true})}</span>
                                </li>`;
                            }).join('')}
                        </ul>
                    ` : `<p class="summary-empty">${l.no_mod}</p>`}
                </div>

                <div class="summary-total-block">
                    <div class="summary-total-breakdown">
                        <div class="summary-total-row"><span>${l.total_base}:</span><span>${fmtPrice(b.base)}</span></div>
                        <div class="summary-total-row"><span>${l.total_modules}:</span><span>${fmtPrice(b.modulesSum)}</span></div>
                        ${b.discountPct > 0 ? `
                            <div class="summary-total-row summary-discount-row">
                                <span>${l.sum_discount} (${b.discountPct}%):</span>
                                <span>${fmtPrice(b.discountAmt, {minus:true})}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="summary-total">
                        <span class="summary-total-label">${l.sum_total}</span>
                        <span class="total-price">${fmtPrice(b.total)}</span>
                    </div>
                </div>

                <div class="summary-vat-notice">${l.vat_notice}</div>
            </div>
        `;

        document.querySelectorAll('.summary-edit-btn').forEach(btn =>
            btn.addEventListener('click', () => {
                state.currentStep = parseInt(btn.dataset.goto);
                renderStep(state.currentStep);
                updateUI();
            })
        );
    }

    // ═══════════════════════════════════════
    // Submit + Success
    // ═══════════════════════════════════════
    async function submitConfiguration() {
        const l = labels();
        try {
            nextBtn.disabled = true;
            nextBtn.querySelector('span').textContent = l.sending;

            const b = getBreakdown();
            const res = await fetch(`${API}/telegram/configurator`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteType: state.selectedSiteType,
                    modules: state.selectedModules.map(m => ({
                        id: m.id,
                        name_en: m.name_en, name_de: m.name_de, name_ru: m.name_ru,
                        price: getEffectiveModulePrice(m),
                        icon: m.icon
                    })),
                    package: state.selectedPackage || null,
                    discount: b.discountPct,
                    total: b.total,
                    botConfig: state.selectedModules.some(m => m.id === 'telegram_bot') ? state.botConfig : null,
                    clientName: state.contactData.name,
                    clientPhone: state.contactData.phone,
                    clientEmail: state.contactData.email || null,
                    site: SITE_KEY,
                    currency: state.currency
                })
            });

            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Send failed'); }

            localStorage.removeItem('configurator_state');
            showSuccess();
        } catch (err) {
            nextBtn.disabled = false;
            nextBtn.querySelector('span').textContent = l.submit;
            const old = document.querySelector('.submit-error');
            if (old) old.remove();
            const el = document.createElement('div');
            el.className = 'submit-error';
            el.textContent = err.message;
            wizardContent.appendChild(el);
        }
    }

    function showSuccess() {
        const l = labels();
        wizardContent.innerHTML = `
            <div class="wizard-success">
                <div class="success-checkmark">
                    <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" stroke-width="1"/><path class="check-path" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M14.1 27.2l7.1 7.2 16.7-16.8"/></svg>
                </div>
                <h2 class="wizard-success-title">${l.ok_title}</h2>
                <p class="wizard-success-message">${l.ok_msg}</p>
            </div>
        `;
        if (nav) nav.style.display = 'none';
        document.querySelectorAll('.wizard-step').forEach(s => s.style.visibility = 'hidden');
    }

    // ═══════════════════════════════════════
    // Navigation
    // ═══════════════════════════════════════
    function setupNavigation() {
        prevBtn.addEventListener('click', () => {
            if (state.currentStep > STEPS.SITE_TYPE) {
                state.currentStep--;
                renderStep(state.currentStep);
                updateUI();
            }
        });
        nextBtn.addEventListener('click', async () => {
            if (await validateCurrentStep()) {
                if (state.currentStep < STEPS.CONTACT) { state.currentStep++; renderStep(state.currentStep); updateUI(); }
                else await submitConfiguration();
            }
        });
    }

    // ═══════════════════════════════════════
    // Base Package Modal
    // ═══════════════════════════════════════
    function setupBaseModal() {
        const modal = document.getElementById('baseModal');
        if (!modal || state.modalSetup) return;

        state.modalSetup = true;
        const closeBtn = document.getElementById('baseModalClose');
        const overlay = document.getElementById('baseModalOverlay');
        const modalTitle = document.getElementById('baseModalTitle');
        const modalList = document.getElementById('baseModalList');

        function closeModal() {
            modal.classList.remove('active');
        }

        // Close button
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        // Overlay click
        if (overlay) overlay.addEventListener('click', closeModal);

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
        });

        // Click handler for base tags - handles clicks on the tag or its children
        document.addEventListener('click', (e) => {
            let target = e.target;
            // Check if clicked element is the base tag or a child of it
            if (!target.classList.contains('package-module-tag--base')) {
                target = target.closest('.package-module-tag--base');
                if (!target) return;
            }

            const siteType = state.selectedSiteType;
            if (!siteType) return;

            const features = loc(siteType, 'features') || [];
            if (features.length === 0) return;

            const l = labels();
            modalTitle.textContent = `${loc(siteType, 'name')} — ${l.total_base}`;
            modalList.innerHTML = features.map(f => `<li>${f}</li>`).join('');
            modal.classList.add('active');
        });
    }

    async function validateCurrentStep() {
        if (state.currentStep === STEPS.CONTACT) {
            let ok = true;
            const n = document.getElementById('clientName');
            const p = document.getElementById('clientPhone');
            if (!n.value.trim() || n.value.trim().length < 2) {
                n.classList.add('input-error'); document.getElementById('nameError').classList.add('visible'); ok = false;
            }
            if ((p.value || '').replace(/\D/g, '').length < 9) {
                p.classList.add('input-error'); document.getElementById('phoneError').classList.add('visible'); ok = false;
            }
            return ok;
        }
        if (state.currentStep === STEPS.SITE_TYPE) return !!state.selectedSiteType;
        return true;
    }

    function updateUI() {
        const l = labels();
        const stepNames = { 1: l.step1, 2: l.step2, 3: l.step4, 4: l.step3 };
        document.querySelectorAll('.wizard-step').forEach((step, i) => {
            const num = i + 1;
            step.classList.toggle('active', num === state.currentStep);
            step.classList.toggle('completed', num < state.currentStep);
            const oldHint = step.querySelector('.step-hint');
            if (oldHint) oldHint.remove();
            if (num === state.currentStep) {
                const hint = document.createElement('div');
                hint.className = 'step-hint';
                hint.textContent = `${l.you_are_here}: ${stepNames[num]}`;
                step.appendChild(hint);
            }
        });
        prevBtn.style.display = state.currentStep <= STEPS.SITE_TYPE ? 'none' : 'block';
        const ps = prevBtn.querySelector('span');
        const ns = nextBtn.querySelector('span');
        if (ps) ps.textContent = l.prev;
        if (ns) ns.textContent = state.currentStep === STEPS.CONTACT ? l.submit : l.next;
    }

    // Wrap renderStep to setup base modal when modules step renders
    const originalRenderStep = renderStep;
    renderStep = function(step) {
        originalRenderStep.call(this, step);
        if (step === STEPS.MODULES) {
            setTimeout(setupBaseModal, 100);
        }
    };

    // Initialize the wizard
    init();
});
