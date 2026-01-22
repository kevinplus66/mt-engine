/* ============================================================================
   MT-Engine - Theme Component
   Dark/Light theme toggle functionality
   ============================================================================ */

export let currentTheme = localStorage.getItem('theme') || 'dark';

export function initTheme() {
    // Set initial theme
    currentTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
}

export function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    }
}
