/**
 * Logo block
 * Displays a logo image with optional link
 * Supports theme-based logo switching
 */

/**
 * Get current theme from document root
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Parse logo variants from block content
 * Format: [Logo Text|/logo-light.svg|/logo-dark.svg|/logo-green.svg|/logo-linkedin.svg](/home)
 */
function parseLogoVariants(block) {
  const links = block.querySelectorAll('a');
  const logoData = {
    href: '/',
    text: 'Logo',
    variants: {},
    hasVariants: false
  };

  if (links.length === 0) return logoData;

  const mainLink = links[0];
  logoData.href = mainLink.href;
  
  // Check if link text contains pipe-separated variants
  const linkText = mainLink.textContent.trim();
  if (linkText.includes('|')) {
    const parts = linkText.split('|').map(p => p.trim());
    logoData.text = parts[0];
    
    // Map variants: light, dark, green, linkedin
    const themeOrder = ['light', 'dark', 'green', 'linkedin'];
    parts.slice(1).forEach((variant, index) => {
      if (variant && themeOrder[index]) {
        logoData.variants[themeOrder[index]] = variant;
        logoData.hasVariants = true;
      }
    });
  } else {
    logoData.text = linkText;
  }

  // Check for images
  const pictures = block.querySelectorAll('picture');
  if (pictures.length > 0) {
    pictures.forEach((picture, index) => {
      const img = picture.querySelector('img');
      if (img && img.src) {
        const themeOrder = ['light', 'dark', 'green', 'linkedin'];
        if (index === 0 && !logoData.hasVariants) {
          // Single image, use for all themes
          logoData.variants.default = img.src;
        } else if (themeOrder[index]) {
          // Multiple images, map to themes
          logoData.variants[themeOrder[index]] = img.src;
          logoData.hasVariants = true;
        }
      }
    });
  }

  return logoData;
}

/**
 * Update logo based on current theme
 */
function updateLogo(container, logoData) {
  const currentTheme = getCurrentTheme();
  const logoSrc = logoData.variants[currentTheme] || logoData.variants.default || logoData.variants.light;

  if (logoSrc) {
    // Image logo
    const existingImg = container.querySelector('.logo-image');
    if (existingImg) {
      existingImg.src = logoSrc;
    } else {
      const img = document.createElement('img');
      img.src = logoSrc;
      img.alt = logoData.text || 'Logo';
      img.className = 'logo-image';
      container.innerHTML = '';
      container.appendChild(img);
    }
  } else {
    // Text logo
    const existingText = container.querySelector('.logo-text');
    if (!existingText) {
      container.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'logo-text';
      span.textContent = logoData.text;
      container.appendChild(span);
    }
  }
}

export default function decorate(block) {
  const logoData = parseLogoVariants(block);

  // Clear block
  block.innerHTML = '';

  // Create logo link
  const logoLink = document.createElement('a');
  logoLink.href = logoData.href;
  logoLink.className = 'logo-link';
  logoLink.setAttribute('aria-label', logoData.text || 'Home');

  // Create container for logo content
  const logoContent = document.createElement('div');
  logoContent.className = 'logo-content';

  logoLink.appendChild(logoContent);
  block.appendChild(logoLink);

  // Set initial logo
  updateLogo(logoContent, logoData);

  // Listen for theme changes
  if (logoData.hasVariants) {
    window.addEventListener('themechange', () => {
      updateLogo(logoContent, logoData);
    });
  }
}
