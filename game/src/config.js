// LEONIDA NIGHTS — tuning and content tables. One place for every number the
// other modules share, so balancing the game means editing this file alone.

export const CFG = {
  // City layout (metres). A 7x7 grid of blocks; roads run between them.
  blockSize: 60,
  roadWidth: 14,
  blocks: 7,
  // Beach strip along the south edge (positive z).
  beachZ: 250,
  oceanZ: 285,
  // Player
  walkSpeed: 9,
  runSpeed: 15,
  // Wanted
  wantedMax: 5,
  bustedHoldSeconds: 2.2,
  loseCopsDistance: 150,
  loseCopsSeconds: 8,
  // Jobs
  jobMarkerCount: 3,
  deliveryBasePay: 220,
  getawayBasePay: 520,
  raceBasePay: 650,
  // Save
  saveKey: 'leonida-nights-save-v1',
};

// Rank ladder: rep needed, title, and the cash bonus on promotion.
export const RANKS = [
  { rep: 0, title: 'Street Rookie', bonus: 0 },
  { rep: 150, title: 'Hustler', bonus: 400 },
  { rep: 350, title: 'Wheelman', bonus: 1000 },
  { rep: 600, title: 'Kingpin', bonus: 2200 },
  { rep: 900, title: 'Leonida Legend', bonus: 5000 },
];

// Cars you can own. speed = top speed (m/s), accel = m/s^2, grip = cornering.
export const CARS = [
  { id: 'sedan', name: 'Sunset Sedan', price: 0, speed: 34, accel: 13, grip: 2.6, color: 0xff5a3c, desc: 'Your first ride. Slow, honest, pink at heart.' },
  { id: 'gt', name: 'Neon GT', price: 8000, speed: 46, accel: 19, grip: 3.4, color: 0x37e0ff, desc: 'A street racer with a neon soul. Fast on the boulevard.' },
  { id: 'super', name: 'Vice Supercar', price: 25000, speed: 58, accel: 25, grip: 4.2, color: 0xffd166, desc: 'Gold, loud, untouchable. The car of a Leonida Legend.' },
];

// Upgrades apply to the car you are driving. Each has 3 levels.
export const UPGRADES = [
  { id: 'engine', name: 'Engine Tune', desc: '+12% top speed / level', prices: [1500, 3000, 6000] },
  { id: 'tires', name: 'Grip Tires', desc: '+15% cornering / level', prices: [1200, 2400, 4800] },
  { id: 'armor', name: 'Armor Plating', desc: '+34% damage resistance / level', prices: [1000, 2000, 4000] },
];

// Job types: how they pay and how long they give you.
export const JOB_TYPES = {
  delivery: { name: 'Delivery', pay: CFG.deliveryBasePay, rep: 25, color: 0x7dffb0 },
  getaway: { name: 'Getaway', pay: CFG.getawayBasePay, rep: 45, color: 0xff3355 },
  race: { name: 'Street Race', pay: CFG.raceBasePay, rep: 60, color: 0xffd166 },
};

// District names for flavour text on the HUD and job banners.
export const DISTRICTS = [
  'Ocean Drive', 'Neon Row', 'Palm Court', 'Downtown', 'Little Havana',
  'Starfish Bay', 'Vice Port', 'Sunset Strip', 'Coconut Grove', 'The Keys',
];

// Brainrot-free original street names for the minimap flavour (not shown on map).
export const STREETS = ['Ocean Dr', 'Neon Ave', 'Palm Blvd', 'Vice St', 'Sunset Rd', 'Bay St'];
