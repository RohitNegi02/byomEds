// UI Components for Course Overview
// Handles HTML generation and UI component creation

const { i18n } = window.alm;

// Format duration helper
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return i18n.translations['alm.overview.selfpacedduration'] || 'Self-paced';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Extract course ID from URL
function getCourseIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  const trainingIdIndex = pathParts.indexOf('trainingId');
  if (trainingIdIndex !== -1 && pathParts[trainingIdIndex + 1]) {
    return `course:${pathParts[trainingIdIndex + 1]}`;
  }
  return null;
}

// Extract data from CDN HTML
function extractDataFromCDN(block) {
  const courseTitle = document.querySelector('meta[name="course-title"]')?.content || (i18n.translations['alm.overview.coursetitle'] || 'Course Title');
  const courseFormat = block.querySelector('p')?.textContent || (i18n.translations['alm.overview.blended'] || 'Blended');
  const courseDescription = document.querySelector('meta[name="richTextOverview"]')?.content
                           || document.querySelector('meta[name="description"]')?.content
                           || (i18n.translations['alm.overview.coursedescription'] || 'Course description');

  // Extract modules from the basic HTML structure
  const modules = [];
  const h4Elements = block.querySelectorAll('h4');

  h4Elements.forEach((h4, index) => {
    const moduleTitle = h4.textContent;

    // Find the next elements after h4 to get duration and format
    let nextElement = h4.nextElementSibling;
    let duration = 'N/A';
    let format = 'SELF PACED';
    let icon = '📖';

    // Look for duration in the next few elements
    while (nextElement && nextElement.tagName === 'P') {
      const text = nextElement.textContent.trim();
      if (text.match(/^\d+m$/) || text === 'N/A') {
        duration = text;
        break;
      } else if (text === 'SELF PACED') {
        format = text;
      } else if (text.match(/^[📄🔧✓]$/u) || text === '▶️') {
        icon = text;
      }
      nextElement = nextElement.nextElementSibling;
    }

    modules.push({
      id: `module-${index}`,
      resourceId: `course:14401139_15111973_${19943287 + index}_0`,
      title: moduleTitle,
      duration,
      format,
      icon,
    });
  });

  // Extract skills
  const skillsSection = Array.from(block.querySelectorAll('h3')).find((h3) => h3.textContent.includes('Skills covered'));
  const skills = [];
  if (skillsSection) {
    let nextElement = skillsSection.nextElementSibling;
    while (nextElement && nextElement.tagName === 'P') {
      skills.push(nextElement.textContent);
      nextElement = nextElement.nextElementSibling;
    }
  }

  return {
    courseTitle,
    courseFormat,
    courseDescription,
    modules,
    skills,
  };
}

// Enrich CDN data with locale-aware API localizedMetadata
function enrichWithLocalizedMetadata(cdnData, learnerData) {
  if (!learnerData || !learnerData.data
    || !learnerData.data.attributes) {
    return cdnData;
  }

  const { currentLocale } = i18n;
  const { attributes } = learnerData.data;
  const locMeta = (currentLocale
    && attributes.localizedMetadata?.find(
      (m) => m.locale === currentLocale,
    ))
    || attributes.localizedMetadata?.[0];

  if (!locMeta) return cdnData;

  return {
    ...cdnData,
    courseTitle: locMeta.name || cdnData.courseTitle,
    courseDescription: locMeta.richTextOverview
      || locMeta.overview
      || locMeta.description
      || cdnData.courseDescription,
  };
}

// Create and show fluidic player modal
function createFluidicPlayerModal(playerUrl, onCloseCallback) {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'fluidic-modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'fluidic-modal-content';
  modalContent.style.cssText = `
    width: 100%;
    height: 100%;
    background-color: white;
    position: relative;
    overflow: hidden;
  `;

  // Create iframe for fluidic player
  const iframe = document.createElement('iframe');
  iframe.src = playerUrl;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;

  // Helper function to close modal and trigger callback
  const closeModal = () => {
    if (document.body.contains(modalOverlay)) {
      document.body.removeChild(modalOverlay);
      // Call the callback function if provided
      if (onCloseCallback && typeof onCloseCallback === 'function') {
        onCloseCallback();
      }
    }
  };

  // Add event listeners
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Listen for messages from the iframe to close modal
  window.addEventListener('message', (event) => {
    if (event.data === 'status:close') {
      // Handle closing event from Adobe Learning Manager player
      closeModal();
    }
  });

  // Assemble modal
  modalContent.appendChild(iframe);
  modalOverlay.appendChild(modalContent);

  // Add to document
  document.body.appendChild(modalOverlay);
}

// Export functions
export {
  formatDuration,
  getCourseIdFromUrl,
  extractDataFromCDN,
  enrichWithLocalizedMetadata,
  createFluidicPlayerModal,
};
