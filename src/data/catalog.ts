export interface ProductVariant {
  id: number;
  a: boolean;
  o: string[];
}

export interface ProductItem {
  id: string;
  name: string;
  category: 'Jackets' | 'Coats' | 'Bags' | 'Footwear' | 'Small Goods';
  leather: 'Lambskin' | 'Calfskin' | 'Shearling' | 'Bridle';
  vendor: string;
  type: string;
  price: number;
  image: string;
  width: number;
  height: number;
  optionName: string;
  sizes: string[];
  variants: ProductVariant[];
  specs: string[];
  description: string;
  tag?: string;
}

export interface LookPin {
  num: number;
  productId: string;
  left: number;
  top: number;
}

export interface RunwayLook {
  key: string;
  name: string;
  description: string;
  image: string;
  fallbackImage: string;
  products: string[];
  pins: LookPin[];
  featuredNewIndex?: number;
}

export interface FactoryStage {
  step: string;
  title: string;
  duration: string;
  detail: string;
  spec: string;
}

export const BRAND_INFO = {
  name: 'STRIDE LONDON',
  tagline: 'Built in Hide, Tailored for Decades.',
  address: '14 Redchurch Street, Shoreditch, London E2 7DP',
  email: 'atelier@stridelondon.com',
  phone: '+44 20 7946 0821',
  factoryHours: 'Mon–Sat · 09:00–18:30 GMT',
};

export const FACTORY_IMAGES = {
  cutting: '/src/assets/images/stride_factory_cutting_1794536044656.jpg',
  stitching: '/src/assets/images/stride_factory_stitching_1794536044605.jpg',
};

export const FACTORY_STAGES: FactoryStage[] = [
  {
    step: '01',
    title: 'Hide Grading & Drum Dyeing',
    duration: 'Day 1–3',
    detail:
      'Every hide arrives as full-grain, uncorrected European calf, lamb, or pit-tanned English bridle. Master graders inspect each skin under north-facing skylights for uniform grain density before drum-dyeing in small batches.',
    spec: '1.1mm – 2.2mm full-grain hides · Zero synthetic topcoat',
  },
  {
    step: '02',
    title: 'Brass Pattern Drafting & Hand Clicking',
    duration: 'Day 4',
    detail:
      'Using solid brass-edged patterns specific to each silhouette, cutters hand-click jacket sleeves, yokes, and bag gussets along the natural stretch axis so elbows and handles never bag out over time.',
    spec: '18–26 individual leather panels per jacket',
  },
  {
    step: '03',
    title: 'Precision Skiving & Seam Reinforcement',
    duration: 'Day 5',
    detail:
      'Where multiple hide layers meet—collar stands, lapel rolls, cuff plackets—edges are feather-skived to 0.6mm and backed with woven cotton stay-tape so seams lie flat without bulk.',
    spec: '0.6mm tapered seam allowance · Cotton stay-tape',
  },
  {
    step: '04',
    title: 'Walking-Foot Lockstitching',
    duration: 'Day 6–7',
    detail:
      'Artisans guide every panel through vintage Adler 267 walking-foot machines using waxed, UV-stabilized bonded nylon thread. Stress points at pocket corners and shoulder heads receive double topstitching.',
    spec: '7 stitches per inch · Bonded #40 nylon thread',
  },
  {
    step: '05',
    title: 'Solid Hardware & Cupro Tailoring',
    duration: 'Day 8',
    detail:
      'We set solid cast-brass rivets, custom #8 metal teeth zippers, and horn buttons individually by hand press, then bag-line each jacket in breathable Japanese cupro twill for effortless layering.',
    spec: '#8 solid metal zips · Breathable 100% cupro lining',
  },
  {
    step: '06',
    title: 'Beeswax Conditioning & 48-Point Inspection',
    duration: 'Day 9',
    detail:
      'Finished garments, bags, and Goodyear-welted boots are hand-buffed with warm beeswax balm, numbered on an internal leather specification patch, and cleared across 48 structural checkpoints before dispatch.',
    spec: 'Individually numbered · Lifetime seam & zip guarantee',
  },
];

