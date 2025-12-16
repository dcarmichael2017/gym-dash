// packages/shared/constants/gymDefaults.js

export const PRESET_COLORS = [
  { name: 'White', hex: '#FFFFFF', border: '#e5e7eb' },
  { name: 'Grey', hex: '#9CA3AF', border: '#6B7280' },
  { name: 'Yellow', hex: '#FACC15', border: '#EAB308' },
  { name: 'Orange', hex: '#FB923C', border: '#EA580C' },
  { name: 'Green', hex: '#4ADE80', border: '#16A34A' },
  { name: 'Blue', hex: '#3B82F6', border: '#2563EB' },
  { name: 'Purple', hex: '#A855F7', border: '#7E22CE' },
  { name: 'Brown', hex: '#A97142', border: '#78350F' },
  { name: 'Red', hex: '#EF4444', border: '#B91C1C' },
  { name: 'Black', hex: '#111827', border: '#000000' },
  { name: 'Camo', hex: '#84cc16', border: '#3f6212' }, // Sometimes used in kids classes
];

export const RANK_PRESETS = [
  // --- BRAZILIAN JIU JITSU ---
  {
    id: 'bjj_adult',
    name: 'BJJ (Adult)',
    description: 'IBJJF Standard',
    ranks: [
      { name: 'White Belt', color: '#FFFFFF', classesRequired: 0, maxStripes: 4 },
      { name: 'Blue Belt', color: '#3B82F6', classesRequired: 150, maxStripes: 4 }, // ~1.5-2 years
      { name: 'Purple Belt', color: '#A855F7', classesRequired: 400, maxStripes: 4 }, // ~3-4 years
      { name: 'Brown Belt', color: '#A97142', classesRequired: 750, maxStripes: 4 }, // ~6-7 years
      { name: 'Black Belt', color: '#111827', classesRequired: 1200, maxStripes: 6 }, // ~10+ years
    ]
  },
  {
    id: 'bjj_kids',
    name: 'BJJ (Kids)',
    description: 'Monthly progression (IBJJF)',
    ranks: [
      { name: 'White Belt', color: '#FFFFFF', classesRequired: 0, maxStripes: 4 },
      { name: 'Grey/White', color: '#9CA3AF', classesRequired: 40, maxStripes: 4 },
      { name: 'Solid Grey', color: '#9CA3AF', classesRequired: 80, maxStripes: 4 },
      { name: 'Grey/Black', color: '#9CA3AF', classesRequired: 120, maxStripes: 4 },
      { name: 'Yellow/White', color: '#FACC15', classesRequired: 160, maxStripes: 4 },
      { name: 'Solid Yellow', color: '#FACC15', classesRequired: 200, maxStripes: 4 },
      { name: 'Yellow/Black', color: '#FACC15', classesRequired: 240, maxStripes: 4 },
      { name: 'Orange/White', color: '#FB923C', classesRequired: 280, maxStripes: 4 },
      { name: 'Solid Orange', color: '#FB923C', classesRequired: 320, maxStripes: 4 },
      { name: 'Green/White', color: '#4ADE80', classesRequired: 360, maxStripes: 4 },
      { name: 'Solid Green', color: '#4ADE80', classesRequired: 400, maxStripes: 4 },
    ]
  },

  // --- MUAY THAI ---
  {
    id: 'muay_thai',
    name: 'Muay Thai',
    description: 'Pra Jiad (Armbands)',
    ranks: [
      { name: 'White (Beginner)', color: '#FFFFFF', classesRequired: 0, maxStripes: 0 },
      { name: 'Yellow (Novice)', color: '#FACC15', classesRequired: 30, maxStripes: 0 },
      { name: 'Orange (Intermediate)', color: '#FB923C', classesRequired: 60, maxStripes: 0 },
      { name: 'Green (Advanced)', color: '#4ADE80', classesRequired: 100, maxStripes: 0 },
      { name: 'Blue (Assistant)', color: '#3B82F6', classesRequired: 150, maxStripes: 0 },
      { name: 'Brown (Kru/Instructor)', color: '#A97142', classesRequired: 300, maxStripes: 0 },
      { name: 'Red (Master)', color: '#EF4444', classesRequired: 500, maxStripes: 0 },
    ]
  },

  // --- JUDO ---
  {
    id: 'judo_adult',
    name: 'Judo (Adult)',
    description: 'Traditional Kyu/Dan',
    ranks: [
      { name: 'White (Rokkyu)', color: '#FFFFFF', classesRequired: 0, maxStripes: 0 },
      { name: 'Yellow (Gokyu)', color: '#FACC15', classesRequired: 40, maxStripes: 0 },
      { name: 'Orange (Yonkyu)', color: '#FB923C', classesRequired: 80, maxStripes: 0 },
      { name: 'Green (Sankyu)', color: '#4ADE80', classesRequired: 130, maxStripes: 0 },
      { name: 'Blue (Nikyu)', color: '#3B82F6', classesRequired: 200, maxStripes: 0 },
      { name: 'Brown (Ikkyu)', color: '#A97142', classesRequired: 300, maxStripes: 0 },
      { name: 'Black (Shodan)', color: '#111827', classesRequired: 500, maxStripes: 0 },
    ]
  },
  {
    id: 'judo_kids',
    name: 'Judo (Kids)',
    description: 'Mon System (Junior)',
    ranks: [
      { name: 'White', color: '#FFFFFF', classesRequired: 0, maxStripes: 3 },
      { name: 'Yellow', color: '#FACC15', classesRequired: 30, maxStripes: 3 },
      { name: 'Orange', color: '#FB923C', classesRequired: 60, maxStripes: 3 },
      { name: 'Green', color: '#4ADE80', classesRequired: 90, maxStripes: 3 },
      { name: 'Blue', color: '#3B82F6', classesRequired: 130, maxStripes: 3 },
      { name: 'Purple', color: '#A855F7', classesRequired: 180, maxStripes: 3 },
      { name: 'Brown', color: '#A97142', classesRequired: 250, maxStripes: 3 },
    ]
  },

  // --- KARATE ---
  {
    id: 'karate_adult',
    name: 'Karate (Adult)',
    description: 'Shotokan Kyu/Dan',
    ranks: [
      { name: 'White (9th Kyu)', color: '#FFFFFF', classesRequired: 0, maxStripes: 0 },
      { name: 'Yellow (8th Kyu)', color: '#FACC15', classesRequired: 40, maxStripes: 0 },
      { name: 'Orange (7th Kyu)', color: '#FB923C', classesRequired: 80, maxStripes: 0 },
      { name: 'Green (6th Kyu)', color: '#4ADE80', classesRequired: 120, maxStripes: 0 },
      { name: 'Purple (5th Kyu)', color: '#A855F7', classesRequired: 160, maxStripes: 0 },
      { name: 'Purple (4th Kyu)', color: '#A855F7', classesRequired: 200, maxStripes: 0 },
      { name: 'Brown (3rd Kyu)', color: '#A97142', classesRequired: 250, maxStripes: 0 },
      { name: 'Black (1st Dan)', color: '#111827', classesRequired: 450, maxStripes: 0 },
    ]
  },
  {
    id: 'karate_kids',
    name: 'Karate (Kids)',
    description: 'Junior Progressions',
    ranks: [
      { name: 'White', color: '#FFFFFF', classesRequired: 0, maxStripes: 2 },
      { name: 'Yellow', color: '#FACC15', classesRequired: 30, maxStripes: 2 },
      { name: 'Orange', color: '#FB923C', classesRequired: 60, maxStripes: 2 },
      { name: 'Green', color: '#4ADE80', classesRequired: 90, maxStripes: 2 },
      { name: 'Blue', color: '#3B82F6', classesRequired: 120, maxStripes: 2 },
      { name: 'Purple', color: '#A855F7', classesRequired: 160, maxStripes: 2 },
      { name: 'Red', color: '#EF4444', classesRequired: 200, maxStripes: 2 },
      { name: 'Brown', color: '#A97142', classesRequired: 250, maxStripes: 2 },
    ]
  },

  // --- TAEKWONDO ---
  {
    id: 'taekwondo',
    name: 'Taekwondo (WT)',
    description: 'Kup System',
    ranks: [
      { name: 'White Belt', color: '#FFFFFF', classesRequired: 0, maxStripes: 0 },
      { name: 'Yellow Belt', color: '#FACC15', classesRequired: 40, maxStripes: 0 },
      { name: 'Green Belt', color: '#4ADE80', classesRequired: 80, maxStripes: 0 },
      { name: 'Blue Belt', color: '#3B82F6', classesRequired: 140, maxStripes: 0 },
      { name: 'Red Belt', color: '#EF4444', classesRequired: 220, maxStripes: 0 },
      { name: 'Black Belt', color: '#111827', classesRequired: 350, maxStripes: 0 },
    ]
  },

  // --- KICKBOXING / BOXING ---
  {
    id: 'kickboxing',
    name: 'Kickboxing / Striking',
    description: 'Level System',
    ranks: [
      { name: 'Beginner', color: '#FFFFFF', classesRequired: 0, maxStripes: 0 },
      { name: 'Level 1', color: '#FACC15', classesRequired: 30, maxStripes: 0 },
      { name: 'Level 2', color: '#FB923C', classesRequired: 60, maxStripes: 0 },
      { name: 'Level 3', color: '#4ADE80', classesRequired: 100, maxStripes: 0 },
      { name: 'Advanced', color: '#EF4444', classesRequired: 200, maxStripes: 0 },
    ]
  },

  // --- CUSTOM ---
  {
    id: 'custom',
    name: 'Custom / Blank',
    description: 'Start from scratch',
    ranks: []
  }
];