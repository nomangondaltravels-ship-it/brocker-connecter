(function attachWhatsappContactConfig(global) {
  global.BROKER_WHATSAPP_CONTACT_CONFIG = {
    reasons: [
      { value: 'matching-unit', label: 'I saw your requirement post and I have a matching unit' },
      { value: 'buyer-for-unit', label: 'You have this unit and I have a buyer' },
      { value: 'tenant-for-property', label: 'I have a tenant for this property' },
      { value: 'buyer-for-property', label: 'I have a buyer for this property' },
      { value: 'similar-listing', label: 'I have a similar listing' },
      { value: 'discuss-requirement', label: 'I want to discuss this requirement' },
      { value: 'discuss-property', label: 'I want to discuss this property' },
      { value: 'other', label: 'Other reason', custom: true }
    ]
  };
})(window);
