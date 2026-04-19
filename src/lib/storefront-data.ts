// Cameroon cities/towns/villages by region — expanded to 200+ across all 10 regions
export const CAMEROON_CITIES: Record<string, string[]> = {
  'Centre': [
    'Yaoundé', 'Mbalmayo', 'Obala', 'Monatélé', 'Nanga Eboko', 'Akonolinga', 'Esse', 'Mfou', 'Soa', 'Ngoumou',
    'Bafia', 'Mbandjock', 'Saa', 'Ntui', 'Yoko', 'Bokito', 'Ombessa', 'Ngoro', 'Nkoteng', 'Awae',
    'Mbankomo', 'Okola', 'Lobo', 'Évodoula', 'Endom', 'Ayos', 'Eseka', 'Makak', 'Matomb',
  ],
  'Littoral': [
    'Douala', 'Nkongsamba', 'Edéa', 'Loum', 'Manjo', 'Mbanga', 'Dibombari', 'Bonabéri', 'Japoma',
    'Mélong', 'Yabassi', 'Penja', 'Njombé', 'Bonalea', 'Pouma', 'Ndobian', 'Dizangué', 'Mouanko',
    'Bafang', 'Yingui', 'Nkondjock', 'Souza', 'Ngwei',
  ],
  'West': [
    'Bafoussam', 'Dschang', 'Mbouda', 'Foumban', 'Foumbot', 'Bangangté', 'Bandjoun', 'Bafang', 'Tonga',
    'Bafou', 'Baham', 'Bana', 'Bandja', 'Bangou', 'Batié', 'Bayangam', 'Penka-Michel', 'Santchou',
    'Fokoué', 'Galim', 'Kekem', 'Magba', 'Massangam', 'Bagangté', 'Bansoa', 'Bansoa-Fondjomekwet',
    'Fongo-Tongo', 'Nkong-Ni', 'Bamendjou', 'Demdeng',
  ],
  'Northwest': [
    'Bamenda', 'Kumbo', 'Ndop', 'Wum', 'Bali', 'Mbengwi', 'Fundong', 'Nkambe', 'Bafut',
    'Batibo', 'Nkwen', 'Bamendankwe', 'Belo', 'Njinikom', 'Oku', 'Mbiame', 'Tatum', 'Misaje',
    'Ndu', 'Ako', 'Nwa', 'Jakiri', 'Babungo', 'Babanki', 'Bambili', 'Bambui', 'Mankon', 'Santa',
    'Bafanji', 'Balikumbat',
  ],
  'Southwest': [
    'Buea', 'Limbe', 'Kumba', 'Tiko', 'Mamfe', 'Muyuka', 'Mutengene', 'Ekona', 'Idenau',
    'Bota', 'Bakassi', 'Bangem', 'Tombel', 'Loum', 'Konye', 'Toko', 'Mundemba', 'Akwaya',
    'Eyumojock', 'Tinto', 'Nguti', 'Bamusso', 'Isangele', 'Dikome Balue', 'Mbonge', 'West Coast',
    'Fontem', 'Wabane', 'Lebialem',
  ],
  'South': [
    'Ebolowa', 'Kribi', 'Sangmélima', 'Ambam', 'Lolodorf', 'Campo', 'Mvangan',
    'Akom II', 'Niété', 'Bipindi', 'Lokoundjé', 'Mvengue', 'Olamze', 'Meyomessala', 'Djoum',
    'Mintom', 'Oveng', 'Zoétélé', 'Bengbis', 'Efoulan', 'Ma\'an', 'Kye-Ossi',
  ],
  'East': [
    'Bertoua', 'Batouri', 'Abong-Mbang', 'Yokadouma', 'Moloundou', 'Belabo', 'Doumé',
    'Garoua-Boulaï', 'Kentzou', 'Kette', 'Lomié', 'Mboma', 'Messamena', 'Mindourou', 'Ngoura',
    'Nguelemendouka', 'Salapoumbé', 'Dimako', 'Mandjou', 'Mbang', 'Ndelele', 'Ouli', 'Diang',
  ],
  'Adamawa': [
    'Ngaoundéré', 'Meiganga', 'Tibati', 'Banyo', 'Tignère', 'Djohong',
    'Galim-Tignère', 'Mayo-Darlé', 'Ngaoundal', 'Bankim', 'Belel', 'Dir', 'Mbé', 'Nyambaka',
    'Martap', 'Kontcha', 'Ngan-Ha', 'Nganha',
  ],
  'North': [
    'Garoua', 'Guider', 'Pitoa', 'Figuil', 'Lagdo', 'Tchéboa', 'Poli',
    'Bibémi', 'Rey-Bouba', 'Touboro', 'Tcholliré', 'Mayo-Oulo', 'Beka', 'Bashéo', 'Madingrin',
    'Ngong', 'Demsa', 'Gashiga', 'Dembo', 'Bawan',
  ],
  'Far North': [
    'Maroua', 'Kousséri', 'Mokolo', 'Mora', 'Yagoua', 'Kaélé', 'Mindif', 'Maga',
    'Mokong', 'Méri', 'Bogo', 'Pétté', 'Tokombéré', 'Waza', 'Logone-Birni', 'Makary',
    'Goulfey', 'Hile-Alifa', 'Blangoua', 'Fotokol', 'Hina', 'Mozogo', 'Koza', 'Tourou',
    'Roua', 'Kar-Hay', 'Bourrah', 'Guéré', 'Doukoula', 'Tchatibali', 'Datcheka', 'Gobo',
    'Wina', 'Kalfou', 'Touloum', 'Moulvoudaye', 'Moutourwa',
  ],
};

