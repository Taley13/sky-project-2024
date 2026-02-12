/**
 * Sky Template - Reviews Frontend Example
 * Review cards with star ratings and submission form
 *
 * Required HTML:
 *   <div id="reviewsWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/reviews.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('reviewsWidget');
    if (!widget) return;

    let reviews = [];
    let stats = { total: 0, average_rating: 0, distribution: {} };
    let selectedRating = 0;

    function renderStars(rating, interactive = false) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (interactive) {
                html += `<span class="rev-star ${i <= rating ? 'filled' : ''}" data-rating="${i}">&#9733;</span>`;
            } else {
                html += `<span class="rev-star-display ${i <= rating ? 'filled' : ''}">&#9733;</span>`;
            }
        }
        return html;
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function render() {
        widget.innerHTML = `
            <div class="reviews-widget">
                <!-- Stats -->
                <div class="reviews-stats">
                    <div class="reviews-average">
                        <span class="reviews-avg-number">${stats.average_rating || '—'}</span>
                        <div class="reviews-avg-stars">${renderStars(Math.round(stats.average_rating))}</div>
                        <span class="reviews-avg-count">${stats.total} review${stats.total !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="reviews-distribution">
                        ${[5,4,3,2,1].map(star => {
                            const count = stats.distribution[star] || 0;
                            const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0;
                            return `<div class="reviews-bar-row">
                                <span>${star} &#9733;</span>
                                <div class="reviews-bar"><div class="reviews-bar-fill" style="width:${pct}%"></div></div>
                                <span>${count}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Reviews List -->
                <div class="reviews-list">
                    ${reviews.length > 0 ? reviews.map(r => `
                        <div class="review-card">
                            <div class="review-header">
                                <div class="review-stars">${renderStars(r.rating)}</div>
                                <span class="review-date">${formatDate(r.created_at)}</span>
                            </div>
                            ${r.title ? `<h4 class="review-title">${r.title}</h4>` : ''}
                            <p class="review-content">${r.content}</p>
                            <span class="review-author">— ${r.author_name}</span>
                        </div>
                    `).join('') : '<p class="reviews-empty">No reviews yet. Be the first!</p>'}
                </div>

                <!-- Submit Form -->
                <div class="review-form-section">
                    <h3>Leave a Review</h3>
                    <form id="reviewForm">
                        <div class="form-group">
                            <label>Your Name *</label>
                            <input type="text" name="author_name" required placeholder="Your name">
                        </div>
                        <div class="form-group">
                            <label>Email (optional)</label>
                            <input type="email" name="author_email" placeholder="your@email.com">
                        </div>
                        <div class="form-group">
                            <label>Rating *</label>
                            <div class="review-star-select" id="starSelect">
                                ${renderStars(0, true)}
                            </div>
                            <input type="hidden" name="rating" id="ratingInput" value="0">
                        </div>
                        <div class="form-group">
                            <label>Title (optional)</label>
                            <input type="text" name="title" placeholder="Review title">
                        </div>
                        <div class="form-group">
                            <label>Your Review *</label>
                            <textarea name="content" required placeholder="Share your experience..." rows="4"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Submit Review</button>
                    </form>
                    <div id="reviewSuccess" style="display:none;" class="review-success">
                        <h4>Thank you!</h4>
                        <p>Your review has been submitted and will appear after moderation.</p>
                    </div>
                </div>
            </div>
        `;

        // Star select events
        document.querySelectorAll('#starSelect .rev-star').forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating);
                document.getElementById('ratingInput').value = selectedRating;
                document.querySelectorAll('#starSelect .rev-star').forEach((s, i) => {
                    s.classList.toggle('filled', i < selectedRating);
                });
            });

            star.addEventListener('mouseenter', () => {
                const r = parseInt(star.dataset.rating);
                document.querySelectorAll('#starSelect .rev-star').forEach((s, i) => {
                    s.classList.toggle('filled', i < r);
                });
            });
        });

        document.getElementById('starSelect')?.addEventListener('mouseleave', () => {
            document.querySelectorAll('#starSelect .rev-star').forEach((s, i) => {
                s.classList.toggle('filled', i < selectedRating);
            });
        });

        // Form submit
        document.getElementById('reviewForm')?.addEventListener('submit', onSubmit);
    }

    async function onSubmit(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        if (!data.rating || data.rating === '0') {
            alert('Please select a rating');
            return;
        }

        try {
            const res = await fetch(`${API}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                document.getElementById('reviewForm').style.display = 'none';
                document.getElementById('reviewSuccess').style.display = 'block';
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to submit review');
            }
        } catch (e) {
            alert('Connection error');
        }
    }

    async function loadData() {
        try {
            const [revRes, statsRes] = await Promise.all([
                fetch(`${API}/reviews?limit=20`),
                fetch(`${API}/reviews/stats`)
            ]);

            if (revRes.ok) {
                const data = await revRes.json();
                reviews = data.reviews || [];
            }
            if (statsRes.ok) stats = await statsRes.json();

            render();
        } catch (e) {
            widget.innerHTML = '<p>Reviews unavailable</p>';
        }
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .reviews-widget { max-width: 800px; margin: 0 auto; }
        .reviews-stats { display: flex; gap: 32px; padding: 24px; background: #f9f9f9; border-radius: 12px; margin-bottom: 32px; flex-wrap: wrap; }
        .reviews-average { text-align: center; min-width: 120px; }
        .reviews-avg-number { font-size: 48px; font-weight: bold; color: #333; }
        .reviews-avg-stars { margin: 8px 0; }
        .reviews-avg-count { color: #777; font-size: 14px; }
        .reviews-distribution { flex: 1; min-width: 200px; }
        .reviews-bar-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 13px; color: #555; }
        .reviews-bar { flex: 1; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
        .reviews-bar-fill { height: 100%; background: #FFC107; border-radius: 4px; }
        .reviews-list { margin-bottom: 40px; }
        .review-card { padding: 20px; border: 1px solid #e8e8e8; border-radius: 8px; margin-bottom: 12px; }
        .review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .review-date { color: #999; font-size: 13px; }
        .review-title { margin: 4px 0 8px; font-size: 16px; }
        .review-content { color: #555; line-height: 1.6; margin: 0 0 8px; }
        .review-author { color: #777; font-size: 14px; font-style: italic; }
        .rev-star-display, .rev-star { color: #ddd; font-size: 18px; }
        .rev-star-display.filled, .rev-star.filled { color: #FFC107; }
        .rev-star { cursor: pointer; font-size: 28px; transition: color 0.2s; }
        .review-star-select { display: flex; gap: 4px; }
        .review-form-section { padding: 24px; background: #f9f9f9; border-radius: 12px; }
        .review-form-section h3 { margin: 0 0 16px; }
        .review-form-section .form-group { margin-bottom: 16px; }
        .review-form-section label { display: block; margin-bottom: 4px; font-weight: 500; font-size: 14px; }
        .review-form-section input, .review-form-section textarea {
            width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;
        }
        .review-form-section textarea { resize: vertical; }
        .review-success { text-align: center; padding: 20px; }
        .review-success h4 { color: var(--primary-color, #4CAF50); }
        .reviews-empty { color: #999; text-align: center; padding: 40px; }
    `;
    document.head.appendChild(style);

    loadData();
});
