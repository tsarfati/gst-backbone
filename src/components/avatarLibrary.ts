export type AvatarLibraryCategory = 'nintendo' | 'generic' | 'sports' | 'construction' | 'custom';
export type AvatarLibraryAlbumId = AvatarLibraryCategory | `system:${string}`;

export interface CustomAvatarEntry {
  id: string;
  name: string;
  avatarUrl: string;
  category: 'custom';
}

export interface AvatarLibraryPreset {
  id: string;
  name: string;
  category: AvatarLibraryCategory;
  monogram: string;
  topColor: string;
  bottomColor: string;
  accentColor: string;
  ringColor: string;
  accessory?: 'star' | 'cap' | 'helmet' | 'badge' | 'stripe';
}

export interface SystemAvatarLibraryItem {
  id: string;
  name: string;
  image_url: string;
  sort_order?: number;
}

export interface SystemAvatarLibrary {
  id: string;
  name: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_global: boolean;
  is_active: boolean;
  company_ids?: string[];
  items: SystemAvatarLibraryItem[];
}

export const AVATAR_LIBRARY_CATEGORY_LABELS: Record<AvatarLibraryCategory, string> = {
  nintendo: 'Nintendo-Style',
  generic: 'Clip Art / Generic',
  sports: 'Sports Team Style',
  construction: 'Construction Crew',
  custom: 'Custom Library',
};

export const AVATAR_LIBRARY_PRESETS: AvatarLibraryPreset[] = [
  { id: 'nintendo-plumber', name: 'Plumber Hero', category: 'nintendo', monogram: 'PH', topColor: '#ef4444', bottomColor: '#f59e0b', accentColor: '#fde047', ringColor: '#b91c1c', accessory: 'cap' },
  { id: 'nintendo-galaxy', name: 'Galaxy Hunter', category: 'nintendo', monogram: 'GH', topColor: '#2563eb', bottomColor: '#7c3aed', accentColor: '#93c5fd', ringColor: '#1d4ed8', accessory: 'star' },
  { id: 'nintendo-forest', name: 'Forest Knight', category: 'nintendo', monogram: 'FK', topColor: '#16a34a', bottomColor: '#065f46', accentColor: '#86efac', ringColor: '#166534', accessory: 'badge' },
  { id: 'nintendo-racer', name: 'Turbo Racer', category: 'nintendo', monogram: 'TR', topColor: '#f97316', bottomColor: '#dc2626', accentColor: '#fed7aa', ringColor: '#9a3412', accessory: 'stripe' },
  { id: 'nintendo-princess', name: 'Castle Star', category: 'nintendo', monogram: 'CS', topColor: '#ec4899', bottomColor: '#a855f7', accentColor: '#fbcfe8', ringColor: '#be185d', accessory: 'star' },
  { id: 'nintendo-electric', name: 'Electric Buddy', category: 'nintendo', monogram: 'EB', topColor: '#facc15', bottomColor: '#eab308', accentColor: '#fef08a', ringColor: '#ca8a04', accessory: 'badge' },

  { id: 'generic-slate', name: 'Slate Pro', category: 'generic', monogram: 'SP', topColor: '#475569', bottomColor: '#1e293b', accentColor: '#cbd5e1', ringColor: '#334155', accessory: 'badge' },
  { id: 'generic-ocean', name: 'Ocean Calm', category: 'generic', monogram: 'OC', topColor: '#0ea5e9', bottomColor: '#1d4ed8', accentColor: '#bae6fd', ringColor: '#0369a1', accessory: 'star' },
  { id: 'generic-mint', name: 'Mint Clean', category: 'generic', monogram: 'MC', topColor: '#34d399', bottomColor: '#0f766e', accentColor: '#bbf7d0', ringColor: '#0f766e', accessory: 'stripe' },
  { id: 'generic-charcoal', name: 'Charcoal', category: 'generic', monogram: 'CH', topColor: '#111827', bottomColor: '#374151', accentColor: '#d1d5db', ringColor: '#1f2937', accessory: 'cap' },
  { id: 'generic-sand', name: 'Sandstone', category: 'generic', monogram: 'SA', topColor: '#f59e0b', bottomColor: '#b45309', accentColor: '#fde68a', ringColor: '#92400e', accessory: 'badge' },
  { id: 'generic-lavender', name: 'Lavender', category: 'generic', monogram: 'LV', topColor: '#a78bfa', bottomColor: '#7c3aed', accentColor: '#ddd6fe', ringColor: '#6d28d9', accessory: 'star' },

  { id: 'sports-redhawks', name: 'Red Hawks', category: 'sports', monogram: 'RH', topColor: '#dc2626', bottomColor: '#1f2937', accentColor: '#fee2e2', ringColor: '#991b1b', accessory: 'stripe' },
  { id: 'sports-bluetide', name: 'Blue Tide', category: 'sports', monogram: 'BT', topColor: '#1d4ed8', bottomColor: '#0f172a', accentColor: '#dbeafe', ringColor: '#1e40af', accessory: 'stripe' },
  { id: 'sports-goldlions', name: 'Gold Lions', category: 'sports', monogram: 'GL', topColor: '#ca8a04', bottomColor: '#78350f', accentColor: '#fef3c7', ringColor: '#a16207', accessory: 'badge' },
  { id: 'sports-greensquad', name: 'Green Squad', category: 'sports', monogram: 'GS', topColor: '#15803d', bottomColor: '#14532d', accentColor: '#dcfce7', ringColor: '#166534', accessory: 'cap' },
  { id: 'sports-purplestorm', name: 'Purple Storm', category: 'sports', monogram: 'PS', topColor: '#7c3aed', bottomColor: '#312e81', accentColor: '#ede9fe', ringColor: '#5b21b6', accessory: 'star' },
  { id: 'sports-blackice', name: 'Black Ice', category: 'sports', monogram: 'BI', topColor: '#0f172a', bottomColor: '#111827', accentColor: '#e5e7eb', ringColor: '#1f2937', accessory: 'stripe' },

  { id: 'construction-foreman', name: 'Foreman', category: 'construction', monogram: 'FM', topColor: '#f59e0b', bottomColor: '#b45309', accentColor: '#fef3c7', ringColor: '#92400e', accessory: 'helmet' },
  { id: 'construction-super', name: 'Site Super', category: 'construction', monogram: 'SS', topColor: '#f97316', bottomColor: '#7c2d12', accentColor: '#fdba74', ringColor: '#9a3412', accessory: 'helmet' },
  { id: 'construction-safety', name: 'Safety Lead', category: 'construction', monogram: 'SL', topColor: '#facc15', bottomColor: '#ca8a04', accentColor: '#fef08a', ringColor: '#a16207', accessory: 'helmet' },
  { id: 'construction-estimator', name: 'Estimator', category: 'construction', monogram: 'ES', topColor: '#0ea5e9', bottomColor: '#075985', accentColor: '#bae6fd', ringColor: '#0369a1', accessory: 'badge' },
  { id: 'construction-builder', name: 'Builder Crew', category: 'construction', monogram: 'BC', topColor: '#16a34a', bottomColor: '#14532d', accentColor: '#bbf7d0', ringColor: '#166534', accessory: 'helmet' },
  { id: 'construction-electric', name: 'Field Tech', category: 'construction', monogram: 'FT', topColor: '#64748b', bottomColor: '#0f172a', accentColor: '#cbd5e1', ringColor: '#334155', accessory: 'cap' },
];