export function getAllCitiesForCountry(countryCode: string): string[] {
  if (countryCode === 'CM') {
    return Object.values(CAMEROON_CITIES).flat().sort();
  }
  return [];
}

export function getCitiesByRegion(countryCode: string): Record<string, string[]> {
  if (countryCode === 'CM') return CAMEROON_CITIES;
  return {};
}

// Hierarchical categories
export interface SubCategory {
  name: string;
}

export interface StoreCategory {
  name: string;
  icon: string; // lucide icon name hint
  subs: SubCategory[];
}

export const STORE_CATEGORIES: StoreCategory[] = [
  { name: 'Food & Beverages', icon: 'utensils', subs: [
    { name: 'Restaurant' }, { name: 'Café & Coffee Shop' }, { name: 'Bakery & Pastry' },
    { name: 'Bar & Lounge' }, { name: 'Street Food' }, { name: 'Grocery Store' },
    { name: 'Supermarket' }, { name: 'Butchery' }, { name: 'Fishmonger' }, { name: 'Catering Service' },
  ]},
  { name: 'Fashion & Apparel', icon: 'shirt', subs: [
    { name: 'Men\'s Clothing' }, { name: 'Women\'s Clothing' }, { name: 'Children\'s Clothing' },
    { name: 'Shoes & Footwear' }, { name: 'Accessories & Jewelry' }, { name: 'Tailor / Couture' },
    { name: 'Thrift / Second-Hand' }, { name: 'Sportswear' },
  ]},
  { name: 'Electronics & Technology', icon: 'smartphone', subs: [
    { name: 'Mobile Phones & Accessories' }, { name: 'Computers & Laptops' }, { name: 'TV & Audio' },
    { name: 'Repairs & Maintenance' }, { name: 'Gaming' }, { name: 'Electrical Supplies' },
  ]},
  { name: 'Beauty & Cosmetics', icon: 'sparkles', subs: [
    { name: 'Hair Salon' }, { name: 'Barber Shop' }, { name: 'Nail Studio' },
    { name: 'Skincare & Cosmetics' }, { name: 'Perfumes & Fragrances' }, { name: 'Spa & Wellness' },
  ]},
  { name: 'Health & Pharmacy', icon: 'heart-pulse', subs: [
    { name: 'Pharmacy' }, { name: 'Clinic / Hospital' }, { name: 'Optical' },
    { name: 'Dental' }, { name: 'Laboratory' }, { name: 'Traditional Medicine' },
  ]},
  { name: 'Home & Living', icon: 'home', subs: [
    { name: 'Furniture' }, { name: 'Kitchen & Dining' }, { name: 'Decoration & Interior' },
    { name: 'Mattresses & Bedding' }, { name: 'Cleaning Supplies' }, { name: 'Hardware & Tools' },
  ]},
  { name: 'Education & Books', icon: 'book-open', subs: [
    { name: 'Bookshop' }, { name: 'School Supplies' }, { name: 'Training Centre' },
    { name: 'Language School' }, { name: 'Tutoring' },
  ]},
  { name: 'Agriculture & Farming', icon: 'sprout', subs: [
    { name: 'Farm Produce' }, { name: 'Livestock' }, { name: 'Seeds & Fertilizers' },
    { name: 'Farming Equipment' }, { name: 'Agro-processing' },
  ]},
  { name: 'Construction & Building', icon: 'hard-hat', subs: [
    { name: 'Building Materials' }, { name: 'Plumbing' }, { name: 'Electrician' },
    { name: 'Painting & Decoration' }, { name: 'Architecture & Design' },
  ]},
  { name: 'Transport & Logistics', icon: 'truck', subs: [
    { name: 'Car Dealership' }, { name: 'Auto Parts' }, { name: 'Mechanic / Garage' },
    { name: 'Courier & Delivery' }, { name: 'Travel Agency' }, { name: 'Taxi / Ride Service' },
  ]},
  { name: 'Professional Services', icon: 'briefcase', subs: [
    { name: 'Legal Services' }, { name: 'Accounting & Finance' }, { name: 'Consulting' },
    { name: 'Insurance' }, { name: 'Real Estate' }, { name: 'Photography & Videography' },
    { name: 'Printing & Design' }, { name: 'Event Planning' },
  ]},
  { name: 'Entertainment & Leisure', icon: 'music', subs: [
    { name: 'Cinema' }, { name: 'Night Club' }, { name: 'Gym & Fitness' },
    { name: 'Sports Centre' }, { name: 'Art Gallery' }, { name: 'Amusement Park' },
  ]},
  { name: 'Other', icon: 'grid', subs: [] },
];

