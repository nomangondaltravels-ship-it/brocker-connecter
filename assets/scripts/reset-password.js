    const supabaseUrl = 'https://unggpaomyzvurmawnahj.supabase.co';
    const supabaseKey = 'sb_publishable_32o5MAuNPn1e0Uy6ZC09Wg_2skR1xQW';
    let recoverySession = null;

    function setStatus(message = '', tone = 'error') {
      const el = document.getElementById('resetStatus');
      if (!message) {
        el.className = 'status';
        el.textContent = '';
        return;
      }
      el.className = `status active ${tone}`;
      el.textContent = message;
    }

    function getRecoveryParams() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);
      return {
        accessToken: hash.get('access_token') || query.get('access_token') || '',
        refreshToken: hash.get('refresh_token') || query.get('refresh_token') || '',
        expiresAt: hash.get('expires_at') || query.get('expires_at') || '',
        expiresIn: hash.get('expires_in') || query.get('expires_in') || '',
        tokenType: hash.get('token_type') || query.get('token_type') || '',
        type: hash.get('type') || query.get('type') || '',
        tokenHash: query.get('token_hash') || hash.get('token_hash') || '',
        errorDescription: query.get('error_description') || hash.get('error_description') || ''
      };
    }

    function scrubSensitiveResetUrl() {
      if (!window.location.search && !window.location.hash) return;
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    function readStoredRecoverySession() {
      try {
        const sessionRaw = sessionStorage.getItem('broker_supabase_session') || localStorage.getItem('broker_supabase_session') || '';
        localStorage.removeItem('broker_supabase_session');
        if (!sessionRaw) return null;
        const parsed = JSON.parse(sessionRaw);
        return parsed?.access_token ? parsed : null;
      } catch (error) {
        localStorage.removeItem('broker_supabase_session');
        sessionStorage.removeItem('broker_supabase_session');
        return null;
      }
    }

    function storeRecoverySession(session) {
      try {
        sessionStorage.setItem('broker_supabase_session', JSON.stringify(session || {}));
      } catch (error) {
        console.warn('Could not store reset session', error?.message || error);
      }
      localStorage.removeItem('broker_supabase_session');
    }

    async function verifyRecoveryToken(tokenHash, type) {
      const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          token_hash: tokenHash
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.msg || result?.message || result?.error_description || 'This reset link is invalid or expired.');
      }

      return {
        access_token: result?.access_token || result?.session?.access_token || '',
        refresh_token: result?.refresh_token || result?.session?.refresh_token || '',
        expires_at: result?.expires_at || result?.session?.expires_at || '',
        expires_in: result?.expires_in || result?.session?.expires_in || '',
        token_type: result?.token_type || result?.session?.token_type || '',
        type: result?.type || type
      };
    }

    async function initializeRecoverySession() {
      const params = getRecoveryParams();
      if (params.errorDescription) {
        scrubSensitiveResetUrl();
        throw new Error('This reset link is invalid or expired. Please request a new password reset email.');
      }

      if (params.accessToken) {
        scrubSensitiveResetUrl();
        return {
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
          expires_at: params.expiresAt,
          expires_in: params.expiresIn,
          token_type: params.tokenType,
          type: params.type || 'recovery'
        };
      }

      if (params.tokenHash && (params.type || '').toLowerCase() === 'recovery') {
        scrubSensitiveResetUrl();
        return verifyRecoveryToken(params.tokenHash, 'recovery');
      }

      const storedSession = readStoredRecoverySession();
      if (storedSession) return storedSession;

      throw new Error('This reset link is invalid or expired. Please request a new password reset email.');
    }

    function setLoading(isLoading) {
      const button = document.getElementById('resetSubmitBtn');
      button.disabled = Boolean(isLoading);
      button.textContent = isLoading ? 'Saving...' : 'Save New Password';
    }

    (async function prepareReset() {
      try {
        setStatus('Preparing password reset...', 'success');
        recoverySession = await initializeRecoverySession();
        storeRecoverySession(recoverySession);
        setStatus('Your secure reset session is ready. Enter a new password below.', 'success');
      } catch (error) {
        setStatus(error?.message || 'This reset link is invalid or has expired. Please request a new password reset email.');
      }
    })();

    document.getElementById('resetForm').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        setStatus('');
        if (!recoverySession?.access_token) {
          throw new Error('This reset link is invalid or has expired. Please request a new password reset email.');
        }

        const password = String(document.getElementById('newPassword').value || '').trim();
        const confirmPassword = String(document.getElementById('confirmNewPassword').value || '').trim();

        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        setLoading(true);
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'PUT',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${recoverySession.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.msg || result?.message || result?.error_description || 'Password reset failed. Please request a new reset link.');
        }

        setStatus('Password updated successfully. Please sign in.', 'success');
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        sessionStorage.removeItem('broker_supabase_session');
        localStorage.removeItem('broker_supabase_session');
        setTimeout(() => {
          window.location.replace('index.html');
        }, 1600);
      } catch (error) {
        setStatus(error?.message || 'Password reset failed. Please request a new reset link.');
      } finally {
        setLoading(false);
      }
    });
