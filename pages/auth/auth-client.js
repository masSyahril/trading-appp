/*
 * Thin fetch wrapper around the api/auth/*.php endpoints, shared by every
 * page under pages/auth/. Those pages live two levels below the app root
 * (pages/auth/login.html), so the API is reached via "../../api/auth".
 */
window.TLAuth = (function () {
  const API_BASE = '../../api/auth';

  async function request(method, path, body) {
    const opts = {
      method,
      credentials: 'same-origin',
    };
    if (body !== undefined) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}/${path}`, opts);
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      /* non-JSON response; data stays {} */
    }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    register: (email, password, displayName) =>
      request('POST', 'register.php', { email, password, display_name: displayName }),
    login: (email, password) => request('POST', 'login.php', { email, password }),
    logout: () => request('POST', 'logout.php'),
    me: () => request('GET', 'me.php'),
    verifyEmail: (token) => request('GET', `verify-email.php?token=${encodeURIComponent(token)}`),
    resendVerification: () => request('POST', 'resend-verification.php'),
    forgotPassword: (email) => request('POST', 'forgot-password.php', { email }),
    resetPassword: (token, password) => request('POST', 'reset-password.php', { token, password }),
    updateProfile: (displayName) => request('POST', 'update-profile.php', { display_name: displayName }),
    changePassword: (currentPassword, newPassword) =>
      request('POST', 'change-password.php', { current_password: currentPassword, new_password: newPassword }),
    listSessions: () => request('GET', 'sessions.php'),
    revokeSession: (sessionId) => request('POST', 'sessions-revoke.php', { session_id: sessionId }),
    revokeOtherSessions: () => request('POST', 'sessions-revoke.php', { all_others: true }),
  };
})();