// POS Attributes for products
export interface POSAttribute {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  placeholder?: string;
}

export const POS_PRODUCT_ATTRIBUTES: POSAttribute[] = [
  { key: 'sku', label: 'SKU', type: 'text', placeholder: 'e.g. PRD-001' },
  { key: 'barcode', label: 'Barcode (EAN/UPC)', type: 'text', placeholder: 'e.g. 6001234567890' },
  { key: 'weight', label: 'Weight (kg)', type: 'number', placeholder: '0.5' },
  { key: 'unit', label: 'Unit of Measure', type: 'select', options: ['Piece', 'Kg', 'Litre', 'Pack', 'Box', 'Dozen', 'Bundle', 'Metre', 'Bag', 'Carton'] },
  { key: 'tax_class', label: 'Tax Class', type: 'select', options: ['Standard', 'Reduced', 'Zero-rated', 'Exempt'] },
  { key: 'cost_price', label: 'Cost Price (XAF)', type: 'number', placeholder: '500' },
  { key: 'selling_price', label: 'Selling Price (XAF)', type: 'number', placeholder: '1000' },
  { key: 'stock_quantity', label: 'Stock Quantity', type: 'number', placeholder: '100' },
  { key: 'low_stock_alert', label: 'Low Stock Alert', type: 'number', placeholder: '10' },
  { key: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Brasseries du Cameroun' },
  { key: 'color', label: 'Color', type: 'text', placeholder: 'e.g. Red' },
  { key: 'size', label: 'Size', type: 'text', placeholder: 'e.g. M, L, XL' },
  { key: 'expiry_date', label: 'Expiry Date', type: 'text', placeholder: 'YYYY-MM-DD' },
];

// Country → Currency mapping
export const COUNTRY_CURRENCIES: Record<string, { currency: string; symbol: string }> = {
  CM: { currency: 'XAF', symbol: 'FCFA' },
  NG: { currency: 'NGN', symbol: '₦' },
  GH: { currency: 'GHS', symbol: 'GH₵' },
  KE: { currency: 'KES', symbol: 'KSh' },
  RW: { currency: 'RWF', symbol: 'FRw' },
  ZA: { currency: 'ZAR', symbol: 'R' },
  SN: { currency: 'XOF', symbol: 'FCFA' },
  CI: { currency: 'XOF', symbol: 'FCFA' },
  GA: { currency: 'XAF', symbol: 'FCFA' },
  TD: { currency: 'XAF', symbol: 'FCFA' },
  CG: { currency: 'XAF', symbol: 'FCFA' },
  CF: { currency: 'XAF', symbol: 'FCFA' },
  GQ: { currency: 'XAF', symbol: 'FCFA' },
  US: { currency: 'USD', symbol: '$' },
  GB: { currency: 'GBP', symbol: '£' },
  FR: { currency: 'EUR', symbol: '€' },
  DE: { currency: 'EUR', symbol: '€' },
};
