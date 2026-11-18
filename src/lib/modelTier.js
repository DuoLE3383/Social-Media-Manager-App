const KEY = 'ss.modelTier';

export const TIERS = {
  default: { id: 'default', label: 'Nhanh', description: 'Phù hợp để iterate nhanh và tạo draft đầu tiên.' },
  premium: { id: 'premium', label: 'Chất lượng', description: 'Dùng khi cần output cuối cùng, kỹ hơn.' },
};

export function getModelTier() {
  try { return localStorage.getItem(KEY) === 'premium' ? 'premium' : 'default'; }
  catch { return 'default'; }
}

export function setModelTier(tier) {
  try { localStorage.setItem(KEY, tier === 'premium' ? 'premium' : 'default'); }
  catch { /* Preference storage is optional. */ }
}
