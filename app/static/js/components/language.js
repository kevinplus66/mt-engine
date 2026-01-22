/* ============================================================================
   MT-Engine - Language Component
   Language toggle functionality (Chinese/English)
   ============================================================================ */

import { getCurrentLang, setLanguage, updatePageLanguage } from '../i18n.js';

export function initLanguage() {
    // Update UI based on current language
    updateLanguageButton();
}

export function toggleLanguage() {
    const newLang = getCurrentLang() === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
    updateLanguageButton();
}

function updateLanguageButton() {
    const btn = document.getElementById('langToggle');
    if (btn) {
        btn.textContent = getCurrentLang() === 'zh' ? 'EN' : '中文';
    }
}
