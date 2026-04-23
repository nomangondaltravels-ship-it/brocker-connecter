(function attachPlatformRulesConfig(global) {
  const fallbackComplaintCenterRules = [
    {
      title: 'Fake Listings',
      description: 'Posting fake or non-existing properties is prohibited.'
    },
    {
      title: 'Misleading Information',
      description: 'Wrong price, size, or details are not allowed.'
    },
    {
      title: 'Harassment / Abuse',
      description: 'Abusive or disrespectful behavior is not allowed.'
    },
    {
      title: 'Spam',
      description: 'Repeated unnecessary posting or reporting is not allowed.'
    },
    {
      title: 'Fraud / Scam',
      description: 'Fraudulent activity may result in immediate block.'
    },
    {
      title: 'Duplicate Content',
      description: 'Duplicate listings or repeated misleading content are not allowed.'
    }
  ];

  global.BROKER_PLATFORM_RULES_CONFIG = {
    version: '2026-04-23',
    title: 'Platform Rules & Conduct',
    intro: 'Complaint review and broker sharing work best when every report is factual, respectful, and tied to real platform conduct.',
    acceptanceText: 'I agree to platform rules and understand that violating them may result in warning, restriction, or account block.',
    promptTitle: 'Accept Platform Rules',
    promptCopy: 'Before you submit complaints or publish records to Broker Connector, confirm that you understand the platform conduct rules.',
    categories: [
      {
        key: 'fake-listings',
        title: 'Fake listings',
        description: 'Do not post inventory that does not exist, cannot be represented, or is intentionally fabricated.'
      },
      {
        key: 'misleading-information',
        title: 'Misleading information',
        description: 'Prices, unit details, size, availability, and building information must be accurate and not intentionally deceptive.'
      },
      {
        key: 'harassment-abuse',
        title: 'Harassment or abuse',
        description: 'Threatening, abusive, discriminatory, or intimidating conduct toward brokers, clients, or admins is not allowed.'
      },
      {
        key: 'spam',
        title: 'Spam',
        description: 'Do not flood the platform with repetitive outreach, low-quality reports, or irrelevant shared records.'
      },
      {
        key: 'fraud-scam',
        title: 'Fraud / scam activity',
        description: 'Attempts to impersonate, collect money dishonestly, falsify ownership, or mislead for gain may result in immediate action.'
      },
      {
        key: 'duplicate-posting-abuse',
        title: 'Duplicate posting abuse',
        description: 'Do not repeatedly publish the same record or re-submit identical complaints to manipulate visibility or reviews.'
      },
      {
        key: 'unprofessional-conduct',
        title: 'Unprofessional conduct',
        description: 'Use the marketplace respectfully. Admin may warn, restrict, or block accounts that repeatedly damage trust.'
      }
    ]
  };

  const resolvedComplaintCenterRules = Array.isArray(global.BROKER_PLATFORM_RULES_CONFIG?.categories)
    && global.BROKER_PLATFORM_RULES_CONFIG.categories.length
    ? global.BROKER_PLATFORM_RULES_CONFIG.categories
    : fallbackComplaintCenterRules;

  global.BROKER_PLATFORM_RULES_CONFIG.categories = resolvedComplaintCenterRules;
  global.COMPLAINT_CENTER_RULES = resolvedComplaintCenterRules;
})(window);
