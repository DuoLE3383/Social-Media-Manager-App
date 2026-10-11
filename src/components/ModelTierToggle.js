import React from 'react';
import { TIERS, setModelTier } from '../lib/modelTier';

export default function ModelTierToggle({ value, onChange, disabled = false, defaultModel, premiumModel }) {
  const options = [
    { ...TIERS.default, model: defaultModel || 'qwen2.5:3b', sublabel: defaultModel || 'qwen2.5:3b' },
    { ...TIERS.premium, model: premiumModel, sublabel: premiumModel || 'Chưa cấu hình' },
  ];

  const selectTier = (tier) => {
    if (disabled || (tier === 'premium' && !premiumModel) || tier === value) return;
    setModelTier(tier);
    onChange?.(tier);
  };

  return (
    <div className="tier-toggle" role="radiogroup" aria-label="Chọn model">
      {options.map((option) => {
        const active = option.id === value;
        const unavailable = option.id === 'premium' && !premiumModel;
        return (
          <button key={option.id} type="button" role="radio" aria-checked={active} disabled={disabled || unavailable}
            onClick={() => selectTier(option.id)} className={`tier-btn ${active ? 'tier-btn--active' : ''}`}
            title={unavailable ? 'Set LLM_MODEL_PREMIUM in the server .env' : option.description}>
            <span className="tier-btn__label">{option.label}</span>
            <span className="tier-btn__sub">{option.sublabel}</span>
          </button>
        );
      })}
    </div>
  );
}
