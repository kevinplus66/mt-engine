/* ============================================================================
   MT-Engine - Language Component
   Language toggle functionality (Chinese/English)
   ============================================================================ */

import { getCurrentLang, setLanguage, updatePageLanguage } from '../i18n.js';

export function initLanguage() {
    // Apply saved language to page
    updatePageLanguage();
    // Update language button
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
