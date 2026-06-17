/**
 * Logo block
 * Displays a logo image with optional link.
 * Supports theme-based logo switching driven by the header theme switcher.
 *
 * Authoring (EDS):
 *   Add a link for the destination, then drop one icon per theme, e.g.
 *   :logo-light: :logo-dark: :logo-green: :logo-linkedin:
 *   The SVGs must live in the code repo's /icons/ folder (e.g. /icons/logo-linkedin.svg),
 *   because EDS icons always resolve to ${codeBasePath}/icons/<name>.svg.
 */

const THEMES = ['light', 'dark', 'green', 'linkedin'];

/**
 * Get current theme from the document root.
 * The header theme switcher sets data-theme on <html> (and removes it for light).
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Work out which theme a logo source belongs to from its icon name / filename.
 * e.g. "logo-linkedin" -> "linkedin", "logo-dark.svg" -> "dark".
 * Returns null when no theme keyword is present (treated as the default logo).
 */
function themeFromName(name) {
  const lower = (name || '').toLowerCase();
  return THEMES.find((theme) => lower.includes(theme)) || null;
}

/**
 * Parse logo variants from the authored block content.
 * Reads EDS icons (span.icon > img), <picture> images, and bare <img>.
 */
function parseLogoVariants(block) {
  const logoData = {
    href: '/',
    text: 'Logo',
    variants: {},
    hasVariants: false,
  };

  // Destination + accessible label come from the first link.
  const link = block.querySelector('a');
  if (link) {
    logoData.href = link.getAttribute('href') || link.href || '/';
    const linkText = link.textContent.trim();
    if (linkText) logoData.text = linkText;
  }

  // Collect every candidate logo image in the block.
  const images = block.querySelectorAll('img');
  images.forEach((img) => {
    const src = img.getAttribute('src') || img.src;
    if (!src) return;

    // Icon name (from EDS decoration) is most reliable; fall back to the filename.
    const iconName = img.dataset.iconName
      || src.split('/').pop().replace(/\.[a-z0-9]+$/i, '');
    const theme = themeFromName(iconName);

    if (theme) {
      logoData.variants[theme] = src;
      logoData.hasVariants = true;
    } else if (!logoData.variants.default) {
      logoData.variants.default = src;
    }
  });

  return logoData;
}

/**
 * Render / update the logo for the current theme.
 */
function updateLogo(container, logoData) {
  const currentTheme = getCurrentTheme();
  const logoSrc = logoData.variants[currentTheme]
    || logoData.variants.default
    || logoData.variants.light;

  if (logoSrc) {
    let img = container.querySelector('.logo-image');
    if (!img) {
      container.innerHTML = '';
      img = document.createElement('img');
      img.className = 'logo-image';
      container.appendChild(img);
    }
    img.src = logoSrc;
    img.alt = logoData.text || 'Logo';
    return;
  }

  // No image available: fall back to text.
  if (!container.querySelector('.logo-text')) {
    container.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'logo-text';
    span.textContent = logoData.text;
    container.appendChild(span);
  }
}

export default function decorate(block) {
  const logoData = parseLogoVariants(block);

  block.innerHTML = '';

  const logoLink = document.createElement('a');
  logoLink.href = logoData.href;
  logoLink.className = 'logo-link';
  logoLink.setAttribute('aria-label', logoData.text || 'Home');

  const logoContent = document.createElement('div');
  logoContent.className = 'logo-content';

  logoLink.appendChild(logoContent);
  block.appendChild(logoLink);

  updateLogo(logoContent, logoData);

  // Re-render when the header theme switcher fires a theme change.
  if (logoData.hasVariants) {
    window.addEventListener('themechange', () => updateLogo(logoContent, logoData));
  }
}
