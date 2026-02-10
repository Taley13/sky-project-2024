/**
 * Sky Template - FAQ Frontend Example
 * Accordion FAQ display with category tabs
 *
 * Required HTML:
 *   <div id="faqWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/faq.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('faqWidget');
    if (!widget) return;

    let faqData = [];
    let activeCategory = null;

    function renderFAQ() {
        const categories = faqData.map(g => g.category);
        const currentGroup = activeCategory !== null
            ? faqData.find(g => g.category.id === activeCategory)
            : faqData[0];

        widget.innerHTML = `
            <div class="faq-widget">
                ${categories.length > 1 ? `
                    <div class="faq-tabs">
                        ${categories.map(cat => `
                            <button class="faq-tab ${(currentGroup && currentGroup.category.id === cat.id) ? 'active' : ''}"
                                    data-category-id="${cat.id}">
                                ${cat.name}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="faq-accordion">
                    ${(currentGroup?.items || []).map(item => `
                        <div class="faq-item" data-item-id="${item.id}">
                            <button class="faq-question">
                                <span>${item.question}</span>
                                <span class="faq-toggle">+</span>
                            </button>
                            <div class="faq-answer">
                                <p>${item.answer}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Tab click events
        document.querySelectorAll('.faq-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const catId = tab.dataset.categoryId;
                activeCategory = catId === 'null' ? null : parseInt(catId);
                renderFAQ();
            });
        });

        // Accordion click events
        document.querySelectorAll('.faq-question').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.parentElement;
                const isOpen = item.classList.contains('open');

                // Close all items
                document.querySelectorAll('.faq-item.open').forEach(el => {
                    el.classList.remove('open');
                    el.querySelector('.faq-toggle').textContent = '+';
                });

                // Toggle clicked item
                if (!isOpen) {
                    item.classList.add('open');
                    item.querySelector('.faq-toggle').textContent = '−';
                }
            });
        });
    }

    async function loadFAQ() {
        try {
            const res = await fetch(`${API}/faq`);
            if (res.ok) faqData = await res.json();
            if (faqData.length > 0) {
                activeCategory = faqData[0].category.id;
                renderFAQ();
            } else {
                widget.innerHTML = '<p>No FAQ available</p>';
            }
        } catch (e) {
            widget.innerHTML = '<p>FAQ unavailable</p>';
        }
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .faq-widget { max-width: 800px; margin: 0 auto; }
        .faq-tabs { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .faq-tab {
            padding: 8px 20px; border: 2px solid var(--primary-color, #4CAF50);
            background: transparent; color: var(--primary-color, #4CAF50);
            border-radius: 25px; cursor: pointer; font-size: 14px; transition: all 0.3s;
        }
        .faq-tab.active, .faq-tab:hover {
            background: var(--primary-color, #4CAF50); color: #fff;
        }
        .faq-accordion { display: flex; flex-direction: column; gap: 8px; }
        .faq-item { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
        .faq-question {
            width: 100%; padding: 16px 20px; background: #f9f9f9; border: none;
            cursor: pointer; display: flex; justify-content: space-between; align-items: center;
            font-size: 16px; text-align: left; transition: background 0.3s;
        }
        .faq-question:hover { background: #f0f0f0; }
        .faq-toggle { font-size: 20px; font-weight: bold; color: var(--primary-color, #4CAF50); min-width: 20px; text-align: center; }
        .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; }
        .faq-item.open .faq-answer { max-height: 500px; padding: 16px 20px; }
        .faq-answer p { margin: 0; line-height: 1.6; color: #555; }
    `;
    document.head.appendChild(style);

    loadFAQ();
});