const renderAccessory = (preset: AvatarLibraryPreset) => {
  switch (preset.accessory) {
    case 'helmet':
      return `
        <path d="M24 34c0-13 10.5-23 24-23s24 10 24 23v5H24z" fill="${preset.accentColor}" opacity="0.95" />
        <rect x="29" y="37" width="38" height="6" rx="3" fill="${preset.ringColor}" opacity="0.9" />
      `;
    case 'cap':
      return `
        <path d="M26 34c3-10 12-16 22-16 10 0 19 6 22 16H26z" fill="${preset.accentColor}" opacity="0.95" />
        <path d="M63 36c6 0 11 2 13 5-7 2-14 2-20 0 1-3 4-5 7-5z" fill="${preset.ringColor}" opacity="0.85" />
      `;
    case 'badge':
      return `
        <circle cx="70" cy="27" r="8" fill="${preset.accentColor}" opacity="0.9" />
        <path d="M70 20l2 4 4 .5-3 3 .8 4.5-3.8-2-3.8 2 .8-4.5-3-3 4-.5z" fill="${preset.ringColor}" />
      `;
    case 'stripe':
      return `
        <path d="M10 68l20-20 10 10-20 20z" fill="${preset.accentColor}" opacity="0.2" />
        <path d="M58 20l8-8 22 22-8 8z" fill="${preset.accentColor}" opacity="0.2" />
      `;
    case 'star':
      return `
        <path d="M73 18l2.8 5.8 6.4.9-4.6 4.4 1.1 6.3-5.7-3.1-5.7 3.1 1.1-6.3-4.6-4.4 6.4-.9z" fill="${preset.accentColor}" opacity="0.95" />
      `;
    default:
      return '';
  }
};

export const createAvatarLibraryDataUrl = (preset: AvatarLibraryPreset) => {
  const gradientId = `g-${preset.id}`;
  const escapedMonogram = preset.monogram.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${preset.topColor}" />
        <stop offset="100%" stop-color="${preset.bottomColor}" />
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="48" fill="url(#${gradientId})" />
    <circle cx="48" cy="48" r="43" fill="none" stroke="${preset.ringColor}" stroke-width="4" />
    ${renderAccessory(preset)}
    <circle cx="48" cy="56" r="18" fill="${preset.accentColor}" opacity="0.18" />
    <text x="48" y="62" font-family="Arial, sans-serif" font-weight="700" font-size="27" text-anchor="middle" fill="white">${escapedMonogram}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const AVATAR_LIBRARY = AVATAR_LIBRARY_PRESETS.map((preset) => ({
  ...preset,
  avatarUrl: createAvatarLibraryDataUrl(preset),
}));
