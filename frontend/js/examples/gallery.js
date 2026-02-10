/**
 * Sky Template - Gallery Frontend Example
 * Photo albums with lightbox viewer
 *
 * Required HTML:
 *   <div id="galleryWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/gallery.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';
    const UPLOADS = API.replace('/api', '') + '/uploads/';

    const widget = document.getElementById('galleryWidget');
    if (!widget) return;

    let albums = [];
    let currentAlbum = null;
    let currentPhotos = [];
    let lightboxIndex = -1;

    function renderAlbums() {
        widget.innerHTML = `
            <div class="gallery-widget">
                <div class="gallery-grid">
                    ${albums.length > 0 ? albums.map(album => `
                        <div class="gallery-album-card" data-album-id="${album.id}">
                            <div class="gallery-album-cover" style="background-image:url('${album.cover_image ? UPLOADS + album.cover_image : ''}')">
                                ${!album.cover_image ? '<span class="gallery-album-empty">No photos</span>' : ''}
                                <span class="gallery-album-count">${album.photo_count} photo${album.photo_count !== 1 ? 's' : ''}</span>
                            </div>
                            <div class="gallery-album-info">
                                <h3>${album.name}</h3>
                                ${album.description ? `<p>${album.description}</p>` : ''}
                            </div>
                        </div>
                    `).join('') : '<p class="gallery-empty">No albums available</p>'}
                </div>
            </div>
        `;

        document.querySelectorAll('.gallery-album-card').forEach(card => {
            card.addEventListener('click', () => loadAlbumPhotos(card.dataset.albumId));
        });
    }

    function renderPhotos() {
        widget.innerHTML = `
            <div class="gallery-widget">
                <button class="gallery-back-btn" id="galleryBack">&larr; Back to albums</button>
                <h2 class="gallery-album-title">${currentAlbum.name}</h2>
                ${currentAlbum.description ? `<p class="gallery-album-desc">${currentAlbum.description}</p>` : ''}
                <div class="gallery-photos-grid">
                    ${currentPhotos.map((photo, i) => `
                        <div class="gallery-photo" data-index="${i}">
                            <img src="${UPLOADS}${photo.image_path}" alt="${photo.caption || ''}" loading="lazy">
                            ${photo.caption ? `<span class="gallery-photo-caption">${photo.caption}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.getElementById('galleryBack')?.addEventListener('click', () => {
            currentAlbum = null;
            currentPhotos = [];
            renderAlbums();
        });

        document.querySelectorAll('.gallery-photo').forEach(el => {
            el.addEventListener('click', () => openLightbox(parseInt(el.dataset.index)));
        });
    }

    function openLightbox(index) {
        lightboxIndex = index;
        const photo = currentPhotos[index];
        if (!photo) return;

        // Remove existing lightbox
        closeLightbox();

        const overlay = document.createElement('div');
        overlay.className = 'gallery-lightbox';
        overlay.id = 'galleryLightbox';
        overlay.innerHTML = `
            <button class="gallery-lb-close">&times;</button>
            ${currentPhotos.length > 1 ? `
                <button class="gallery-lb-prev">&lsaquo;</button>
                <button class="gallery-lb-next">&rsaquo;</button>
            ` : ''}
            <div class="gallery-lb-content">
                <img src="${UPLOADS}${photo.image_path}" alt="${photo.caption || ''}">
                ${photo.caption ? `<p class="gallery-lb-caption">${photo.caption}</p>` : ''}
                <span class="gallery-lb-counter">${index + 1} / ${currentPhotos.length}</span>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Events
        overlay.querySelector('.gallery-lb-close').addEventListener('click', closeLightbox);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLightbox(); });
        overlay.querySelector('.gallery-lb-prev')?.addEventListener('click', () => navigateLightbox(-1));
        overlay.querySelector('.gallery-lb-next')?.addEventListener('click', () => navigateLightbox(1));

        // Keyboard
        document.addEventListener('keydown', onKeydown);
    }

    function navigateLightbox(dir) {
        let newIndex = lightboxIndex + dir;
        if (newIndex < 0) newIndex = currentPhotos.length - 1;
        if (newIndex >= currentPhotos.length) newIndex = 0;
        closeLightbox();
        openLightbox(newIndex);
    }

    function onKeydown(e) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
    }

    function closeLightbox() {
        const lb = document.getElementById('galleryLightbox');
        if (lb) {
            lb.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKeydown);
        }
    }

    async function loadAlbums() {
        try {
            const res = await fetch(`${API}/gallery/albums`);
            if (res.ok) albums = await res.json();
            if (albums.length > 0) renderAlbums();
            else widget.innerHTML = '<p>Gallery unavailable</p>';
        } catch (e) {
            widget.innerHTML = '<p>Gallery unavailable</p>';
        }
    }

    async function loadAlbumPhotos(albumId) {
        try {
            const res = await fetch(`${API}/gallery/albums/${albumId}/photos`);
            if (res.ok) {
                const data = await res.json();
                currentAlbum = data.album;
                currentPhotos = data.photos || [];
                renderPhotos();
            }
        } catch (e) {
            widget.innerHTML = '<p>Album unavailable</p>';
        }
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .gallery-widget { max-width: 1000px; margin: 0 auto; }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        .gallery-album-card { border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; border: 1px solid #e8e8e8; }
        .gallery-album-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .gallery-album-cover { height: 200px; background-size: cover; background-position: center; background-color: #f0f0f0; position: relative; display: flex; align-items: center; justify-content: center; }
        .gallery-album-empty { color: #999; font-size: 14px; }
        .gallery-album-count { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; }
        .gallery-album-info { padding: 16px; }
        .gallery-album-info h3 { margin: 0 0 4px; font-size: 16px; }
        .gallery-album-info p { margin: 0; color: #777; font-size: 13px; }
        .gallery-back-btn { background: none; border: none; color: var(--primary-color, #4CAF50); cursor: pointer; font-size: 15px; padding: 8px 0; margin-bottom: 12px; }
        .gallery-back-btn:hover { text-decoration: underline; }
        .gallery-album-title { margin: 0 0 8px; font-size: 24px; }
        .gallery-album-desc { color: #777; margin: 0 0 24px; }
        .gallery-photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .gallery-photo { border-radius: 8px; overflow: hidden; cursor: pointer; position: relative; aspect-ratio: 1; }
        .gallery-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .gallery-photo:hover img { transform: scale(1.05); }
        .gallery-photo-caption { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px; background: rgba(0,0,0,0.5); color: #fff; font-size: 12px; }
        .gallery-lightbox { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; }
        .gallery-lb-close { position: absolute; top: 16px; right: 20px; background: none; border: none; color: #fff; font-size: 36px; cursor: pointer; z-index: 10001; }
        .gallery-lb-prev, .gallery-lb-next { position: absolute; top: 50%; transform: translateY(-50%); background: none; border: none; color: #fff; font-size: 48px; cursor: pointer; z-index: 10001; padding: 20px; }
        .gallery-lb-prev { left: 10px; }
        .gallery-lb-next { right: 10px; }
        .gallery-lb-content { text-align: center; max-width: 90%; max-height: 90%; }
        .gallery-lb-content img { max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 4px; }
        .gallery-lb-caption { color: #ccc; margin-top: 12px; font-size: 14px; }
        .gallery-lb-counter { color: #888; font-size: 13px; display: block; margin-top: 8px; }
        .gallery-empty { text-align: center; color: #999; padding: 40px; }
        @media (max-width: 640px) { .gallery-photos-grid { grid-template-columns: repeat(2, 1fr); } .gallery-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);

    loadAlbums();
});
