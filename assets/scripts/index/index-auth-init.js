    function setAuthMode(mode) {
      const authIntent = getActiveAuthIntent();
      const contactRevealIntent = authIntent?.type === 'contact-reveal';
      state.authMode = mode;
      const authCard = document.querySelector('#authModal .auth-card');
      if (authCard) authCard.dataset.mode = mode;
      document.getElementById('tabSignin').classList.toggle('active', mode === 'signin');
      document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
      document.getElementById('authTitle').textContent = contactRevealIntent
        ? 'Sign in to your account to reveal broker number'
        : mode === 'register'
          ? 'Register with NexBridge'
          : mode === 'forgot'
            ? 'Forgot Password'
            : 'Sign In to NexBridge';
      document.getElementById('authCopy').textContent = contactRevealIntent
        ? 'Create an account to unlock broker contact details.'
        : mode === 'register'
          ? 'Create your NexBridge account with email and password. If email confirmation is enabled, we will ask you to confirm your email before signing in.'
          : mode === 'forgot'
            ? 'Enter your email address and we will send you a secure password reset link.'
            : 'Sign in with your email address and password to open your separate private dashboard.';
      document.getElementById('authSubmitBtn').textContent = mode === 'register'
        ? 'Register and Continue'
        : mode === 'forgot'
          ? 'Send Reset Link'
          : 'Sign In and Continue';
      document.getElementById('fullNameWrap').style.display = mode === 'register' ? 'block' : 'none';
      document.getElementById('companyWrap').style.display = mode === 'register' ? 'block' : 'none';
      document.getElementById('brokerIdWrap').style.display = 'none';
      document.getElementById('emailWrap').style.display = 'block';
      document.getElementById('mobileWrap').style.display = mode === 'register' ? 'block' : 'none';
      document.getElementById('passwordWrap').style.display = mode === 'forgot' ? 'none' : 'block';
      document.getElementById('confirmPasswordWrap').style.display = mode === 'register' ? 'block' : 'none';
      document.getElementById('forgotPasswordRow').style.display = mode === 'signin' ? 'block' : 'none';
      document.getElementById('authBackRow').classList.toggle('hidden', mode !== 'forgot');
      document.getElementById('authFullName').required = mode === 'register';
      document.getElementById('authEmail').required = true;
      document.getElementById('authConfirmPassword').required = mode === 'register';
      document.getElementById('authPassword').setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
      document.getElementById('authConfirmPassword').setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'off');
      document.getElementById('authStatus').className = 'auth-status';
      document.getElementById('authStatus').textContent = '';
      state.authCompanyQuery = String(document.getElementById('authCompany')?.value || '');
      state.authCompanyMenuOpen = false;
      state.authCompanyActiveIndex = -1;
      renderAuthCompanySuggestions();
      if (mode === 'register') {
        ensureApprovedCompanySuggestionsLoaded();
      }
      state.authRequestId += 1;
      setAuthSubmitLoading(false, mode);
    }

    function setAuthStatus(message = '', tone = 'error') {
      const status = document.getElementById('authStatus');
      if (!message) {
        status.className = 'auth-status';
        status.textContent = '';
        return;
      }
      status.className = `auth-status active ${tone}`;
      status.textContent = message;
    }

    function findLegacyBrokerAccount(identifier, password) {
      const accounts = safeJsonRead('broker_accounts', []);
      const normalizedIdentifierPhone = normalizePhoneNumber(identifier);
      return (Array.isArray(accounts) ? accounts : []).find(account => {
        const brokerIdMatch = String(account?.brokerId || '') === String(identifier || '');
        const phoneMatch = normalizePhoneNumber(account?.phone) === normalizedIdentifierPhone;
        const emailMatch = String(account?.email || '').trim().toLowerCase() === String(identifier || '').trim().toLowerCase();
        const passwordMatch = String(account?.password || '') === String(password || '');
        return passwordMatch && (brokerIdMatch || phoneMatch || emailMatch);
      }) || null;
    }

    async function migrateLegacyBrokerAccount(identifier, password) {
      const account = findLegacyBrokerAccount(identifier, password);
      if (!account) return null;

      const registerPayload = {
        action: 'register',
        fullName: account.name || 'Broker',
        companyName: account.company || '',
        mobileNumber: account.phone || identifier,
        email: account.email || `${String(account.brokerId || 'broker').toLowerCase()}@brokerconnector.local`,
        password,
        confirmPassword: password
      };

      const registerResponse = await fetch('/api/broker-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerPayload)
      });
      const registerResult = await registerResponse.json().catch(() => ({}));

      if (registerResponse.ok && registerResult?.token) {
        return registerResult;
      }

      if (registerResponse.status === 409) {
        const loginEmail = account.email || `${String(account.brokerId || 'broker').toLowerCase()}@brokerconnector.local`;
        const loginResponse = await fetch('/api/broker-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'login',
            email: loginEmail,
            password
          })
        });
        const loginResult = await loginResponse.json().catch(() => ({}));
        if (loginResponse.ok && loginResult?.token) {
          return loginResult;
        }
      }

      throw new Error(registerResult?.message || 'Legacy broker migration failed.');
    }

    function openAuthModal(mode = 'signin') {
      setAuthMode(mode);
      document.getElementById('authModal').classList.add('active');
      if (mode === 'register') {
        ensureApprovedCompanySuggestionsLoaded();
      }
    }

    function closeAuthModal() {
      document.getElementById('authModal').classList.remove('active');
      closeAuthCompanyMenu();
      setAuthStatus('');
      clearMarketplaceAuthIntent();
    }

    async function completeMarketplaceContactRevealAuth() {
      const intent = getActiveAuthIntent();
      if (!intent || intent.type !== 'contact-reveal') return false;

      state.forcePublicView = true;
      const returnUrl = normalizeText(intent.returnTo) || buildMarketplaceReturnUrl(intent.sectionName, intent.listingId);
      if (returnUrl) {
        const nextUrl = new URL(returnUrl, window.location.href);
        window.history.replaceState({}, document.title, nextUrl.toString());
      }

      closeAuthModal();
      try {
        await loadPublicListings();
      } catch (error) {
        console.error('Could not reload NexBridge Marketplace after auth.', error);
      }

      if (intent.sectionName) {
        openSection(intent.sectionName);
      }
      if (intent.listingId && intent.sectionName) {
        state.selectedPublicListingKeys[intent.sectionName] = `${intent.sectionName}:${intent.listingId}`;
        state.revealedPublicContactKeys[intent.sectionName] = `${intent.sectionName}:${intent.listingId}`;
      }
      safeRenderPublicViews();
      clearMarketplaceRevealParams(intent.sectionName || state.activeSection);
      clearMarketplaceAuthIntent();
      setSystemBanner('Broker contact details unlocked.', 'success');
      return true;
    }

    function restoreMarketplaceContactRevealIfNeeded() {
      if (!isMarketplaceBrokerAuthenticated()) return false;
      const intent = getActiveAuthIntent();
      const params = new URLSearchParams(window.location.search);
      const revealRequested = params.get('revealContact') === '1';
      const sectionName = normalizeText(intent?.sectionName || params.get('section') || state.activeSection || 'marketplace');
      const listingId = normalizeText(intent?.listingId || params.get('listing'));
      if (!revealRequested && !intent?.listingId) return false;
      if (!sectionName || !listingId) return false;
      const listing = findMarketplaceListing(sectionName, listingId);
      if (!canAccessBrokerContact(listing)) return false;
      state.selectedPublicListingKeys[sectionName] = `${sectionName}:${listingId}`;
      state.revealedPublicContactKeys[sectionName] = `${sectionName}:${listingId}`;
      openSection(sectionName);
      safeRenderPublicViews();
      clearMarketplaceRevealParams(sectionName);
      clearMarketplaceAuthIntent();
      return true;
    }

    async function verifyBrokerSession() {
      if (state.forcePublicView) {
        return false;
      }
      if (!state.sessionToken) return false;
      const response = await fetch('/api/broker-auth', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${state.sessionToken}`
        }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.authenticated) {
        clearBrokerSessionState();
        return false;
      }
      if (!result?.broker || typeof result.broker !== 'object') {
        clearBrokerSessionState();
        return false;
      }
      localStorage.setItem('broker_session_profile', JSON.stringify(result.broker));
      state.brokerProfile = result.broker;
      window.location.href = 'dashboard.html';
      return true;
    }

    function handleAuthReturnMessage() {
      const params = new URLSearchParams(window.location.search);
      const authState = String(params.get('auth') || '').trim();
      const authMessage = String(params.get('message') || '').trim();
      if (!authState && !authMessage) return;

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('auth');
      cleanUrl.searchParams.delete('message');
      window.history.replaceState({}, document.title, cleanUrl.toString());

      openAuthModal('signin');
      if (authState === 'confirmed') {
        setAuthStatus('Email confirmed successfully. You can now sign in.', 'success');
        return;
      }
      if (authState === 'confirmation-invalid') {
        setAuthStatus('Confirmation link is invalid or expired.', 'error');
        return;
      }
      if (authMessage) {
        setAuthStatus(getAuthFailureMessage({ message: authMessage }), authState.includes('invalid') ? 'error' : 'success');
      }
    }

    function redirectIncomingAuthLink() {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hasAuthTokens = Boolean(
        hash.get('access_token')
        || query.get('access_token')
        || hash.get('token_hash')
        || query.get('token_hash')
        || hash.get('error_description')
        || query.get('error_description')
      );
      if (!hasAuthTokens) return false;

      const authType = query.get('type') || hash.get('type') || '';
      const target = new URL(authType === 'recovery' ? 'reset-password.html' : 'auth-callback.html', window.location.href);
      if (window.location.search) {
        target.search = window.location.search;
      }
      if (window.location.hash) {
        target.hash = window.location.hash;
      }
      window.location.replace(target.toString());
      return true;
    }

    document.getElementById('authForm').addEventListener('submit', async event => {
      event.preventDefault();
      const modeAtSubmit = state.authMode;
      const requestId = state.authRequestId + 1;
      state.authRequestId = requestId;
      try {
        setAuthStatus('');
        const mobileValue = normalizePhoneNumber(document.getElementById('authMobile').value);
        const emailValue = String(document.getElementById('authEmail').value || '').trim().toLowerCase();
        const passwordValue = String(document.getElementById('authPassword').value || '').trim();
        const confirmPasswordValue = String(document.getElementById('authConfirmPassword').value || '').trim();
        if (!emailValue) {
          throw new Error(modeAtSubmit === 'forgot' ? 'Enter your email address' : 'Enter email');
        }
        if (!isValidEmailAddress(emailValue)) {
          throw new Error(modeAtSubmit === 'forgot' ? 'Invalid email address' : 'Enter a valid email address');
        }
        if (modeAtSubmit !== 'forgot' && !passwordValue) {
          throw new Error('Enter password');
        }
        if (modeAtSubmit === 'register') {
          if (String(document.getElementById('authFullName').value || '').trim().length < 2) {
            throw new Error('Enter full name');
          }
          if (!emailValue || !isValidEmailAddress(emailValue)) {
            throw new Error('Enter a valid email address');
          }
          if (passwordValue !== confirmPasswordValue) {
            throw new Error('Passwords do not match');
          }
        }
        setAuthSubmitLoading(true, modeAtSubmit);
        const payload = modeAtSubmit === 'register'
          ? {
              action: 'register',
              fullName: document.getElementById('authFullName').value,
              companyName: document.getElementById('authCompany').value,
              mobileNumber: mobileValue,
              email: emailValue,
              password: passwordValue,
              confirmPassword: confirmPasswordValue,
              redirectTo: new URL('auth-callback.html', window.location.href).toString()
            }
          : modeAtSubmit === 'forgot'
            ? {
                action: 'forgot-password',
                email: emailValue,
                redirectTo: new URL('reset-password.html', window.location.href).toString()
              }
          : {
              action: 'login',
              email: emailValue,
              password: passwordValue
            };

        let response = null;
        let result = null;
        if (modeAtSubmit === 'forgot') {
          result = await requestPasswordResetEmail(emailValue);
        } else {
          response = await fetch('/api/broker-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          result = await response.json().catch(() => ({}));
        }

        if (response && !response.ok) {
          throw new Error(getAuthFailureMessage(result, modeAtSubmit));
        }

        if (state.authRequestId !== requestId) {
          return;
        }

        if (modeAtSubmit === 'forgot') {
          showActionToast('success', result?.message || 'Request submitted successfully.');
          setAuthStatus(result?.message || 'If an account exists for this email, a reset link has been sent.', 'success');
          return;
        }

        if (modeAtSubmit === 'register' && result?.requiresEmailConfirmation) {
          document.getElementById('authPassword').value = '';
          document.getElementById('authConfirmPassword').value = '';
          setAuthMode('signin');
          document.getElementById('authEmail').value = emailValue;
          showActionToast('success', 'Registration successful.');
          setAuthStatus(result?.message || 'Check your email to confirm your account.', 'success');
          return;
        }

        if (!persistBrokerSession(result)) {
          if (modeAtSubmit === 'register') {
            setAuthMode('signin');
            document.getElementById('authEmail').value = emailValue;
            setAuthStatus(result?.message || 'Account created successfully. You can sign in now.', 'success');
            return;
          }
          console.warn('Broker auth returned invalid payload.', result);
          throw new Error('Login failed, please try again.');
        }
        if (await completeMarketplaceContactRevealAuth()) {
          return;
        }
        showActionToast('success', modeAtSubmit === 'register' ? 'Registration successful.' : 'Login successful.');
        window.location.href = 'dashboard.html';
      } catch (error) {
        if (state.authRequestId === requestId) {
          const fallbackMessage = getAuthModeFallbackMessage(modeAtSubmit);
          const failureMessage = getAuthFailureMessage({ message: getUiErrorMessage(error, fallbackMessage) }, modeAtSubmit, fallbackMessage);
          showActionToast('error', failureMessage);
          setAuthStatus(failureMessage);
        }
      } finally {
        if (state.authRequestId === requestId) {
          setAuthSubmitLoading(false, modeAtSubmit);
        }
      }
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('.floating-card') && !event.target.closest('.btn-tiny') && !event.target.closest('.action-icon-btn') && !event.target.closest('.connector-action-btn')) {
        closeAllPopovers();
      }
      if (!event.target.closest('#publicSearchBox') && !event.target.closest('#publicSearchSuggestions')) {
        renderPublicSuggestions('');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeMenuDrawer();
        closeAllPopovers();
        closeAuthModal();
        renderPublicSuggestions('');
      }
    });
    window.addEventListener('resize', closeAllPopovers);

    document.getElementById('publicSearchInput').addEventListener('input', event => {
      renderPublicSuggestions(event.target.value);
    });
    document.getElementById('publicSearchInput').addEventListener('focus', event => {
      if (String(event.target.value || '').trim()) {
        renderPublicSuggestions(event.target.value);
      }
    });
    document.getElementById('publicSearchInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyPublicSearch(event.target.value);
      }
      if (event.key === 'Escape') {
        renderPublicSuggestions('');
      }
    });

    (async function init() {
      if (redirectIncomingAuthLink()) {
        return;
      }

      const forcedRelogin = enforceBrokerSessionVersion();
      await runPublicInitStep('complaint modal', async () => initPublicComplaintModal());
      await runPublicInitStep('support modal', async () => initSupportModal());
      await runPublicInitStep('company autocomplete', async () => initAuthCompanyAutocomplete());
      await runPublicInitStep('auth return message', async () => handleAuthReturnMessage());
      await runPublicInitStep('forced re-login notice', async () => showForcedReloginNotice());

      const authenticated = Boolean(await runPublicInitStep('broker session verification', async () => verifyBrokerSession()));
      const showDashboardButton = true;
      document.getElementById('dashboardBtn').classList.toggle('hidden', !showDashboardButton);
      document.getElementById('signInBtn').classList.toggle('hidden', authenticated || state.forcePublicView);
      document.getElementById('registerBtn').classList.toggle('hidden', authenticated || state.forcePublicView);
      document.getElementById('registerCta').classList.toggle('hidden', authenticated || state.forcePublicView);
      if (forcedRelogin && !authenticated && !state.forcePublicView) {
        openAuthModal('signin');
      }

      mountConnectorToolbar(state.activeSection || 'requirements');

      const listingsLoaded = await runPublicInitStep('NexBridge Marketplace records', async () => {
        await loadPublicListings();
        return true;
      }, { silent: false });

      if (!listingsLoaded) {
        state.listings = Array.isArray(state.listings) ? state.listings : [];
        try {
          populateConnectorFilterOptionsFallback();
        } catch (filterError) {
          console.error('BCP fallback filters could not render.', filterError);
        }
        if (state.publicListingsLoadError) {
          renderPublicLoadErrorState(state.publicListingsLoadError);
        } else {
          renderPublicViewsFallback();
        }
      } else {
        restoreMarketplaceContactRevealIfNeeded();
      }
    })();