export const PRODUCTS: ProductItem[] = [
  {
    id: 'kensington-biker',
    name: 'Kensington Lambskin Biker',
    category: 'Jackets',
    leather: 'Lambskin',
    vendor: 'STRIDE LONDON · Lambskin',
    type: 'Full-Grain Outerwear',
    price: 890,
    image: '/src/assets/images/stride_prod_biker_1794536041040.jpg',
    width: 400,
    height: 533,
    optionName: 'Size',
    sizes: ['S', 'M', 'L', 'XL'],
    variants: [
      { id: 910101, a: true, o: ['S'] },
      { id: 910102, a: true, o: ['M'] },
      { id: 910103, a: true, o: ['L'] },
      { id: 910104, a: true, o: ['XL'] },
    ],
    specs: [
      '1.2mm drum-dyed full-grain Italian lambskin',
      'Matte silver #8 solid metal asymmetric zips',
      'Breathable black cupro twill body lining',
      'Hand-clicked gusseted action back & zip cuffs',
    ],
    description:
      'Our flagship asymmetric moto jacket, built from supple 1.2mm full-grain lambskin with articulated elbows, snap-down lapels, and hand-taped stress seams.',
  },
  {
    id: 'mayfair-trench',
    name: 'Mayfair Calfskin Trench',
    category: 'Coats',
    leather: 'Calfskin',
    vendor: 'STRIDE LONDON · Calfskin',
    type: 'Tailored Leather Coat',
    price: 1240,
    image: '/src/assets/images/stride_prod_trench_1794536041569.jpg',
    width: 400,
    height: 533,
    optionName: 'Size',
    sizes: ['S', 'M', 'L', 'XL'],
    variants: [
      { id: 910201, a: true, o: ['S'] },
      { id: 910202, a: true, o: ['M'] },
      { id: 910203, a: true, o: ['L'] },
      { id: 910204, a: true, o: ['XL'] },
    ],
    specs: [
      '1.1mm espresso vegetable-retanned calfskin',
      'Genuine carved horn buttons & leather-buckled belt',
      'Feather-skived storm yoke & throat latch',
      'Center back walking vent with concealed snap',
    ],
    description:
      'Full-length double-breasted trench tailored from whole-hide espresso calfskin. Skived at the lapels and cuffs so the coat drapes like wool while blocking London rain.',
    tag: 'New',
  },
  {
    id: 'soho-aviator',
    name: 'Soho Shearling Aviator',
    category: 'Jackets',
    leather: 'Shearling',
    vendor: 'STRIDE LONDON · Shearling',
    type: 'Flight Leather Outerwear',
    price: 1080,
    image: '/src/assets/images/stride_prod_aviator_1794536041283.jpg',
    width: 400,
    height: 533,
    optionName: 'Size',
    sizes: ['S', 'M', 'L', 'XL'],
    variants: [
      { id: 910301, a: true, o: ['S'] },
      { id: 910302, a: true, o: ['M'] },
      { id: 910303, a: true, o: ['L'] },
      { id: 910304, a: true, o: ['XL'] },
    ],
    specs: [
      '1.4mm aniline waxed cognac cowhide',
      'Plush detachable merino shearling collar',
      'Twin gusseted bellow pockets with brass snaps',
      'Heavy-gauge merino wool rib waist & cuffs',
    ],
    description:
      'Heavyweight flight jacket cut from 1.4mm waxed cognac cowhide with reinforced elbow patches and a dense merino shearling collar built for winter longevity.',
    tag: 'New',
  },
  {
    id: 'shoreditch-bomber',
    name: 'Shoreditch Oxblood Bomber',
    category: 'Jackets',
    leather: 'Calfskin',
    vendor: 'STRIDE LONDON · Nappa',
    type: 'Blouson Outerwear',
    price: 790,
    image: '/src/assets/images/stride_prod_bomber_1794536042399.jpg',
    width: 400,
    height: 533,
    optionName: 'Size',
    sizes: ['S', 'M', 'L', 'XL'],
    variants: [
      { id: 910401, a: true, o: ['S'] },
      { id: 910402, a: true, o: ['M'] },
      { id: 910403, a: true, o: ['L'] },
      { id: 910404, a: true, o: ['XL'] },
    ],
    specs: [
      '1.1mm deep oxblood aniline nappa calfskin',
      'Two-way brushed gunmetal zipper',
      'Raglan sleeve geometry for clean shoulder line',
      'Dual internal buttoned leather passport pockets',
    ],
    description:
      'Minimalist blouson silhouette dyed in rich oxblood nappa, finished with clean double-welted handwarmer pockets and custom knitted wool ribbing.',
  },
  {
    id: 'savile-weekender',
    name: 'Savile Bridle Weekender',
    category: 'Bags',
    leather: 'Bridle',
    vendor: 'STRIDE LONDON · Bridle',
    type: 'Hand-Stitched Luggage',
    price: 620,
    image: '/src/assets/images/stride_prod_weekender_1794536042513.jpg',
    width: 400,
    height: 400,
    optionName: 'Size',
    sizes: ['One Size'],
    variants: [{ id: 910501, a: true, o: ['One Size'] }],
    specs: [
      '2.2mm pit-tanned English bridle leather',
      'Solid sand-cast brass buckles & D-rings',
      'Hand-rolled bridle handles with copper rivets',
      '42L cabin-compliant interior with zip pocket',
    ],
    description:
      'Structured overnight holdall crafted in our London workshop from 2.2mm cognac bridle hide, complete with five solid brass base studs and detachable shoulder strap.',
  },
  {
    id: 'camden-chelsea',
    name: 'Camden Welted Chelsea Boot',
    category: 'Footwear',
    leather: 'Calfskin',
    vendor: 'STRIDE LONDON · Footwear',
    type: 'Goodyear-Welted Boot',
    price: 380,
    image: '/src/assets/images/stride_prod_chelsea_1794536042506.jpg',
    width: 400,
    height: 400,
    optionName: 'Shoe size',
    sizes: ['40', '41', '42', '43', '44', '45', '46'],
    variants: [
      { id: 910601, a: true, o: ['40'] },
      { id: 910602, a: true, o: ['41'] },
      { id: 910603, a: true, o: ['42'] },
      { id: 910604, a: true, o: ['43'] },
      { id: 910605, a: true, o: ['44'] },
      { id: 910606, a: true, o: ['45'] },
      { id: 910607, a: true, o: ['46'] },
    ],
    specs: [
      '1.6mm French box-calf whole-cut upper',
      '360° Goodyear storm welt construction',
      'High-traction commando rubber lug sole',
      'Cork-filled midsole & vegetable-tanned lining',
    ],
    description:
      'Whole-cut black box-calf Chelsea boot blocked on an ergonomic London last and stitched to a storm-welted Vibram lug sole for all-weather wear and full resoleability.',
  },
  {
    id: 'holborn-derby',
    name: 'Holborn Storm-Welt Derby',
    category: 'Footwear',
    leather: 'Calfskin',
    vendor: 'STRIDE LONDON · Footwear',
    type: 'Benchmade Leather Shoe',
    price: 360,
    image: '/src/assets/images/stride_prod_derby_1794536043305.jpg',
    width: 400,
    height: 400,
    optionName: 'Shoe size',
    sizes: ['40', '41', '42', '43', '44', '45', '46'],
    variants: [
      { id: 910701, a: true, o: ['40'] },
      { id: 910702, a: true, o: ['41'] },
      { id: 910703, a: true, o: ['42'] },
      { id: 910704, a: true, o: ['43'] },
      { id: 910705, a: true, o: ['44'] },
      { id: 910706, a: true, o: ['45'] },
      { id: 910707, a: true, o: ['46'] },
    ],
    specs: [
      '1.6mm espresso pull-up calfskin',
      'Natural split-reverse Goodyear storm welt',
      'Four antique brass eyelets & waxed cotton laces',
      'Full calfskin-lined quarters & heel counter',
    ],
    description:
      'Plain-toe architectural Derby crafted from oiled espresso calfskin with contrast stitched natural welt and thick stacked leather heel.',
  },
  {
    id: 'clerkenwell-set',
    name: 'Clerkenwell Belt & Gloves Set',
    category: 'Small Goods',
    leather: 'Bridle',
    vendor: 'STRIDE LONDON · Small Goods',
    type: 'Bridle Leather Set',
    price: 240,
    image: '/src/assets/images/stride_prod_accessories_1794536042495.jpg',
    width: 400,
    height: 400,
    optionName: 'Size',
    sizes: ['S', 'M', 'L'],
    variants: [
      { id: 910801, a: true, o: ['S'] },
      { id: 910802, a: true, o: ['M'] },
      { id: 910803, a: true, o: ['L'] },
    ],
    specs: [
      '3.5mm hand-burnished chestnut bridle belt',
      'Solid cast brass buckle with hand-stitched keeper',
      'Unlined perforated chestnut leather driving gloves',
      'Engraved STRIDE LONDON brass cuff snap',
    ],
    description:
      'Curated small leather goods pairing a heavy 32mm English bridle belt with hand-sewn perforated driving gloves cut from supple chestnut hide.',
  },
];

