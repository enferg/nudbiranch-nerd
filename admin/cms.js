/**
 * Nudibranch Nerd CMS — Client Library
 * ======================================
 * Drop-in inline editor for any static site.
 *
 * Usage on any page:
 *   1. Add data-cms-id="unique-key" to editable elements.
 *      For images: <img data-cms-id="hero-photo" ...>
 *      For embeds: <div data-cms-id="video" data-cms-type="html">...</div>
 *      Text is auto-detected from tag name.
 *
 *   2. Add before </body>:
 *      <link rel="stylesheet" href="/admin/cms.css">
 *      <script src="/admin/cms.js"></script>
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'cms_token';
  const LOAD_FN   = '/.netlify/functions/cms-load';
  const SAVE_FN   = '/.netlify/functions/cms-save';

  // ─── Helpers ───────────────────────────────────────────────

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function getPageKey() {
    // Normalize: "/" → "index", "/about.html" → "about.html"
    const path = window.location.pathname;
    return path.replace(/^\//, '') || 'index';
  }

  function setStatus(msg) {
    const el = document.getElementById('cms-status');
    if (el) el.textContent = msg;
  }

  function inferType(el) {
    if (el.dataset.cmsType) return el.dataset.cmsType;
    if (el.tagName === 'IMG') return 'image';
    return 'text';
  }

  // ─── Content loading (runs for ALL visitors) ───────────────

  async function loadContent() {
    try {
      const res = await fetch(`${LOAD_FN}?page=${encodeURIComponent(window.location.pathname)}`);
      if (!res.ok) return;
      const data = await res.json();
      applyContent(data);
    } catch {
      // Silently fall back to static HTML
    }
  }

  function applyContent(data) {
    for (const [id, value] of Object.entries(data)) {
      const el = document.querySelector(`[data-cms-id="${id}"]`);
      if (!el) continue;
      const type = inferType(el);
      if (type === 'image') {
        el.src = value;
      } else if (type === 'html') {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }
  }

  // ─── Admin toolbar ─────────────────────────────────────────

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.id = 'cms-toolbar';
    bar.innerHTML = `
      <span class="cms-label">CMS</span>
      <button id="cms-btn-edit">Edit</button>
      <button id="cms-btn-save" disabled>Save</button>
      <button id="cms-btn-cancel" style="display:none">Cancel</button>
      <div class="cms-divider"></div>
      <button id="cms-btn-logout">Logout</button>
      <span id="cms-status"></span>
    `;
    document.body.appendChild(bar);

    document.getElementById('cms-btn-edit').addEventListener('click', enterEditMode);
    document.getElementById('cms-btn-save').addEventListener('click', saveChanges);
    document.getElementById('cms-btn-cancel').addEventListener('click', cancelEdit);
    document.getElementById('cms-btn-logout').addEventListener('click', logout);
  }

  // ─── Edit mode ─────────────────────────────────────────────

  let snapshot = {};    // original values before editing
  let pending  = {};    // changed values

  function enterEditMode() {
    snapshot = {};
    pending  = {};

    document.querySelectorAll('[data-cms-id]').forEach(el => {
      const id   = el.dataset.cmsId;
      const type = inferType(el);

      if (type === 'image') {
        snapshot[id] = el.src;
        activateImageEl(el);
      } else if (type === 'html') {
        snapshot[id] = el.innerHTML;
        activateHtmlEl(el);
      } else {
        snapshot[id] = el.textContent;
        el.setAttribute('contenteditable', 'true');
        el.dataset.cmsActive = '1';
        el.addEventListener('input', () => { pending[id] = el.textContent; }, { passive: true });
      }
    });

    document.getElementById('cms-btn-edit').style.display   = 'none';
    document.getElementById('cms-btn-save').disabled        = false;
    document.getElementById('cms-btn-cancel').style.display = '';
    setStatus('Edit mode');
  }

  function cancelEdit() {
    // Restore originals
    document.querySelectorAll('[data-cms-id]').forEach(el => {
      const id   = el.dataset.cmsId;
      const type = inferType(el);
      if (type === 'image') {
        el.src = snapshot[id] || el.src;
        deactivateImageEl(el);
      } else if (type === 'html') {
        el.innerHTML = snapshot[id] || el.innerHTML;
        delete el.dataset.cmsActive;
      } else {
        el.textContent = snapshot[id] || el.textContent;
        el.removeAttribute('contenteditable');
        delete el.dataset.cmsActive;
      }
    });
    resetToolbar();
    setStatus('Cancelled');
    setTimeout(() => setStatus(''), 2000);
  }

  function resetToolbar() {
    document.getElementById('cms-btn-edit').style.display   = '';
    document.getElementById('cms-btn-save').disabled        = true;
    document.getElementById('cms-btn-cancel').style.display = 'none';
    pending = {};
  }

  // ─── Image editing ─────────────────────────────────────────

  function activateImageEl(img) {
    img.dataset.cmsActive = '1';
    // Wrap in a relative container if not already
    let wrap = img.parentElement;
    if (!wrap.classList.contains('cms-img-wrap')) {
      wrap = document.createElement('span');
      wrap.className = 'cms-img-wrap';
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
    }
    const overlay = document.createElement('div');
    overlay.className = 'cms-img-overlay';
    overlay.innerHTML = '<span>Replace Image</span>';
    wrap.appendChild(overlay);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    wrap.appendChild(input);

    overlay.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
        pending[img.dataset.cmsId] = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function deactivateImageEl(img) {
    delete img.dataset.cmsActive;
    const wrap = img.parentElement;
    if (wrap && wrap.classList.contains('cms-img-wrap')) {
      wrap.querySelectorAll('.cms-img-overlay, input[type="file"]').forEach(el => el.remove());
    }
  }

  // ─── HTML/embed editing ────────────────────────────────────

  function activateHtmlEl(el) {
    el.dataset.cmsActive = '1';
    el.style.cursor = 'pointer';
    el.title = 'Click to edit';

    el.addEventListener('click', () => openHtmlModal(el), { once: true });
  }

  function openHtmlModal(el) {
    const id = el.dataset.cmsId;
    const modal = document.createElement('div');
    modal.id = 'cms-html-modal';
    modal.innerHTML = `
      <div class="cms-modal-box">
        <label>HTML / Embed Code — <strong>${id}</strong></label>
        <textarea id="cms-html-ta">${escapeHtml(el.innerHTML)}</textarea>
        <div class="cms-modal-actions">
          <button id="cms-modal-cancel">Cancel</button>
          <button id="cms-modal-apply" class="primary">Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cms-modal-cancel').addEventListener('click', () => {
      modal.remove();
      // Re-attach click listener for next time
      el.addEventListener('click', () => openHtmlModal(el), { once: true });
    });

    document.getElementById('cms-modal-apply').addEventListener('click', () => {
      const val = document.getElementById('cms-html-ta').value;
      el.innerHTML = val;
      pending[id] = val;
      modal.remove();
      el.addEventListener('click', () => openHtmlModal(el), { once: true });
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Save ──────────────────────────────────────────────────

  async function saveChanges() {
    if (!Object.keys(pending).length) {
      setStatus('Nothing changed');
      setTimeout(() => setStatus('Edit mode'), 1500);
      return;
    }

    const saveBtn = document.getElementById('cms-btn-save');
    saveBtn.disabled = true;
    setStatus('Saving…');

    try {
      const res = await fetch(SAVE_FN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          page: window.location.pathname,
          content: pending,
        }),
      });

      if (res.status === 401) {
        logout();
        return;
      }

      if (!res.ok) throw new Error('Save failed');

      setStatus('Saved!');
      // Merge pending into snapshot
      Object.assign(snapshot, pending);
      pending = {};
      setTimeout(() => setStatus('Edit mode'), 2000);
    } catch (err) {
      setStatus('Error — try again');
      console.error(err);
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ─── Logout ────────────────────────────────────────────────

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }

  // ─── Init ──────────────────────────────────────────────────

  async function init() {
    // Always load saved content for all visitors
    await loadContent();

    // Only show admin UI if logged in
    const token = getToken();
    if (!token) return;

    // Inject stylesheet if not already present
    if (!document.querySelector('link[href*="cms.css"]')) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = '/admin/cms.css';
      document.head.appendChild(link);
    }

    buildToolbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
