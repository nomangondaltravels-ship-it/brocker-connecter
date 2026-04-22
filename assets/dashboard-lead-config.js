(() => {
  const CORE_LOCATIONS = [
    'JVC',
    'JVT',
    'JLT',
    'Arjan',
    'Business Bay',
    'Downtown Dubai',
    'Dubai Marina',
    'JBR',
    'Palm Jumeirah',
    'Bluewaters',
    'Dubai Harbour',
    'City Walk',
    'DIFC',
    'Al Sufouh',
    'Al Furjan',
    'Discovery Gardens',
    'Dubai South',
    'International City',
    'Warsan 4',
    'Dubai Silicon Oasis',
    'Dubai Sports City',
    'Motor City',
    'Dubailand',
    'Town Square',
    'Dubai Hills Estate',
    'Dubai Creek Harbour',
    'Meydan',
    'Mohammed Bin Rashid City',
    'Dubai Production City',
    "Me'aisem",
    'Al Warsan',
    'Damac Hills',
    'Damac Hills 2',
    'The Springs',
    'The Meadows',
    'The Lakes',
    'Arabian Ranches',
    'The Villa',
    'Nad Al Sheba',
    'Liwan',
    'Majan',
    'Academic City',
    'Dubai Land Residence Complex',
    'Mirdif',
    'Deira',
    'Bur Dubai',
    'Al Barsha',
    'Al Reem Island',
    'Yas Island',
    'Saadiyat Island',
    'Khalifa City',
    'Mohammed Bin Zayed City',
    'Al Raha Beach',
    'Al Reef',
    'Mussafah',
    'Al Nahda Sharjah',
    'Muwaileh',
    'Aljada',
    'Al Khan',
    'Nahda',
    'Al Majaz',
    'Rolla',
    'Al Nuaimiya',
    'Ajman Downtown',
    'Al Rashidiya',
    'Emirates City',
    'Ras Al Khaimah',
    'Fujairah',
    'Umm Al Quwain',
    'Al Ain',
    'Khor Fakkan'
  ];

  const CORE_BUILDING_PROJECTS = [
    'Binghatti Amber',
    'Lakeside Tower C',
    'Samia Azizi',
    'Hamilton Residency',
    'Marina Diamond',
    'Bayz by Danube',
    'Noora Residence',
    'Resortz by Danube',
    'Binghatti Heights',
    'Binghatti Luna',
    'Binghatti Corner',
    'Binghatti Orchid',
    'Belgravia',
    'Belgravia Heights',
    'Regina Tower',
    'The Manhattan',
    'Oxford Residence',
    'Park View Tower',
    'Bloom Towers',
    'Riviera by Azizi',
    'The Pulse Residence',
    'Luma 21',
    'Lake Terrace',
    'Marina Pinnacle',
    'Princess Tower',
    'Escan Marina Tower',
    'Time Place Tower'
  ];

  const CORE_PROPERTY_TYPES = [
    'Studio',
    '1 BHK',
    '2 BHK',
    '3 BHK',
    '4 BHK',
    '5 BHK',
    '5+ BHK',
    'Villa',
    'Townhouse',
    'Penthouse',
    'Duplex',
    'Office',
    'Shop / Retail',
    'Warehouse',
    'Labour Camp',
    'Land / Plot',
    'Building',
    'Full Floor',
    'Hotel Apartment',
    'Room / Bedspace / Partition',
    'Other'
  ];

  const LEAD_PROPERTY_TYPES = {
    rent: CORE_PROPERTY_TYPES,
    buy: CORE_PROPERTY_TYPES.filter(option => option !== 'Labour Camp')
  };

  const PURPOSE_OPTIONS = {
    leads: [
      { value: 'rent', label: 'Rent' },
      { value: 'buy', label: 'Buy' }
    ],
    listings: [
      { value: 'rent', label: 'Rent' },
      { value: 'sale', label: 'Sale' }
    ],
    connector: [
      { value: 'rent', label: 'Rent' },
      { value: 'buy', label: 'Buy' },
      { value: 'sale', label: 'Sale' }
    ]
  };

  const STATUS_OPTIONS = {
    leads: [
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'follow-up', label: 'Follow-up' },
      { value: 'meeting scheduled', label: 'Meeting Scheduled' },
      { value: 'negotiation', label: 'Negotiation' },
      { value: 'closed won', label: 'Closed Won' },
      { value: 'closed lost', label: 'Closed Lost' },
      { value: 'inactive', label: 'Inactive' }
    ],
    listings: [
      { value: 'available', label: 'Available' },
      { value: 'reserved', label: 'Reserved' },
      { value: 'rented', label: 'Rented' },
      { value: 'sold', label: 'Sold' },
      { value: 'off market', label: 'Off Market' },
      { value: 'draft', label: 'Draft' }
    ],
    connector: [
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Connected' },
      { value: 'follow-up', label: 'Follow-up' },
      { value: 'meeting scheduled', label: 'Meeting' },
      { value: 'negotiation', label: 'Negotiation' },
      { value: 'closed won', label: 'Closed Won' },
      { value: 'closed lost', label: 'Closed Lost' },
      { value: 'available', label: 'Available' },
      { value: 'reserved', label: 'Reserved' },
      { value: 'rented', label: 'Rented' },
      { value: 'sold', label: 'Sold' },
      { value: 'off market', label: 'Off Market' },
      { value: 'active', label: 'Active' }
    ],
    admin: [
      { value: 'pending', label: 'Pending' },
      { value: 'verified', label: 'Verified' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'active', label: 'Active' },
      { value: 'suspended', label: 'Suspended' }
    ]
  };

  const PROPERTY_TYPE_ALIASES = {
    studio: 'Studio',
    '1bhk': '1 BHK',
    '1 bhk': '1 BHK',
    '1 bedroom': '1 BHK',
    '2bhk': '2 BHK',
    '2 bhk': '2 BHK',
    '2 bedroom': '2 BHK',
    '3bhk': '3 BHK',
    '3 bhk': '3 BHK',
    '3 bedroom': '3 BHK',
    '4bhk': '4 BHK',
    '4 bhk': '4 BHK',
    '4 bedroom': '4 BHK',
    '5bhk': '5 BHK',
    '5 bhk': '5 BHK',
    '5 bedroom': '5 BHK',
    '5+bhk': '5+ BHK',
    '5+ bhk': '5+ BHK',
    villa: 'Villa',
    townhouse: 'Townhouse',
    penthouse: 'Penthouse',
    duplex: 'Duplex',
    office: 'Office',
    shop: 'Shop / Retail',
    retail: 'Shop / Retail',
    'shop / retail': 'Shop / Retail',
    warehouse: 'Warehouse',
    'labour camp': 'Labour Camp',
    labourcamp: 'Labour Camp',
    land: 'Land / Plot',
    plot: 'Land / Plot',
    'land / plot': 'Land / Plot',
    building: 'Building',
    'full floor': 'Full Floor',
    'hotel apartment': 'Hotel Apartment',
    'room / bedspace / partition': 'Room / Bedspace / Partition',
    room: 'Room / Bedspace / Partition',
    bedspace: 'Room / Bedspace / Partition',
    partition: 'Room / Bedspace / Partition',
    other: 'Other'
  };

  const LOCATION_ALIASES = {
    'jumeirah village circle': 'JVC',
    jvc: 'JVC',
    'jumeirah village triangle': 'JVT',
    jvt: 'JVT',
    'jumeirah lakes towers': 'JLT',
    jlt: 'JLT',
    impz: 'Dubai Production City',
    "meaisem": "Me'aisem",
    "me'aisem": "Me'aisem",
    dso: 'Dubai Silicon Oasis',
    'dubai silicon oasis': 'Dubai Silicon Oasis',
    dlrc: 'Dubai Land Residence Complex',
    nahda: 'Nahda',
    'dubai marina': 'Dubai Marina',
    'business bay': 'Business Bay',
    'downtown dubai': 'Downtown Dubai'
  };

  const PURPOSE_ALIASES = {
    rent: 'rent',
    rental: 'rent',
    buy: 'buy',
    buyer: 'buy',
    sale: 'sale',
    sell: 'sale',
    selling: 'sale'
  };

  const STATUS_ALIASES = {
    connected: 'contacted',
    contacted: 'contacted',
    followup: 'follow-up',
    'follow up': 'follow-up',
    'meeting': 'meeting scheduled',
    meeting: 'meeting scheduled',
    'meeting scheduled': 'meeting scheduled',
    negotiation: 'negotiation',
    'closed won': 'closed won',
    won: 'closed won',
    'closed lost': 'closed lost',
    lost: 'closed lost',
    inactive: 'inactive',
    available: 'available',
    reserved: 'reserved',
    rented: 'rented',
    sold: 'sold',
    'offmarket': 'off market',
    'off market': 'off market',
    draft: 'draft',
    active: 'active',
    private: 'private',
    shared: 'shared',
    listed: 'listed',
    pending: 'pending',
    verified: 'verified',
    rejected: 'rejected',
    suspended: 'suspended'
  };

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\\/]+/g, ' / ')
      .replace(/[\s_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dedupeOptions(options) {
    const seen = new Set();
    return options.filter(option => {
      const key = normalizeToken(option);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  window.BROKER_CORE_TAXONOMY = Object.freeze({
    locations: dedupeOptions(CORE_LOCATIONS),
    buildingProjects: dedupeOptions(CORE_BUILDING_PROJECTS),
    propertyTypes: Object.freeze({
      rent: dedupeOptions(LEAD_PROPERTY_TYPES.rent),
      buy: dedupeOptions(LEAD_PROPERTY_TYPES.buy),
      listing: dedupeOptions(CORE_PROPERTY_TYPES)
    }),
    purposes: Object.freeze(PURPOSE_OPTIONS),
    statuses: Object.freeze(STATUS_OPTIONS),
    aliases: Object.freeze({
      propertyTypes: Object.freeze(PROPERTY_TYPE_ALIASES),
      locations: Object.freeze(LOCATION_ALIASES),
      purposes: Object.freeze(PURPOSE_ALIASES),
      statuses: Object.freeze(STATUS_ALIASES)
    })
  });

  window.BROKER_DASHBOARD_LEAD_CONFIG = Object.freeze({
    uaeLocations: dedupeOptions(CORE_LOCATIONS),
    buildingProjects: dedupeOptions(CORE_BUILDING_PROJECTS),
    propertyTypes: Object.freeze({
      rent: dedupeOptions(LEAD_PROPERTY_TYPES.rent),
      buy: dedupeOptions(LEAD_PROPERTY_TYPES.buy)
    }),
    paymentMethods: ['Cash', 'Mortgage'],
    listingPropertyTypes: dedupeOptions(CORE_PROPERTY_TYPES),
    floorLevels: ['Low Floor', 'Mid Floor', 'High Floor'],
    furnishingOptions: ['Furnished', 'Unfurnished'],
    chequeOptions: ['1 Cheque', '2 Cheques', '3 Cheques', '4 Cheques', '6 Cheques', '12 Cheques', 'Flexible'],
    chillerOptions: ['Chiller Free', 'Chiller Applicable'],
    mortgageStatuses: ['Mortgage', 'Not Mortgage']
  });
})();