export const LOOKS: RunwayLook[] = [
  {
    key: 'soho01',
    name: 'The Soho Edit',
    description: '1.2mm black lambskin biker, bridle weekender, and box-calf Chelsea boots.',
    image: '/src/assets/images/stride_look_biker_1794536038379.webp',
    fallbackImage: '/src/assets/images/stride_look_biker_1794536038379.jpg',
    products: ['kensington-biker', 'savile-weekender', 'camden-chelsea'],
    pins: [
      { num: 1, productId: 'kensington-biker', left: 49, top: 30 },
      { num: 2, productId: 'savile-weekender', left: 31, top: 63 },
      { num: 3, productId: 'camden-chelsea', left: 47, top: 91 },
    ],
  },
  {
    key: 'mayf02',
    name: 'Mayfair Rain',
    description: 'Espresso calfskin trench coat, bridle leather accessories, and storm-welt Derbies.',
    image: '/src/assets/images/stride_look_trench_1794536039332.webp',
    fallbackImage: '/src/assets/images/stride_look_trench_1794536039332.jpg',
    products: ['mayfair-trench', 'clerkenwell-set', 'holborn-derby'],
    featuredNewIndex: 0,
    pins: [
      { num: 1, productId: 'mayfair-trench', left: 49, top: 34 },
      { num: 2, productId: 'clerkenwell-set', left: 51, top: 41 },
      { num: 3, productId: 'holborn-derby', left: 48, top: 91 },
    ],
  },
  {
    key: 'avia03',
    name: 'Aviator Heritage',
    description: 'Cognac shearling flight jacket paired with bridle duffle and heritage footwear.',
    image: '/src/assets/images/stride_look_aviator_1794536040237.webp',
    fallbackImage: '/src/assets/images/stride_look_aviator_1794536040237.jpg',
    products: ['soho-aviator', 'savile-weekender', 'holborn-derby'],
    featuredNewIndex: 0,
    pins: [
      { num: 1, productId: 'soho-aviator', left: 49, top: 29 },
      { num: 2, productId: 'savile-weekender', left: 30, top: 67 },
      { num: 3, productId: 'holborn-derby', left: 48, top: 90 },
    ],
  },
  {
    key: 'shor04',
    name: 'Shoreditch Night',
    description: 'Oxblood nappa bomber, chestnut driving set, and welted Chelsea boots.',
    image: '/src/assets/images/stride_look_bomber_1794536040453.webp',
    fallbackImage: '/src/assets/images/stride_look_bomber_1794536040453.jpg',
    products: ['shoreditch-bomber', 'clerkenwell-set', 'camden-chelsea'],
    pins: [
      { num: 1, productId: 'shoreditch-bomber', left: 50, top: 30 },
      { num: 2, productId: 'clerkenwell-set', left: 40, top: 46 },
      { num: 3, productId: 'camden-chelsea', left: 48, top: 91 },
    ],
  },
  {
    key: 'stud05',
    name: 'Studio Slate',
    description: 'Minimalist outerwear silhouette styled with bridle goods and box-calf boots.',
    image: '/src/assets/images/stride_look_overshirt_1794536040303.webp',
    fallbackImage: '/src/assets/images/stride_look_overshirt_1794536040303.jpg',
    products: ['kensington-biker', 'clerkenwell-set', 'camden-chelsea'],
    pins: [
      { num: 1, productId: 'kensington-biker', left: 49, top: 29 },
      { num: 2, productId: 'clerkenwell-set', left: 49, top: 51 },
      { num: 3, productId: 'camden-chelsea', left: 48, top: 91 },
    ],
  },
  {
    key: 'fiel06',
    name: 'Field & Bridle',
    description: 'Weather-treated outerwear, bridle travel holdall, and espresso Derby shoes.',
    image: '/src/assets/images/stride_look_field_1794536041307.webp',
    fallbackImage: '/src/assets/images/stride_look_field_1794536041307.jpg',
    products: ['mayfair-trench', 'savile-weekender', 'holborn-derby'],
    pins: [
      { num: 1, productId: 'mayfair-trench', left: 49, top: 30 },
      { num: 2, productId: 'savile-weekender', left: 33, top: 53 },
      { num: 3, productId: 'holborn-derby', left: 48, top: 91 },
    ],
  },
];

export function computeLookBundlePrice(productIds: string[]): {
  compareAt: number;
  bundlePrice: number;
} {
  const byId = new Map(PRODUCTS.map((p) => [p.id, p]));
  const compareAt = productIds.reduce((sum, id) => sum + (byId.get(id)?.price || 0), 0);
  const bundlePrice = Math.round(compareAt * 0.9 * 100) / 100;
  return { compareAt, bundlePrice };
}
