/**
 * Logo block
 * Displays a logo image with optional link
 */
export default function decorate(block) {
  const link = block.querySelector('a');
  const picture = block.querySelector('picture');
  
  if (!link && !picture) {
    // If no content, show default text
    block.textContent = 'Logo';
    return;
  }

  // Clear block
  block.innerHTML = '';

  // Create logo container
  const logoContainer = document.createElement('div');
  logoContainer.className = 'logo-container';

  if (link) {
    // If there's a link, wrap everything in it
    const logoLink = document.createElement('a');
    logoLink.href = link.href;
    logoLink.className = 'logo-link';
    logoLink.setAttribute('aria-label', link.textContent || 'Home');

    if (picture) {
      // Add picture to link
      const img = picture.querySelector('img');
      if (img) {
        img.alt = img.alt || 'Logo';
        img.className = 'logo-image';
      }
      logoLink.appendChild(picture);
    } else {
      // Use link text
      const logoText = document.createElement('span');
      logoText.className = 'logo-text';
      logoText.textContent = link.textContent;
      logoLink.appendChild(logoText);
    }

    logoContainer.appendChild(logoLink);
  } else if (picture) {
    // Just picture, no link
    const img = picture.querySelector('img');
    if (img) {
      img.alt = img.alt || 'Logo';
      img.className = 'logo-image';
    }
    logoContainer.appendChild(picture);
  }

  block.appendChild(logoContainer);
}
