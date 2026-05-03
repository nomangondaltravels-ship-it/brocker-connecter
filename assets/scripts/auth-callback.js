    const supabaseUrl = 'https://unggpaomyzvurmawnahj.supabase.co';
    const supabaseKey = 'sb_publishable_32o5MAuNPn1e0Uy6ZC09Wg_2skR1xQW';

    function setState(title, copy, message, tone = 'success') {
      document.getElementById('callbackTitle').textContent = title;
      document.getElementById('callbackCopy').textContent = copy;
      const status = document.getElementById('callbackStatus');
      status.className = `status ${tone}`;
      status.textContent = message;
    }

    function getHashParams() {
      return new URLSearchParams(window.location.hash.replace(/^#/, ''));
    }

    function buildSessionFromParams(query, hash) {
      const accessToken = hash.get('access_token') || query.get('access_token') || '';
      const refreshToken = hash.get('refresh_token') || query.get('refresh_token') || '';
      const expiresAt = hash.get('expires_at') || query.get('expires_at') || '';
      const expiresIn = hash.get('expires_in') || query.get('expires_in') || '';
      const tokenType = hash.get('token_type') || query.get('token_type') || '';
      const type = hash.get('type') || query.get('type') || '';
      if (!accessToken) return null;
      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        expires_in: expiresIn,
        token_type: tokenType,
        type
      };
    }

    async function verifyTokenHash(type, tokenHash) {
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
        throw new Error(result?.msg || result?.message || result?.error_description || 'This auth link is invalid or expired.');
      }
      return result;
    }

    function buildHashFromSession(session, type) {
      const params = new URLSearchParams();
      if (session?.access_token) params.set('access_token', session.access_token);
      if (session?.refresh_token) params.set('refresh_token', session.refresh_token);
      if (session?.expires_at) params.set('expires_at', session.expires_at);
      if (session?.expires_in) params.set('expires_in', session.expires_in);
      if (session?.token_type) params.set('token_type', session.token_type);
      if (type) params.set('type', type);
      return params.toString();
    }

    async function exchangeSession(session) {
      const response = await fetch('/api/broker-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'exchange-session',
          accessToken: session?.access_token || '',
          refreshToken: session?.refresh_token || ''
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || 'Unable to complete secure sign in.');
      }
      localStorage.setItem('broker_session_token', result.token || '');
      localStorage.setItem('broker_session_profile', JSON.stringify(result.broker || {}));
      localStorage.setItem('broker_supabase_session', JSON.stringify(result.session || session || {}));
      return result;
    }

    (async function init() {
      const query = new URLSearchParams(window.location.search);
      const hash = getHashParams();
      const errorDescription = query.get('error_description') || hash.get('error_description') || query.get('message') || '';
      const type = query.get('type') || hash.get('type') || '';
      const tokenHash = query.get('token_hash') || hash.get('token_hash') || '';

      if (errorDescription) {
        setState(
          'Link unavailable',
          'This auth link can no longer be used.',
          'Confirmation link is invalid or expired.',
          'error'
        );
        setTimeout(() => {
          window.location.replace('index.html?auth=confirmation-invalid');
        }, 1800);
        return;
      }

      try {
        let session = buildSessionFromParams(query, hash);
        let resolvedType = type;

        if (!session && tokenHash && resolvedType) {
          setState(
            resolvedType === 'recovery' ? 'Preparing password reset...' : 'Completing secure sign in...',
            'Please wait while we verify your secure email link.',
            resolvedType === 'recovery' ? 'Preparing password reset...' : 'Signing you in...',
            'success'
          );
          const verified = await verifyTokenHash(resolvedType, tokenHash);
          session = {
            access_token: verified?.access_token || verified?.session?.access_token || '',
            refresh_token: verified?.refresh_token || verified?.session?.refresh_token || '',
            expires_at: verified?.expires_at || verified?.session?.expires_at || '',
            expires_in: verified?.expires_in || verified?.session?.expires_in || '',
            token_type: verified?.token_type || verified?.session?.token_type || ''
          };
          resolvedType = verified?.type || resolvedType;
        }

        if (resolvedType === 'recovery') {
          if (!session?.access_token) {
            throw new Error('This reset link is invalid or expired.');
          }
          setState(
            'Reset your password',
            'We are sending you to the secure password reset form.',
            'Preparing password reset...',
            'success'
          );
          const target = new URL('reset-password.html', window.location.href);
          target.hash = buildHashFromSession(session, 'recovery');
          setTimeout(() => {
            window.location.replace(target.toString());
          }, 450);
          return;
        }

        if (session?.access_token) {
          setState(
            'Signing you in...',
            'Your secure sign-in link has been verified.',
            'Creating your broker session...',
            'success'
          );
          await exchangeSession(session);
          setState(
            'Signed in successfully',
            'Your broker session is ready.',
            'Redirecting to Broker Desk...',
            'success'
          );
          setTimeout(() => {
            window.location.replace('dashboard.html');
          }, 500);
          return;
        }

        setState(
          'Email confirmed',
          'Your broker account email has been confirmed successfully.',
          'Email confirmed successfully. Redirecting to sign in...',
          'success'
        );
        setTimeout(() => {
          window.location.replace('index.html?auth=confirmed');
        }, 1200);
      } catch (error) {
        setState(
          'Link unavailable',
          'This auth link can no longer be used.',
          error?.message || 'Confirmation link is invalid or expired.',
          'error'
        );
        setTimeout(() => {
          window.location.replace(`index.html?auth=confirmation-invalid&message=${encodeURIComponent(error?.message || 'Confirmation link is invalid or expired.')}`);
        }, 2200);
      }
    })();
