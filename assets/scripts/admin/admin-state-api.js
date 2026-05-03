    const ADMIN_SESSION_KEY = 'admin_portal_session';

    const supabaseUrl = 'https://unggpaomyzvurmawnahj.supabase.co';
    const supabaseKey = 'sb_publishable_32o5MAuNPn1e0Uy6ZC09Wg_2skR1xQW';
    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    let requirements = [];
    let deals = [];
    let complaints = [];
    let supportRequests = [];
    let approvedCompanySuggestions = [];
    let pendingCompanySuggestions = [];
    let complaintsReadable = true;
    let adminBrokerAccounts = [];
    let brokerApprovals = {};
    let blockedBrokerIds = {};
    let postStatusOverrides = {};
    let adminUiState = {
      search: '',
      verification: 'all',
      account: 'all',
      queue: 'all',
      complaintQueue: 'all',
      complaintsLoading: false,
      supportLoading: false,
      supportLoaded: false,
      complaintActionBusy: false,
      supportActionBusy: false,
      supportRequested: false,
      companyLoading: false,
      companiesLoaded: false,
      companyActionBusy: false,
      companiesRequested: false,
      selectedType: 'broker',
      selectedKey: '',
      selectedRowMemory: {
        broker: '',
        requirement: '',
        deal: '',
        complaint: ''
      },
      pendingDetailScroll: null
    };

    async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 5000) {
      const controller = new AbortController();
      let timer = null;
      try {
        timer = setTimeout(() => controller.abort(), timeoutMs);
        return await fetch(url, {
          ...options,
          signal: controller.signal
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function safeJsonRead(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        console.error(err);
        return fallback;
      }
    }

    function safeJsonWrite(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }

    function setLoginStatus(message, tone = '') {
      const target = document.getElementById('loginStatus');
      if (!message) {
        target.textContent = '';
        target.className = 'status';
        return;
      }
      target.textContent = message;
      target.className = `status active ${tone}`.trim();
    }

    function setAdminStatus(message, tone = '') {
      const target = document.getElementById('adminStatus');
      if (!target) return;
      if (!message) {
        target.textContent = '';
        target.className = 'status';
        return;
      }
      target.textContent = message;
      target.className = `status active ${tone}`.trim();
    }

    function resolveAdminActionButton() {
      return window.ActionFeedbackUi?.resolveActionButton() || null;
    }

    function getAdminErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
      return normalizeAdminText(error?.message) || fallback;
    }

    function showAdminError(error, fallback = 'Something went wrong. Please try again.') {
      setAdminStatus(getAdminErrorMessage(error, fallback), 'error');
    }

    async function runAdminActionFeedback(button, loadingText, successMessage, actionFn) {
      if (window.ActionFeedbackUi) {
        return await window.ActionFeedbackUi.withActionFeedback(
          button,
          loadingText,
          successMessage,
          actionFn,
          { showErrorToast: true }
        );
      }
      return await actionFn();
    }

    function getAdminToken() {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
    }

    function handleAdminSessionFailure(message = 'Admin session expired. Please sign in again.') {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      showLogin();
      setLoginStatus(message, 'error');
    }

    async function fetchAdminComplaints() {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      const response = await fetch('/api/admin-complaints', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.message || 'Complaint request failed.');
      }

      return Array.isArray(result?.complaints) ? result.complaints : [];
    }

    async function requestComplaintAction(payload) {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      const response = await fetch('/api/admin-complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          handleAdminSessionFailure('Admin session expired. Please sign in again.');
        }
        throw new Error(result?.message || 'Complaint action failed.');
      }

      return result;
    }

    async function fetchAdminSupportRequests() {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      let response;
      try {
        response = await fetchJsonWithTimeout('/api/support', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`
        }
        }, 4500);
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error('Support inbox is taking too long to respond.');
        }
        throw error;
      }

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          handleAdminSessionFailure('Admin session expired. Please sign in again.');
        }
        throw new Error(result?.message || 'Support inbox request failed.');
      }

      return Array.isArray(result?.supportRequests) ? result.supportRequests : [];
    }

    async function requestSupportAction(payload) {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      const response = await fetch('/api/support', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          handleAdminSessionFailure('Admin session expired. Please sign in again.');
        }
        throw new Error(result?.message || 'Support inbox action failed.');
      }

      return result;
    }

    async function fetchAdminCompanySuggestions() {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      let response;
      try {
        response = await fetchJsonWithTimeout('/api/companies?scope=admin', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`
        }
        }, 4500);
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error('Pending companies are taking too long to respond.');
        }
        throw error;
      }

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          handleAdminSessionFailure('Admin session expired. Please sign in again.');
        }
        throw new Error(result?.message || 'Company suggestions request failed.');
      }

      return {
        approvedCompanies: Array.isArray(result?.approvedCompanies) ? result.approvedCompanies : [],
        pendingCompanies: Array.isArray(result?.pendingCompanies) ? result.pendingCompanies : []
      };
    }

    async function requestCompanySuggestionAction(payload) {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          handleAdminSessionFailure('Admin session expired. Please sign in again.');
        }
        throw new Error(result?.message || 'Company suggestion update failed.');
      }

      return result;
    }

    async function fetchAdminBrokers() {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      const response = await fetch('/api/admin-brokers', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          handleAdminSessionFailure('Admin session expired. Please sign in again.');
        }
        throw new Error(result?.message || 'Failed to load broker accounts.');
      }

      return Array.isArray(result?.brokers) ? result.brokers : [];
    }

    async function requestBrokerAdminAction(payload) {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      const response = await fetch('/api/admin-brokers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          handleAdminSessionFailure('Admin session expired. Please sign in again.');
        }
        throw new Error(result?.message || 'Broker action failed.');
      }

      return result;
    }

    function showDashboard() {
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('dashboardView').classList.add('active');
      document.getElementById('logoutBtn').style.display = 'inline-flex';
    }

    function showLogin() {
      renderBrokerAccountModal(null);
      renderComplaintReviewModal(null);
      document.getElementById('loginView').style.display = 'block';
      document.getElementById('dashboardView').classList.remove('active');
      document.getElementById('logoutBtn').style.display = 'none';
    }

    async function loginAdmin(event) {
      event.preventDefault();
      const submitButton = event?.submitter || document.querySelector('#loginView button[type="submit"]');
      const username = document.getElementById('adminUsername').value.trim();
      const password = document.getElementById('adminPassword').value;

      try {
        const result = await runAdminActionFeedback(
          submitButton,
          'Logging in...',
          'Login successful.',
          async () => {
              const response = await fetch('/api/admin-login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok || !payload?.token) {
                throw new Error(payload?.message || 'Invalid admin username or password.');
              }
              return payload;
          }
        );

        sessionStorage.setItem(ADMIN_SESSION_KEY, result.token);
        setLoginStatus('');
        showDashboard();
        loadAdminData();
      } catch (error) {
        console.error(error);
        setLoginStatus(error?.message || 'Admin login is unavailable right now. Make sure the Vercel API functions are deployed and environment variables are set.', 'error');
      }
    }

    function logoutAdmin() {
      const button = resolveAdminActionButton();
      window.ActionFeedbackUi?.setButtonLoading(button, 'Logging out...');
      window.ActionFeedbackUi?.startProgress();
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      showLogin();
      window.ActionFeedbackUi?.showToast('success', 'Logout successful.');
      window.ActionFeedbackUi?.resetButtonLoading(button);
      window.ActionFeedbackUi?.stopProgress();
    }

    function restoreAdminSession() {
      if (sessionStorage.getItem(ADMIN_SESSION_KEY)) {
        showDashboard();
        loadAdminData();
      } else {
        showLogin();
      }
    }

    function getEntryKey(item, urgent = false) {
      return [
        urgent ? 'urgent' : 'need',
        item.broker,
        item.purpose,
        item.category,
        item.location,
        item.budget,
        item.postedAt
      ].join('|');
    }

    function getPostStatus(item, urgent = false) {
      const key = getEntryKey(item, urgent);
      const status = postStatusOverrides[key] || item.status || 'open';
      return status === 'pending' ? 'open' : status;
    }

    function savePostStatus(item, urgent, status) {
      const key = getEntryKey(item, urgent);
      postStatusOverrides[key] = status;
      safeJsonWrite('post_status_overrides', postStatusOverrides);
      renderAdminWorkspace();
    }

    function loadLocalAdminState() {
      brokerApprovals = safeJsonRead('broker_approvals', {});
      blockedBrokerIds = safeJsonRead('blocked_brokers', {});
      postStatusOverrides = safeJsonRead('post_status_overrides', {});
    }

    function findBrokerIdByComplaint(item) {
      const metaBrokerId = String(item?.reportedBrokerIdNumber || '').trim();
      if (metaBrokerId) return metaBrokerId;

      const metaBrokerName = String(item?.reportedBrokerName || '').trim().toLowerCase();
      if (metaBrokerName) {
        const namedAccount = adminBrokerAccounts.find(account =>
          String(account.name || '').trim().toLowerCase() === metaBrokerName
        );
        if (namedAccount?.brokerId) return namedAccount.brokerId;
      }

      const reportedUserId = String(item?.reportedUserId || '').trim();
      if (reportedUserId) {
        const matchedAccount = adminBrokerAccounts.find(account => String(account.id || '').trim() === reportedUserId);
        if (matchedAccount?.brokerId) return matchedAccount.brokerId;
      }

      const brokerRef = String(item?.broker || '').trim().toLowerCase();
      if (!brokerRef) return '';
      const accounts = adminBrokerAccounts;
      const exact = accounts.find(account =>
        String(account.brokerId || '').trim().toLowerCase() === brokerRef ||
        String(account.name || '').trim().toLowerCase() === brokerRef
      );
      if (exact) return exact.brokerId;

      const partial = accounts.find(account =>
        brokerRef.includes(String(account.name || '').trim().toLowerCase()) ||
        String(account.name || '').trim().toLowerCase().includes(brokerRef)
      );
      return partial?.brokerId || '';
    }

    function getComplaintMatch(item) {
      return {
        name: item.name || 'Anonymous',
        broker: item.broker || 'N/A',
        message: item.rawMessage || item.message || '',
        created_at: item.created_at || ''
      };
    }

    function parseComplaintRecord(item) {
      const rawMessage = String(item?.message || '');
      const match = rawMessage.match(/\[\[BC_META:([\s\S]+?)\]\]\s*$/);
      let meta = {};
      let displayMessage = rawMessage;

      if (match) {
        try {
          meta = JSON.parse(decodeURIComponent(match[1]));
        } catch (error) {
          meta = {};
        }
        displayMessage = rawMessage.replace(match[0], '').trim();
      }

      const rawStatus = String(item?.status || '').trim().toLowerCase();
      const normalizedStatus = rawStatus === 'pending' ? 'new' : (rawStatus || 'new');

      return {
        ...item,
        rawMessage,
        displayMessage,
        reason: item?.reason || meta.reason || 'Other',
        reporterBrokerId: item?.reporterBrokerId || meta.reporterBrokerId || '',
        reporterUserId: item?.reporterUserId || meta.reporterUserId || '',
        reporterEmail: item?.reporterEmail || meta.reporterEmail || '',
        reporterName: item?.reporterName || meta.reporterName || '',
        reportedUserId: item?.reportedUserId || meta.reportedUserId || '',
        reportedBrokerId: item?.reportedBrokerId || meta.reportedBrokerId || '',
        reportedBrokerIdNumber: item?.reportedBrokerIdNumber || meta.reportedBrokerIdNumber || '',
        reportedBrokerName: item?.reportedBrokerName || meta.reportedBrokerName || '',
        targetType: item?.targetType || meta.targetType || '',
        targetId: item?.targetId || meta.targetId || '',
        listingId: item?.listingId || meta.listingId || '',
        requirementId: item?.requirementId || meta.requirementId || '',
        targetLabel: item?.targetLabel || meta.targetLabel || '',
        sourceSection: item?.sourceSection || meta.sourceSection || '',
        proofUrl: item?.proofUrl || meta.proofUrl || '',
        proofAttachment: item?.proofAttachment || (meta.proofAttachment && typeof meta.proofAttachment === 'object' ? meta.proofAttachment : null),
        adminNote: item?.adminNote || item?.admin_note || '',
        actionTaken: item?.actionTaken || item?.action_taken || 'none',
        reviewedBy: item?.reviewedBy || item?.reviewed_by || '',
        reviewedAt: item?.reviewedAt || item?.reviewed_at || '',
        repeatOffenseCount: Number(item?.repeatOffenseCount || item?.repeat_offense_count || 0),
        resolvedValidComplaintCount: Number(item?.resolvedValidComplaintCount || item?.resolved_valid_complaint_count || 0),
        nextValidComplaintCount: Number(item?.nextValidComplaintCount || item?.next_valid_complaint_count || 0),
        seriousReason: Boolean(item?.seriousReason || item?.serious_reason),
        seriousReasonLabel: item?.seriousReasonLabel || item?.serious_reason_label || '',
        moderationOverrideApplied: Boolean(item?.moderationOverrideApplied || item?.moderation_override_applied),
        reporterRecentComplaintCount: Number(item?.reporterRecentComplaintCount || item?.reporter_recent_complaint_count || 0),
        reporterRejectedComplaintCount: Number(item?.reporterRejectedComplaintCount || item?.reporter_rejected_complaint_count || 0),
        reporterDistinctTargetCount: Number(item?.reporterDistinctTargetCount || item?.reporter_distinct_target_count || 0),
        reporterSoftFlag: Boolean(item?.reporterSoftFlag || item?.reporter_soft_flag),
        reporterFlagReason: item?.reporterFlagReason || item?.reporter_flag_reason || item?.reporterSignalSummary || '',
        repeatOffenseLevel: item?.repeatOffenseLevel || item?.repeat_offense_level || item?.suggestedAction || item?.suggested_action || '',
        suggestedAction: item?.suggestedAction || item?.suggested_action || item?.repeatOffenseLevel || item?.repeat_offense_level || '',
        normalizedStatus
      };
    }

    function getComplaintTargetLabel(item) {
      const targetType = String(item?.targetType || '').trim().toLowerCase();
      if (!targetType) return 'General complaint';
      if (targetType === 'listing') return 'Listing';
      if (targetType === 'requirement') return 'Requirement';
      if (targetType === 'broker') return 'Broker';
      return targetType;
    }

    function renderComplaintProofLink(item) {
      const proof = item?.proofAttachment;
      const proofUrl = String(item?.proofUrl || proof?.url || proof?.dataUrl || '').trim();
      if (!proofUrl) {
        return '<span class="muted">No proof uploaded</span>';
      }
      const fileName = proof.name || 'Proof attachment';
      return `<a class="admin-inline-link" href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(fileName)}</a>`;
    }

    function getComplaintStatusMeta(status) {
      const normalized = String(status || '').trim().toLowerCase();
      if (normalized === 'under-review') return { label: 'Under Review', tone: 'orange' };
      if (normalized === 'resolved') return { label: 'Resolved', tone: 'green' };
      if (normalized === 'rejected') return { label: 'Rejected', tone: 'red' };
      return { label: 'New', tone: 'yellow' };
    }

    function getComplaintActionLabel(actionTaken) {
      const normalized = String(actionTaken || '').trim().toLowerCase();
      if (!normalized || normalized === 'none') return 'No action';
      if (normalized === 'warning') return 'Warning sent';
      if (normalized === 'restrict') return 'Broker restricted';
      if (normalized === 'block') return 'Broker blocked';
      if (normalized === 'delete_listing') return 'Listing deleted';
      if (normalized === 'delete_requirement') return 'Requirement deleted';
      return normalized.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    }

    function getComplaintActionTone(actionTaken) {
      const normalized = String(actionTaken || '').trim().toLowerCase();
      if (!normalized || normalized === 'none') return 'blue';
      if (normalized === 'warning' || normalized === 'restrict') return 'gold';
      if (normalized === 'block' || normalized === 'delete_listing' || normalized === 'delete_requirement') return 'red';
      return 'blue';
    }

    function getComplaintBrokerHistoryKey(item) {
      return normalizeAdminText(
        item?.reportedBrokerId
        || item?.reportedUserId
        || item?.reportedBrokerIdNumber
        || item?.reportedBrokerName
        || item?.broker
      );
    }

    function getComplaintHistoryEntries(item) {
      const brokerKey = getComplaintBrokerHistoryKey(item);
      if (!brokerKey) return [];
      return complaints
        .filter(candidate => candidate?.id !== item?.id && getComplaintBrokerHistoryKey(candidate) === brokerKey)
        .sort((left, right) => getPostedTimestamp(right?.created_at) - getPostedTimestamp(left?.created_at));
    }

    function getComplaintQueueOptions() {
      return [
        { value: 'all', label: 'All' },
        { value: 'new', label: 'New' },
        { value: 'under-review', label: 'Under Review' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'rejected', label: 'Rejected' }
      ];
    }

    function getPostedTimestamp(value) {
      const timestamp = Date.parse(String(value || ''));
      return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function getPostedAge(value) {
      const timestamp = getPostedTimestamp(value);
      return timestamp ? Math.max(0, Date.now() - timestamp) : Number.POSITIVE_INFINITY;
    }

    function formatPostedTime(value) {
      const timestamp = getPostedTimestamp(value);
      if (!timestamp) return 'Date unavailable';
      const diff = Math.max(0, Date.now() - timestamp);
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    }

    async function loadAdminData() {
      adminUiState.complaintsLoading = true;
      adminUiState.supportLoading = false;
      adminUiState.supportLoaded = false;
      adminUiState.supportRequested = false;
      adminUiState.companyLoading = false;
      adminUiState.companiesLoaded = false;
      adminUiState.companyActionBusy = false;
      adminUiState.companiesRequested = false;
      renderAdminWorkspace();
      loadLocalAdminState();
      let accounts = [];
      let brokerLoadError = '';
      try {
        accounts = await fetchAdminBrokers();
      } catch (error) {
        console.error(error);
        brokerLoadError = error?.message || 'Broker accounts could not load.';
        if (/admin login required|session expired/i.test(brokerLoadError)) {
          adminUiState.complaintsLoading = false;
          return;
        }
        setAdminStatus(brokerLoadError, 'error');
      }
      adminBrokerAccounts = accounts;
      brokerApprovals = Object.fromEntries(accounts.filter(item => item.approved).map(item => [item.brokerId, true]));
      blockedBrokerIds = Object.fromEntries(accounts.filter(item => item.blocked).map(item => [item.brokerId, true]));

      const [{ data: reqData, error: reqError }, { data: dealData, error: dealError }] = await Promise.all([
        supabaseClient.from('requirements').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('deals').select('*').order('created_at', { ascending: false })
      ]);

      if (reqError) console.error(reqError);
      if (dealError) console.error(dealError);

      let resolvedComplaints = [];
      complaintsReadable = true;
      try {
        resolvedComplaints = await fetchAdminComplaints();
      } catch (fallbackError) {
        console.error(fallbackError);
        complaintsReadable = false;
      }

      if (reqError || dealError) {
        setAdminStatus('Some Supabase data could not load correctly. Please refresh or check table permissions.', 'error');
      } else if (brokerLoadError) {
        setAdminStatus(brokerLoadError, 'error');
      } else if (!accounts.length) {
        setAdminStatus('No broker accounts found yet.', 'error');
      } else if (!complaintsReadable) {
        setAdminStatus('Requirements and deals loaded, but complaint review is not available with current Supabase permissions.', 'error');
      } else {
        setAdminStatus('');
      }

      requirements = (reqData || []).map(item => ({
        broker: item.broker_name,
        phone: item.phone,
        purpose: item.purpose,
        category: item.category,
        location: item.location,
        budget: item.budget,
        notes: item.notes,
        verified: item.verified,
        premium: item.premium,
        status: item.status === 'pending' ? 'open' : (item.status || 'open'),
        postedAt: item.created_at || null
      }));

      deals = (dealData || []).map(item => ({
        broker: item.broker_name,
        phone: item.phone,
        purpose: item.type,
        category: item.category,
        location: item.location,
        budget: item.price,
        notes: item.notes,
        urgent: item.urgent,
        distress: item.distress,
        status: item.status === 'pending' ? 'open' : (item.status || 'open'),
        postedAt: item.created_at || null
      }));

      complaints = (resolvedComplaints || []).map(parseComplaintRecord);
      supportRequests = [];
      approvedCompanySuggestions = [];
      pendingCompanySuggestions = [];

      adminUiState.complaintsLoading = false;
      renderAdminWorkspace();
    }

    function renderStats(accounts) {
      document.getElementById('statAccounts').textContent = accounts.length;
      document.getElementById('statApproved').textContent = accounts.filter(item => item.approved).length;
      const totalPosts = accounts.reduce((sum, account) => {
        const summary = getBrokerSummary(account);
        return sum + summary.requirementCount + summary.listingCount;
      }, 0);
      document.getElementById('statPosts').textContent = totalPosts;
      document.getElementById('statComplaints').textContent = complaints.length;
    }

    async function toggleBrokerApproval(brokerId) {
      const account = adminBrokerAccounts.find(item => item.brokerId === brokerId);
      if (!account) {
        setAdminStatus('Broker account not found.', 'error');
        return;
      }
      const actionButton = resolveAdminActionButton();

      try {
        await runAdminActionFeedback(
          actionButton,
          account.approved ? 'Removing Verification...' : 'Approving...',
          'Broker verification status updated successfully.',
          () => requestBrokerAdminAction({
            action: account.approved ? 'unverify' : 'verify',
            brokerId
          })
        );
      } catch (error) {
        showAdminError(error, 'Broker verification update failed.');
        return;
      }

      setAdminStatus('Broker verification status updated successfully.', 'success');
      loadAdminData();
    }

    async function toggleBrokerBlock(brokerId) {
      const accounts = adminBrokerAccounts;
      const account = accounts.find(item => item.brokerId === brokerId);
      if (!account) {
        setAdminStatus('Broker account not found.', 'error');
        return;
      }

      const willBlock = !blockedBrokerIds[brokerId];
      const confirmed = window.confirm(
        willBlock
          ? `Block broker ${account.name} (${brokerId})? They will no longer be able to sign in or post.`
          : `Unblock broker ${account.name} (${brokerId})?`
      );
      if (!confirmed) return;

      try {
        await requestBrokerAdminAction({
          action: willBlock ? 'block' : 'unblock',
          brokerId
        });
      } catch (error) {
        showAdminError(error, 'Broker block update failed.');
        return;
      }

      setAdminStatus(willBlock ? 'Broker blocked successfully.' : 'Broker unblocked successfully.', 'success');
      loadAdminData();
    }

    function getComplaintAdminNoteValue() {
      const field = document.getElementById('complaintAdminNoteField');
      return String(field?.value || '').trim();
    }

    function requireComplaintAdminNote() {
      const adminNote = getComplaintAdminNoteValue();
      if (!adminNote) {
        setAdminStatus('Admin note is required before reviewing or taking complaint action.', 'error');
        const field = document.getElementById('complaintAdminNoteField');
        field?.focus();
        return '';
      }
      return adminNote;
    }

    async function submitComplaintStatusUpdate(index, status) {
      const item = complaints[index];
      if (!item) return;
      if (adminUiState.complaintActionBusy) return;
      const actionButton = resolveAdminActionButton();
      const adminNote = requireComplaintAdminNote();
      if (!adminNote) return;

      adminUiState.complaintActionBusy = true;
      renderAdminWorkspace();
      try {
        const result = await runAdminActionFeedback(
          actionButton,
          status === 'rejected' ? 'Rejecting...' : status === 'resolved' ? 'Resolving...' : 'Updating...',
          `Complaint marked as ${status.replace('-', ' ')}.`,
          () => requestComplaintAction({
            action: 'update-status',
            complaintId: item.id,
            match: getComplaintMatch(item),
            status,
            adminNote
          })
        );
        if (Array.isArray(result?.complaints) && result.complaints.length) {
          complaints = result.complaints.map(parseComplaintRecord);
        }
      } catch (error) {
        adminUiState.complaintActionBusy = false;
        renderAdminWorkspace();
        showAdminError(error, 'Complaint update failed.');
        return;
      }

      adminUiState.complaintActionBusy = false;
      setAdminStatus(`Complaint marked as ${status.replace('-', ' ')}.`, 'success');
      loadAdminData();
    }

    function updateComplaintStatus(index, status) {
      submitComplaintStatusUpdate(index, status);
    }

    async function executeComplaintAdminAction(index, actionTaken, statusOverride = '') {
      const item = complaints[index];
      if (!item) return;
      if (adminUiState.complaintActionBusy) return;
      const actionButton = resolveAdminActionButton();
      const adminNote = requireComplaintAdminNote();
      if (!adminNote) return;

      adminUiState.complaintActionBusy = true;
      renderAdminWorkspace();
      try {
        const result = await runAdminActionFeedback(
          actionButton,
          getComplaintActionLabel(actionTaken).replace(' saved', '') + '...',
          `${getComplaintActionLabel(actionTaken)} saved successfully.`,
          () => requestComplaintAction({
            action: 'take-action',
            complaintId: item.id,
            match: getComplaintMatch(item),
            actionTaken,
            status: statusOverride || '',
            adminNote
          })
        );
        if (Array.isArray(result?.complaints) && result.complaints.length) {
          complaints = result.complaints.map(parseComplaintRecord);
        }
      } catch (error) {
        adminUiState.complaintActionBusy = false;
        renderAdminWorkspace();
        showAdminError(error, 'Complaint action failed.');
        return;
      }

      adminUiState.complaintActionBusy = false;
      setAdminStatus(`${getComplaintActionLabel(actionTaken)} saved successfully.`, 'success');
      closeComplaintActionConfirm();
      loadAdminData();
    }

    function handleComplaintAdminAction(index, actionTaken, options = {}) {
      if (adminUiState.complaintActionBusy) return;
      const destructive = Boolean(options?.destructive);
      if (!destructive) {
        executeComplaintAdminAction(index, actionTaken, options?.status || '');
        return;
      }
      openComplaintActionConfirm({
        index,
        actionTaken,
        status: options?.status || '',
        title: options?.title || 'Confirm complaint action',
        description: options?.description || 'This action changes linked broker data. Continue only if the complaint review is complete.'
      });
    }

    function getDeleteErrorMessage(error, entityLabel) {
      const message = String(error?.message || error || '');
      const lower = message.toLowerCase();
      if (lower.includes('token') || lower.includes('admin login')) {
        return `Delete failed for ${entityLabel}. Please sign in to the admin portal again.`;
      }
      if (lower.includes('environment variable') || lower.includes('service role')) {
        return `Delete failed for ${entityLabel}. Required Vercel environment variables are missing for secure admin delete.`;
      }
      if (lower.includes('permission denied') || String(error?.code || '') === '42501') {
        return `Delete failed for ${entityLabel}. The secure admin delete route could not complete the Supabase request.`;
      }
      return `Delete failed for ${entityLabel}: ${message || 'Unknown error'}`;
    }

    async function requestAdminDelete(payload) {
      const token = getAdminToken();
      if (!token) {
        throw new Error('Admin login required.');
      }

      const response = await fetch('/api/admin-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.message || 'Delete request failed.');
      }

      return result;
    }

    async function deleteRequirementAt(index) {
      const item = requirements[index];
      if (!item) return;
      const actionButton = resolveAdminActionButton();

      const confirmed = window.confirm(`Delete this requirement from ${item.broker}?`);
      if (!confirmed) return;

      try {
        await runAdminActionFeedback(
          actionButton,
          'Deleting Requirement...',
          'Requirement deleted successfully.',
          () => requestAdminDelete({
            table: 'requirements',
            scope: 'single',
            match: {
              broker_name: item.broker,
              phone: item.phone,
              purpose: item.purpose,
              category: item.category,
              location: item.location,
              budget: item.budget,
              notes: item.notes
            }
          })
        );
      } catch (error) {
        setAdminStatus(getDeleteErrorMessage(error, 'the requirement'), 'error');
        return;
      }

      setAdminStatus('Requirement deleted successfully.', 'success');
      loadAdminData();
    }

    async function deleteDealAt(index) {
      const item = deals[index];
      if (!item) return;
      const actionButton = resolveAdminActionButton();

      const confirmed = window.confirm(`Delete this broker connector listing from ${item.broker}?`);
      if (!confirmed) return;

      try {
        await runAdminActionFeedback(
          actionButton,
          'Deleting Listing...',
          'Broker Connector listing deleted successfully.',
          () => requestAdminDelete({
            table: 'deals',
            scope: 'single',
            match: {
              broker_name: item.broker,
              phone: item.phone,
              type: item.purpose,
              category: item.category,
              location: item.location,
              price: item.budget,
              notes: item.notes
            }
          })
        );
      } catch (error) {
        setAdminStatus(getDeleteErrorMessage(error, 'the property / deal'), 'error');
        return;
      }

      setAdminStatus('Broker Connector listing deleted successfully.', 'success');
      loadAdminData();
    }

    async function deleteAllRequirements() {
      if (!requirements.length) {
        setAdminStatus('There are no requirements to delete.', 'error');
        return;
      }

      const confirmed = window.confirm('Delete all requirements from Supabase?');
      if (!confirmed) return;

      try {
        await requestAdminDelete({
          table: 'requirements',
          scope: 'all'
        });
      } catch (error) {
        setAdminStatus(getDeleteErrorMessage(error, 'all requirements'), 'error');
        return;
      }

      setAdminStatus('All requirements deleted successfully.', 'success');
      loadAdminData();
    }

    async function deleteAllDeals() {
      if (!deals.length) {
        setAdminStatus('There are no broker connector listings to delete.', 'error');
        return;
      }

      const confirmed = window.confirm('Delete all broker connector listings from Supabase?');
      if (!confirmed) return;

      try {
        await requestAdminDelete({
          table: 'deals',
          scope: 'all'
        });
      } catch (error) {
        setAdminStatus(getDeleteErrorMessage(error, 'all properties / deals'), 'error');
        return;
      }

      setAdminStatus('All broker connector listings deleted successfully.', 'success');
      loadAdminData();
    }

    async function deleteOlderEntries({ items, table, days, entityLabel }) {
      const eligibleCount = items.filter(item => getPostedAge(item.postedAt) >= days * 86400000).length;

      if (!eligibleCount) {
        setAdminStatus(`No ${entityLabel} older than ${days} days were found.`, 'error');
        return;
      }

      const confirmed = window.confirm(`Delete ${eligibleCount} ${entityLabel} older than ${days} days?`);
      if (!confirmed) return;

      try {
        const result = await requestAdminDelete({
          table,
          scope: 'older_than_days',
          days
        });

        const deletedCount = Number(result?.deletedCount || 0);
        setAdminStatus(
          deletedCount
            ? `${deletedCount} ${entityLabel} older than ${days} days deleted successfully.`
            : `No dated ${entityLabel} older than ${days} days were deleted.`,
          deletedCount ? 'success' : 'error'
        );
        loadAdminData();
      } catch (error) {
        setAdminStatus(getDeleteErrorMessage(error, `${entityLabel} older than ${days} days`), 'error');
      }
    }

    async function deleteOldRequirements() {
      const days = Number(document.getElementById('requirementAgeDays')?.value || 30);
      await deleteOlderEntries({
        items: requirements,
        table: 'requirements',
        days,
        entityLabel: 'requirements'
      });
    }

    async function deleteOldDeals() {
      const days = Number(document.getElementById('dealAgeDays')?.value || 30);
      await deleteOlderEntries({
        items: deals,
        table: 'deals',
        days,
        entityLabel: 'deals'
      });
    }

    async function updateBrokerPassword(brokerId) {
      const account = adminBrokerAccounts.find(item => item.brokerId === brokerId);
      if (!account) {
        setAdminStatus('Broker account not found.', 'error');
        return;
      }

      const newPassword = window.prompt('Enter a new password for this broker:');
      if (newPassword === null) return;

      if (String(newPassword).trim().length < 6) {
        setAdminStatus('Password must be at least 6 characters long.', 'error');
        return;
      }

      try {
        await requestBrokerAdminAction({
          action: 'set-password',
          brokerId,
          newPassword: String(newPassword).trim()
        });
      } catch (error) {
        setAdminStatus(error?.message || 'Broker password update failed.', 'error');
        return;
      }

      setAdminStatus('Broker password updated successfully.', 'success');
      loadAdminData();
    }

    async function updateBrokerId(brokerId) {
      const account = adminBrokerAccounts.find(item => item.brokerId === brokerId);
      if (!account) {
        setAdminStatus('Broker account not found.', 'error');
        return;
      }

      const nextBrokerIdInput = window.prompt('Enter the updated Broker ID for this broker:', String(account.brokerId || ''));
      if (nextBrokerIdInput === null) return;

      const nextBrokerId = String(nextBrokerIdInput || '').trim().toUpperCase();
      if (!nextBrokerId) {
        setAdminStatus('Broker ID is required.', 'error');
        return;
      }

      if (!/^[A-Z0-9-]{3,40}$/.test(nextBrokerId)) {
        setAdminStatus('Broker ID must use 3-40 letters, numbers, or hyphens only.', 'error');
        return;
      }

      if (nextBrokerId === String(account.brokerId || '').trim().toUpperCase()) {
        setAdminStatus('Broker ID is already set to that value.', 'success');
        return;
      }

      try {
        await requestBrokerAdminAction({
          action: 'set-broker-id',
          brokerId,
          brokerRecordId: account.id,
          newBrokerId: nextBrokerId
        });
      } catch (error) {
        setAdminStatus(error?.message || 'Broker ID update failed.', 'error');
        return;
      }

      setAdminStatus('Broker ID updated successfully.', 'success');
      loadAdminData();
    }

    async function deleteBrokerAccount(brokerId) {
      const accounts = adminBrokerAccounts;
      const account = accounts.find(item => item.brokerId === brokerId);
      if (!account) {
        setAdminStatus('Broker account not found.', 'error');
        return;
      }

      const confirmed = window.confirm(`Delete broker ${account.name} (${account.brokerId})? This will remove the broker account from the backend.`);
      if (!confirmed) return;

      try {
        await requestBrokerAdminAction({
          action: 'delete',
          brokerId
        });
      } catch (error) {
        setAdminStatus(error?.message || 'Broker delete failed.', 'error');
        return;
      }

      setAdminStatus('Broker account deleted successfully.', 'success');
      loadAdminData();
    }
