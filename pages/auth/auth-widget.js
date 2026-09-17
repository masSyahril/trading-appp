/*
 * Drop-in "Sign In / Register" -> "Hi, {name} v" account widget.
 *
 * Usage: put an empty mount element wherever the header should show it, and
 * point this script at it:
 *
 *   <div data-tl-auth-widget
 *        data-api-base="../api"          (path to the api/ folder from this page)
 *        data-auth-base="../pages/auth"  (path to pages/auth/ from this page)
 *        data-home="../"></div>          (path back to the TradeLite hub)
 *   <script src="../pages/auth/auth-widget.js" defer></script>
 *
 * Self-contained: injects its own <style> tag once, so no extra <link> is
 * needed in the host page's <head>, and its class names are namespaced
 * (tl-authw-*) to avoid colliding with the host page's own CSS.
 */
(function () {
  const STYLE_ID = 'tl-authw-styles';

  function t(key, vars) {
    return window.TLI18n ? window.TLI18n.t(key, vars) : key;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tl-authw { position: relative; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; }
      .tl-authw a, .tl-authw button {
        font-family: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;
        border-radius: 7px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06);
        color: #e6edf3; padding: 6px 12px; text-decoration: none; line-height: 1.2;
        display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
      }
      .tl-authw a:hover, .tl-authw button:hover { background: rgba(255,255,255,0.14); }
      .tl-authw .tl-authw-primary { background: linear-gradient(90deg,#58a6ff,#79c0ff); color:#04101c; border-color: transparent; }
      .tl-authw .tl-authw-primary:hover { opacity: 0.9; background: linear-gradient(90deg,#58a6ff,#79c0ff); }
      .tl-authw-menu-wrap { position: relative; }
      .tl-authw-menu {
        position: absolute; top: calc(100% + 8px); right: 0; min-width: 190px;
        background: #1c2128; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px;
        box-shadow: 0 12px 28px rgba(0,0,0,0.45); padding: 6px; z-index: 1000; display: none;
      }
      .tl-authw-menu.open { display: block; }
      .tl-authw-menu-item {
        display: flex; width: 100%; text-align: left; background: none; border: none; color: #e6edf3;
        padding: 8px 10px; border-radius: 6px; font-size: 0.82rem; font-weight: 500; cursor: pointer;
        text-decoration: none; box-sizing: border-box;
      }
      .tl-authw-menu-item:hover { background: rgba(255,255,255,0.08); }
      .tl-authw-unverified { color: #ffb454; }
      .tl-authw-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
    `;
    document.head.appendChild(style);
  }

  function mount(el) {
    const apiBase = el.getAttribute('data-api-base') || 'api';
    const authBase = el.getAttribute('data-auth-base') || 'pages/auth';

    function renderLoggedOut() {
      el.innerHTML = `
        <div class="tl-authw">
          <a href="${authBase}/login.html">${t('authWidget.signIn')}</a>
          <a href="${authBase}/register.html" class="tl-authw-primary">${t('authWidget.register')}</a>
        </div>`;
    }

    function renderLoggedIn(user) {
      const initial = (user.display_name || user.email || '?').trim().charAt(0).toUpperCase();
      el.innerHTML = `
        <div class="tl-authw">
          <div class="tl-authw-menu-wrap">
            <button type="button" id="tl-authw-toggle">
              <span>${initial}</span>
              <span class="tl-authw-name">${escapeHtml(user.display_name || user.email)}</span>
              <span>&#9662;</span>
            </button>
            <div class="tl-authw-menu" id="tl-authw-menu">
              <a href="${authBase}/account.html" class="tl-authw-menu-item">${t('authWidget.accountSettings')}</a>
              ${!user.email_verified ? `<button type="button" class="tl-authw-menu-item tl-authw-unverified" id="tl-authw-resend">${t('authWidget.verifyEmailAddress')}</button>` : ''}
              <button type="button" class="tl-authw-menu-item" id="tl-authw-logout">${t('authWidget.logOut')}</button>
            </div>
          </div>
        </div>`;

      const toggle = el.querySelector('#tl-authw-toggle');
      const menu = el.querySelector('#tl-authw-menu');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
      document.addEventListener('click', () => menu.classList.remove('open'));

      const logoutBtn = el.querySelector('#tl-authw-logout');
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.textContent = t('authWidget.loggingOut');
        try {
          await fetch(`${apiBase}/auth/logout.php`, { method: 'POST', credentials: 'same-origin' });
        } catch (e) { /* ignore network errors, still reload */ }
        // Clear this account's paper-trading state from the shared browser
        // storage so it can't be picked up as the next signed-in user's
        // starting data on this same device (see portfolio-sync.js).
        try {
          localStorage.removeItem('stock_portfolio');
          localStorage.removeItem('stock_watchlist');
        } catch (e) { /* ignore */ }
        window.location.reload();
      });

      const resendBtn = el.querySelector('#tl-authw-resend');
      if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
          resendBtn.textContent = t('authWidget.sending');
          try {
            await fetch(`${apiBase}/auth/resend-verification.php`, { method: 'POST', credentials: 'same-origin' });
            resendBtn.textContent = t('authWidget.sent');
          } catch (e) {
            resendBtn.textContent = t('authWidget.sendFailed');
          }
        });
      }
    }

    function escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    function fetchAndRender() {
      fetch(`${apiBase}/auth/me.php`, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.authenticated) {
            renderLoggedIn(data.user);
          } else {
            renderLoggedOut();
          }
        })
        .catch(() => renderLoggedOut());
    }

    // Store the re-render entry point on the element itself so a later
    // language switch can redraw this exact widget without every mounted
    // widget needing its own module-level registry.
    el._tlRerender = fetchAndRender;
    fetchAndRender();
  }

  function mountAll() {
    ensureStyles();
    document.querySelectorAll('[data-tl-auth-widget]').forEach(mount);
  }

  function init() {
    // Wait for translations so the first paint is already in the right
    // language instead of flashing English then relabeling itself.
    if (window.TLI18n && window.TLI18n.ready) {
      window.TLI18n.ready.then(mountAll).catch(mountAll);
    } else {
      mountAll();
    }

    window.addEventListener('tl:localechange', () => {
      document.querySelectorAll('[data-tl-auth-widget]').forEach((el) => {
        if (typeof el._tlRerender === 'function') el._tlRerender();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
