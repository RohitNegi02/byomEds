import { createOptimizedPicture } from '../../scripts/aem.js';
import { createFluidicPlayerModal } from '../course-overview/ui-components.js';
import { getAlmAccessToken } from '../../scripts/alm-token.js';

const i18n = window.alm.i18n;
/**
 * Fetch enrollment state for a learning object
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} - Enrollment state data
 */
async function fetchEnrollmentState(learningObjectId, instanceId) {
  try {
    const accessToken = getAlmAccessToken();
    if (!accessToken) {
      console.warn('No access token found');
      return null;
    }

    // Extract course ID from learningObjectId (format: course:12511145)
    const courseId = learningObjectId.split(':')[1];

    // Build enrollment ID (format: course:courseId_instanceId_userId)
    // We need to get userId from API or session
    const userId = sessionStorage.getItem('alm_user_id') || '28993374'; // Fallback user ID
    const enrollmentId = `${learningObjectId}_${instanceId}_${userId}`;

    const apiUrl = `https://learningmanager.adobe.com/primeapi/v2/enrollments/${enrollmentId}?omitDeprecated=true&access_token=${accessToken}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      // If 404, user is not enrolled yet
      if (response.status === 404) {
        return { state: 'NOT_ENROLLED', progressPercent: 0 };
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      state: data.data.attributes.state,
      progressPercent: data.data.attributes.progressPercent || 0,
      dateCompleted: data.data.attributes.dateCompleted,
      hasPassed: data.data.attributes.hasPassed,
    };
  } catch (error) {
    console.error('Error fetching enrollment state:', error);
    return null;
  }
}

/**
 * Determine button text based on enrollment state
 * @param {Object} enrollmentState - Enrollment state data
 * @returns {string} - Button text (START, CONTINUE, or REVISIT)
 */
function getButtonText(enrollmentState) {
  if (!enrollmentState || enrollmentState.state === 'NOT_ENROLLED') {
    return i18n.translations['alm.button.start'];
  }

  if (enrollmentState.state === 'COMPLETED') {
    return 'REVISIT';
  }

  if (enrollmentState.state === 'STARTED' || enrollmentState.progressPercent > 0) {
    return 'CONTINUE';
  }

  return i18n.translations['alm.button.start'];
}

/**
 * Format duration from seconds to readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., "10m", "1h 30m")
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '';
}

/**
 * Format date to readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date (e.g., "10 Jun")
 */
function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Parse API response and extract recommendation data
 * @param {Object} apiResponse - API response from recommendations endpoint
 * @returns {Object} - Object containing recommendations array and skill name
 */
function parseApiResponse(apiResponse) {
  const recommendations = [];
  let skillName = '';

  if (!apiResponse || !apiResponse.data || !apiResponse.included) {
    return { recommendations, skillName };
  }

  // Extract skill name from meta
  if (apiResponse.meta && apiResponse.meta.skillName) {
    skillName = apiResponse.meta.skillName;
  }

  // Create a map of learningObjects by ID for quick lookup
  const learningObjectsMap = new Map();
  apiResponse.included.forEach((item) => {
    if (item.type === 'learningObject') {
      learningObjectsMap.set(item.id, item);
    }
  });

  // Process each recommendation
  apiResponse.data.forEach((recommendation) => {
    if (recommendation.type !== 'recommendation') return;

    // Get the learningObject reference
    const loRef = recommendation.relationships?.learningObject?.data;
    if (!loRef) return;

    const learningObject = learningObjectsMap.get(loRef.id);
    if (!learningObject) return;

    const { attributes } = learningObject;
    const currentLocale = i18n?.currentLocale;
    const localizedMetadata = (currentLocale && attributes.localizedMetadata?.find((m) => m.locale === currentLocale))
      || attributes.localizedMetadata?.[0]
      || {};

    // Extract reason (label)
    const reason = i18n.translations['alm.recommendation.suggestedforyou'] || 'Suggested for you';

    // Get instance ID from relationships
    const instanceId = learningObject.relationships?.instances?.data?.[0]?.id || '';
    const instanceIdParts = instanceId.split('_');
    const shortInstanceId = instanceIdParts.length >= 2 ? instanceIdParts[1] : '';

    // Determine button text based on enrollment status or other logic
    // For now, using "EXPLORE" if no duration, "START" otherwise
    const buttonText = attributes.duration === 0 ? i18n.translations['alm.button.explore'] : i18n.translations['alm.button.start'];

    // Get rating badge
    const rating = attributes.rating?.averageRating || 0;
    const ratingsCount = attributes.rating?.ratingsCount || 0;
    const hasRating = ratingsCount > 0;

    const badge = {
      type: hasRating ? 'stars' : 'nr',
      rating,
      ratingsCount,
    };

    const cardData = {
      id: learningObject.id,
      instanceId: shortInstanceId,
      image: attributes.imageUrl || '',
      imageAlt: localizedMetadata.name || 'Course Image',
      badge,
      title: localizedMetadata.name || 'Untitled Course',
      date: formatDate(attributes.datePublished),
      author: attributes.authorNames?.[0] || '',
      duration: formatDuration(attributes.duration),
      label: reason,
      buttonText,
      buttonLink: '#', // Could be constructed based on loType and ID
      isBookmarked: attributes.isBookmarked || false,
    };

    recommendations.push(cardData);
  });

  return { recommendations, skillName };
}

/**
 * Fetch recommendations for a specific strip
 * @param {number} stripNumber - Strip number (1-based)
 * @returns {Promise<Object>} - Promise resolving to {skillGroup, stripCount}
 */
async function fetchRecommendationStrip(stripNumber) {
  try {
    const accessToken = getAlmAccessToken();

    if (!accessToken) {
      console.warn('No access token found in session storage');
      return null;
    }

    const apiUrl = `https://learningmanager.adobe.com/primeapi/v2/recommendations?filter.loTypes=course,learningProgram,certification,jobAid&include=learningObject.instances,learningObject.skills.skillLevel.skill&useCache=true&filter.ignoreEnhancedLP=false&enforcedFields[learningObject]=extensionOverrides&filter.recType=multi_skill_interest&strip=${stripNumber}&page[limit]=10&omitDeprecated=true&access_token=${accessToken}`;

    console.log(`Fetching strip ${stripNumber}:`, apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const result = parseApiResponse(data);
    const stripCount = data.meta?.stripCount || 1;

    console.log(`Strip ${stripNumber}: "${result.skillName}", ${result.recommendations.length} recommendations, stripCount: ${stripCount}`);

    if (result.recommendations.length > 0) {
      return {
        skillGroup: {
          skillName: result.skillName,
          recommendations: result.recommendations,
        },
        stripCount,
      };
    }

    return { skillGroup: null, stripCount };
  } catch (error) {
    console.error(`Error fetching strip ${stripNumber}:`, error);
    return null;
  }
}

/**
 * Creates a "Go To Catalog" card
 * @returns {HTMLElement} - The card element
 */
function createGoToCatalogCard() {
  const li = document.createElement('li');
  li.className = 'recommendation-card recommendation-card-goto';

  // Card link wrapper
  const link = document.createElement('a');
  link.href = '/browse-catalog'; // Update this URL as needed
  link.className = 'recommendation-goto-link';

  // Card body (no image for this card)
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'recommendation-goto-body';

  // Title
  const title = document.createElement('h3');
  title.className = 'recommendation-goto-title';
  title.textContent = i18n.translations['alm.recommendation.gotocatalog'];
  bodyDiv.appendChild(title);

  link.appendChild(bodyDiv);
  li.appendChild(link);

  return li;
}

/**
 * Enroll user in a learning object
 * @param {string} learningObjectId - Learning object ID (e.g., "course:12529814")
 * @param {string} instanceId - Instance ID (e.g., "13252082")
 * @returns {Promise<boolean>} - Success status
 */
async function enrollUser(learningObjectId, instanceId) {
  try {
    const accessToken = getAlmAccessToken();
    if (!accessToken) {
      console.error('No access token found');
      return false;
    }

    // Build the full instance ID format (e.g., "course:12529814_13252082")
    const loInstanceId = `${learningObjectId}_${instanceId}`;

    const apiUrl = `https://learningmanager.adobe.com/primeapi/v2/enrollments?loId=${learningObjectId}&loInstanceId=${loInstanceId}&omitDeprecated=true&access_token=${accessToken}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Enrollment failed: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error enrolling user:', error);
    return false;
  }
}

/**
 * Check if learning object is bookmarked
 * @param {string} learningObjectId - Learning object ID
 * @returns {Promise<boolean>} - Whether the LO is bookmarked
 */
async function checkBookmarkStatus(learningObjectId) {
  try {
    const accessToken = getAlmAccessToken();
    if (!accessToken) {
      return false;
    }

    const loDetails = await fetchLearningObjectDetails(learningObjectId);
    return loDetails?.attributes?.isBookmarked || false;
  } catch (error) {
    console.error('Error checking bookmark status:', error);
    return false;
  }
}

/**
 * Save (bookmark) a learning object
 * @param {string} learningObjectId - Learning object ID
 * @returns {Promise<boolean>} - Success status
 */
async function saveBookmark(learningObjectId) {
  try {
    const accessToken = getAlmAccessToken();
    if (!accessToken) {
      console.error('No access token found');
      return false;
    }

    const apiUrl = `https://learningmanager.adobe.com/primeapi/v2/learningObjects/${learningObjectId}/bookmark?omitDeprecated=true&access_token=${accessToken}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Save bookmark failed: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error saving bookmark:', error);
    return false;
  }
}

/**
 * Unsave (remove bookmark) a learning object
 * @param {string} learningObjectId - Learning object ID
 * @returns {Promise<boolean>} - Success status
 */
async function unsaveBookmark(learningObjectId) {
  try {
    const accessToken = getAlmAccessToken();
    if (!accessToken) {
      console.error('No access token found');
      return false;
    }

    const apiUrl = `https://learningmanager.adobe.com/primeapi/v2/learningObjects/${learningObjectId}/bookmark?omitDeprecated=true&access_token=${accessToken}`;

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Unsave bookmark failed: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error unsaving bookmark:', error);
    return false;
  }
}

/**
 * Update add button icon based on enrollment state
 * @param {HTMLElement} button - Add button element
 * @param {boolean} isEnrolled - Whether user is enrolled
 */
function updateAddButtonIcon(button, isEnrolled) {
  if (isEnrolled) {
    // Show checkmark icon
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#0D66D0" stroke-width="2" fill="#0D66D0"/>
        <path d="M8 12L11 15L16 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.disabled = true;
    button.style.opacity = '0.7';
    button.style.cursor = 'default';
  } else {
    // Show plus icon
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#0D66D0" stroke-width="2"/>
        <path d="M12 8V16M8 12H16" stroke="#0D66D0" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  }
}

/**
 * Show loading spinner in add button
 * @param {HTMLElement} button - Add button element
 */
function showAddButtonSpinner(button) {
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="#E0E0E0" stroke-width="2" fill="none"/>
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0D66D0" stroke-width="2" fill="none" stroke-linecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
      </path>
    </svg>
  `;
  button.disabled = true;
}

/**
 * Fetch learning object details including rating
 * @param {string} learningObjectId - Learning object ID
 * @returns {Promise<Object>} - Learning object data
 */
async function fetchLearningObjectDetails(learningObjectId) {
  try {
    const accessToken = getAlmAccessToken();
    if (!accessToken) {
      console.warn('No access token found');
      return null;
    }

    const apiUrl = `https://learningmanager.adobe.com/primeapi/v2/learningObjects/${learningObjectId}?include=instances&omitDeprecated=true&access_token=${accessToken}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching learning object details:', error);
    return null;
  }
}

/**
 * Update rating badge on a card
 * @param {HTMLElement} card - The card element
 * @param {Object} ratingData - Rating data {rating, ratingsCount}
 */
function updateCardRating(card, ratingData) {
  const badgeElement = card.querySelector('.recommendation-badge');
  if (!badgeElement) return;

  const hasRating = ratingData.ratingsCount > 0;

  // Clear existing content
  badgeElement.className = 'recommendation-badge';
  badgeElement.innerHTML = '';

  if (hasRating) {
    // Show stars
    badgeElement.classList.add('has-rating');

    // Create stars container
    const starsContainer = document.createElement('div');
    starsContainer.className = 'recommendation-stars';

    // Create 5 stars
    const ratingValue = Math.round(ratingData.rating);
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement('span');
      star.className = 'recommendation-star';
      if (i <= ratingValue) {
        star.classList.add('filled');
      }
      star.textContent = '★';
      starsContainer.appendChild(star);
    }

    badgeElement.appendChild(starsContainer);

    // Add rating count
    const ratingCount = document.createElement('span');
    ratingCount.className = 'recommendation-rating-count';
    ratingCount.textContent = ratingData.ratingsCount;
    badgeElement.appendChild(ratingCount);
  } else {
    // Show NR
    badgeElement.textContent = 'NR';
  }
}

/**
 * Update button text based on enrollment state
 * @param {HTMLElement} button - Action button element
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 */
async function updateButtonState(button, learningObjectId, instanceId) {
  if (!instanceId) return;

  const enrollmentState = await fetchEnrollmentState(learningObjectId, instanceId);
  if (enrollmentState) {
    const newButtonText = getButtonText(enrollmentState);
    button.textContent = newButtonText;
  }
}

/**
 * Update card after fluidic player closes (button state and rating)
 * @param {HTMLElement} card - The card element
 * @param {HTMLElement} button - Action button element
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 */
async function updateCardAfterPlayer(card, button, learningObjectId, instanceId) {
  // Update button state
  await updateButtonState(button, learningObjectId, instanceId);

  // Fetch and update rating
  const loDetails = await fetchLearningObjectDetails(learningObjectId);
  if (loDetails && loDetails.attributes && loDetails.attributes.rating) {
    const rating = loDetails.attributes.rating.averageRating || 0;
    const ratingsCount = loDetails.attributes.rating.ratingsCount || 0;
    updateCardRating(card, { rating, ratingsCount });
  }
}

/**
 * Create and show bookmark overlay
 * @param {HTMLElement} card - The card element
 * @param {string} learningObjectId - Learning object ID
 * @param {boolean} isBookmarked - Current bookmark status
 */
function showBookmarkOverlay(card, learningObjectId, isBookmarked) {
  // Remove any existing overlay
  const existingOverlay = document.querySelector('.bookmark-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'bookmark-overlay';

  // Create overlay content
  const overlayContent = document.createElement('div');
  overlayContent.className = 'bookmark-overlay-content';

  // Close button
  const closeButton = document.createElement('button');
  closeButton.className = 'bookmark-overlay-close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML = '✕';
  closeButton.addEventListener('click', () => {
    overlay.remove();
  });

  // Save/Unsave button
  const bookmarkButton = document.createElement('button');
  bookmarkButton.className = 'bookmark-button';

  const bookmarkIcon = document.createElement('span');
  bookmarkIcon.className = 'bookmark-icon';
  bookmarkIcon.innerHTML = isBookmarked ? '🔖' : '🔖';

  const bookmarkText = document.createElement('span');
  bookmarkText.className = 'bookmark-text';
  bookmarkText.textContent = isBookmarked ? i18n.translations['alm.button.unsave'] : i18n.translations['alm.button.save'];

  bookmarkButton.appendChild(bookmarkIcon);
  bookmarkButton.appendChild(bookmarkText);

  // Handle bookmark click
  bookmarkButton.addEventListener('click', async (e) => {
    // Prevent event from propagating to close overlay
    e.stopPropagation();

    // Disable button and show spinner
    bookmarkButton.disabled = true;
    const originalContent = bookmarkButton.innerHTML;
    bookmarkButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
        <circle cx="12" cy="12" r="10" stroke="#E0E0E0" stroke-width="2" fill="none"/>
        <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0D66D0" stroke-width="2" fill="none" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </path>
      </svg>
      <span style="margin-left: 8px;">Loading...</span>
    `;

    const success = isBookmarked
      ? await unsaveBookmark(learningObjectId)
      : await saveBookmark(learningObjectId);

    if (success) {
      // Update button state
      isBookmarked = !isBookmarked;

      // Update button content
      bookmarkButton.innerHTML = '';
      const newIcon = document.createElement('span');
      newIcon.className = 'bookmark-icon';
      newIcon.innerHTML = '🔖';
      const newText = document.createElement('span');
      newText.className = 'bookmark-text';
      newText.textContent = isBookmarked ? i18n.translations['alm.button.unsave'] : i18n.translations['alm.button.save'];
      bookmarkButton.appendChild(newIcon);
      bookmarkButton.appendChild(newText);
      bookmarkButton.disabled = false;

      // Update the more options button data attribute
      const moreOptionsBtn = card.querySelector('.more-options');
      if (moreOptionsBtn) {
        moreOptionsBtn.dataset.isBookmarked = isBookmarked;
      }
    } else {
      // Restore original content on error
      bookmarkButton.innerHTML = originalContent;
      bookmarkButton.disabled = false;
      alert(`Failed to ${isBookmarked ? 'unsave' : 'save'} the course. Please try again.`);
    }
  });

  overlayContent.appendChild(closeButton);
  overlayContent.appendChild(bookmarkButton);
  overlay.appendChild(overlayContent);

  // Prevent clicks inside overlay from bubbling
  overlayContent.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Position overlay relative to card
  card.style.position = 'relative';
  card.appendChild(overlay);

  // Close overlay when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeOverlay(e) {
      if (!overlayContent.contains(e.target) && !e.target.closest('.more-options')) {
        overlay.remove();
        document.removeEventListener('click', closeOverlay);
      }
    });
  }, 0);
}

/**
 * Update both action button and add button based on enrollment state
 * @param {HTMLElement} actionButton - Action button element
 * @param {HTMLElement} addButton - Add button element
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<boolean>} - Whether user is enrolled
 */
async function updateCardState(actionButton, addButton, learningObjectId, instanceId) {
  if (!instanceId) return false;

  const enrollmentState = await fetchEnrollmentState(learningObjectId, instanceId);
  const isEnrolled = enrollmentState && enrollmentState.state !== 'NOT_ENROLLED';

  if (enrollmentState) {
    // Update action button text
    const newButtonText = getButtonText(enrollmentState);
    actionButton.textContent = newButtonText;
  }

  // Update add button icon
  updateAddButtonIcon(addButton, isEnrolled);

  return isEnrolled;
}

/**
 * Creates a recommendation card element
 * @param {Object} cardData - Data for the card
 * @param {Function} refreshCallback - Callback to refresh the component
 * @returns {Object} - Object containing card element and action button
 */
function createRecommendationCard(cardData, refreshCallback) {
  const li = document.createElement('li');
  li.className = 'recommendation-card';

  // Card image
  const cardImage = document.createElement('div');
  cardImage.className = 'card-image';

  if (cardData.image) {
    const picture = createOptimizedPicture(cardData.image, cardData.imageAlt, false, [{ width: '400' }]);
    cardImage.appendChild(picture);
  } else {
    // Placeholder if no image
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="250"%3E%3Crect width="400" height="250" fill="%23e8e8e8"/%3E%3C/svg%3E';
    img.alt = cardData.imageAlt;
    cardImage.appendChild(img);
  }

  // Badge (NR - Not Rated or star rating)
  const badge = document.createElement('div');
  badge.className = 'recommendation-badge';

  if (cardData.badge && cardData.badge.type === 'stars') {
    // Has rating - show stars
    badge.classList.add('has-rating');

    // Create stars container
    const starsContainer = document.createElement('div');
    starsContainer.className = 'recommendation-stars';

    // Create 5 stars
    const ratingValue = Math.round(cardData.badge.rating); // Round to nearest whole number
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement('span');
      star.className = 'recommendation-star';
      if (i <= ratingValue) {
        star.classList.add('filled');
      }
      star.textContent = '★';
      starsContainer.appendChild(star);
    }

    badge.appendChild(starsContainer);

    // Add rating count
    const ratingCount = document.createElement('span');
    ratingCount.className = 'recommendation-rating-count';
    ratingCount.textContent = cardData.badge.ratingsCount;
    badge.appendChild(ratingCount);
  } else {
    // No rating - show NR
    badge.textContent = 'NR';
  }

  cardImage.appendChild(badge);

  // Card content
  const cardContent = document.createElement('div');
  cardContent.className = 'card-content';

  // Title row with add button
  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';

  const titleElement = document.createElement('h3');
  titleElement.className = 'card-title';
  titleElement.textContent = cardData.title;

  const addButton = document.createElement('button');
  addButton.className = 'add-button';
  addButton.setAttribute('aria-label', 'Add to list');
  addButton.dataset.learningObjectId = cardData.id;
  addButton.dataset.instanceId = cardData.instanceId;
  addButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="#0D66D0" stroke-width="2"/>
      <path d="M12 8V16M8 12H16" stroke="#0D66D0" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  // Add click handler for enrollment
  addButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { learningObjectId, instanceId } = addButton.dataset;

    if (!instanceId) {
      console.error('No instance ID found');
      return;
    }

    console.log('Enrolling in:', learningObjectId);

    // Show spinner
    showAddButtonSpinner(addButton);

    // Enroll user
    const success = await enrollUser(learningObjectId, instanceId);

    if (success) {
      console.log('Enrollment successful');
      // Update both buttons to reflect enrolled state
      await updateCardState(actionButton, addButton, learningObjectId, instanceId);
    } else {
      console.error('Enrollment failed');
      // Revert to plus icon
      updateAddButtonIcon(addButton, false);
      alert('Failed to enroll in the course. Please try again.');
    }
  });

  titleRow.appendChild(titleElement);
  titleRow.appendChild(addButton);

  // Metadata
  const cardMeta = document.createElement('div');
  cardMeta.className = 'card-meta';

  const metaParts = [];
  if (cardData.date) {
    metaParts.push(`<span class="date">${cardData.date}</span>`);
  }
  if (cardData.author) {
    metaParts.push(`<span class="author">${cardData.author}</span>`);
  }
  if (cardData.duration) {
    metaParts.push(`<span class="duration">${cardData.duration}</span>`);
  }

  cardMeta.innerHTML = metaParts.join('<span class="separator">•</span>');

  // Label
  const cardLabel = document.createElement('p');
  cardLabel.className = 'card-label';
  cardLabel.textContent = cardData.label;

  // Actions
  const cardActions = document.createElement('div');
  cardActions.className = 'card-actions';

  const actionButton = document.createElement('button');
  actionButton.className = 'action-button primary';
  actionButton.textContent = cardData.buttonText;
  actionButton.dataset.learningObjectId = cardData.id;
  actionButton.dataset.instanceId = cardData.instanceId;

  // Add click handler for launching fluidic player
  actionButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { learningObjectId, instanceId } = actionButton.dataset;
    const accessToken = getAlmAccessToken();

    if (!accessToken) {
      console.error('No access token found');
      alert('Please log in to continue');
      return;
    }

    if (!learningObjectId || !instanceId) {
      console.error('No learning object ID or instance ID found');
      return;
    }

    // Check enrollment status first
    const enrollmentState = await fetchEnrollmentState(learningObjectId, instanceId);
    const isEnrolled = enrollmentState && enrollmentState.state !== 'NOT_ENROLLED';

    // If not enrolled, enroll first
    if (!isEnrolled) {
      console.log('User not enrolled, enrolling first...');

      // Show spinner on add button
      showAddButtonSpinner(addButton);

      // Enroll user
      const enrollmentSuccess = await enrollUser(learningObjectId, instanceId);

      if (!enrollmentSuccess) {
        console.error('Enrollment failed');
        // Revert add button to plus icon
        updateAddButtonIcon(addButton, false);
        alert('Failed to enroll in the course. Please try again.');
        return;
      }

      console.log('Enrollment successful');
      // Update add button to checkmark
      updateAddButtonIcon(addButton, true);
      // Update action button text
      actionButton.textContent = 'CONTINUE';
    }

    console.log('Launching fluidic player for:', learningObjectId);

    // Build fluidic player URL
    const playerUrl = `https://learningmanager.adobe.com/app/player?lo_id=${learningObjectId}&access_token=${accessToken}&hostname=https://learningmanager.adobe.com&trapfocus=true`;

    // Launch fluidic player modal with refresh callback
    createFluidicPlayerModal(playerUrl, async () => {
      console.log('Fluidic player closed, updating card state and rating...');

      // Update both button state and rating after player closes
      await updateCardAfterPlayer(li, actionButton, learningObjectId, instanceId);

      // Call the main refresh callback if provided
      if (refreshCallback && typeof refreshCallback === 'function') {
        refreshCallback();
      }
    });
  });

  const moreOptions = document.createElement('button');
  moreOptions.className = 'more-options';
  moreOptions.setAttribute('aria-label', 'More options');
  moreOptions.textContent = '⋮';
  moreOptions.dataset.learningObjectId = cardData.id;
  moreOptions.dataset.isBookmarked = cardData.isBookmarked;

  // Add click handler for more options
  moreOptions.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { learningObjectId, isBookmarked } = moreOptions.dataset;

    // Show overlay with stored bookmark status
    showBookmarkOverlay(li, learningObjectId, isBookmarked === 'true');
  });

  cardActions.appendChild(actionButton);
  cardActions.appendChild(moreOptions);

  // Assemble content
  cardContent.appendChild(titleRow);
  cardContent.appendChild(cardMeta);
  cardContent.appendChild(cardLabel);
  cardContent.appendChild(cardActions);

  // Assemble card
  li.appendChild(cardImage);
  li.appendChild(cardContent);

  return { card: li, actionButton };
}

/**
 * Create a skill section with recommendations
 * @param {Object} skillGroup - Skill group data
 * @param {boolean} isFirst - Whether this is the first section
 * @returns {HTMLElement} - Skill section element
 */
function createSkillSection(skillGroup, isFirst = false) {
  const section = document.createElement('div');
  section.className = `skill-section${isFirst ? ' visible' : ''}`;

  const { skillName, recommendations } = skillGroup;

  // Create header with title and navigation
  const header = document.createElement('div');
  header.className = 'recommendations-header';

  const title = document.createElement('h2');
  title.textContent = `${i18n.translations['alm.recommendation.heading']} - ${skillName}`;
  header.appendChild(title);

  const navigationArrows = document.createElement('div');
  navigationArrows.className = 'navigation-arrows';

  const prevArrow = document.createElement('button');
  prevArrow.className = 'nav-arrow prev';
  prevArrow.setAttribute('aria-label', 'Previous');

  const nextArrow = document.createElement('button');
  nextArrow.className = 'nav-arrow next';
  nextArrow.setAttribute('aria-label', 'Next');

  navigationArrows.appendChild(prevArrow);
  navigationArrows.appendChild(nextArrow);
  header.appendChild(navigationArrows);

  // Create scroll container
  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'recommendations-scroll-container';

  // Create recommendations grid
  const grid = document.createElement('div');
  grid.className = 'recommendations-grid';

  // Store buttons for initial state updates
  const cardButtons = [];

  // Add recommendation cards
  recommendations.forEach((recommendation) => {
    const { card, actionButton } = createRecommendationCard(recommendation);
    grid.appendChild(card);

    const addButton = card.querySelector('.add-button');

    cardButtons.push({
      actionButton,
      addButton,
      learningObjectId: recommendation.id,
      instanceId: recommendation.instanceId,
    });
  });

  // Add "Go To Catalog" card
  const goToCatalogCard = createGoToCatalogCard();
  grid.appendChild(goToCatalogCard);

  // Fetch and update initial button states
  cardButtons.forEach(async ({ actionButton, addButton, learningObjectId, instanceId }) => {
    await updateCardState(actionButton, addButton, learningObjectId, instanceId);
  });

  scrollContainer.appendChild(grid);

  // Assemble section
  section.appendChild(header);
  section.appendChild(scrollContainer);

  // Set up scroll navigation
  const cardsPerPage = 3;
  const cardWidth = 400 + 24;
  const pageWidth = cardWidth * cardsPerPage;
  let currentPage = 0;
  const totalCards = recommendations.length + 1;
  const totalPages = Math.ceil(totalCards / cardsPerPage);

  const updatePaginationButtons = () => {
    prevArrow.disabled = currentPage === 0;
    nextArrow.disabled = currentPage >= totalPages - 1;
  };

  const scrollToPage = (page) => {
    const scrollPosition = page * pageWidth;
    scrollContainer.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });
    currentPage = page;
    updatePaginationButtons();
  };

  prevArrow.addEventListener('click', () => {
    if (currentPage > 0) {
      scrollToPage(currentPage - 1);
    }
  });

  nextArrow.addEventListener('click', () => {
    if (currentPage < totalPages - 1) {
      scrollToPage(currentPage + 1);
    }
  });

  scrollContainer.addEventListener('scroll', () => {
    const { scrollLeft } = scrollContainer;
    const newPage = Math.round(scrollLeft / pageWidth);
    if (newPage !== currentPage) {
      currentPage = newPage;
      updatePaginationButtons();
    }
  });

  updatePaginationButtons();

  return section;
}

/**
 * Main decoration function
 */
export default async function decorate(block) {
  // Show loading state
  block.innerHTML = '<div class="loading-state">Loading recommendations...</div>';

  // Try to find the first strip with data
  let firstValidStrip = null;
  let firstValidStripNumber = 0;
  let totalStripCount = 1;

  // Try fetching strips sequentially until we find one with data or hit a reasonable limit
  const maxStripsToCheck = 10; // Safety limit

  for (let i = 1; i <= maxStripsToCheck; i++) {
    console.log(`Checking strip ${i}...`);
    const stripData = await fetchRecommendationStrip(i);

    if (!stripData) {
      // API error, stop checking
      console.log(`Strip ${i} returned error, stopping`);
      break;
    }

    // Update stripCount from the response (should be same for all strips)
    if (stripData.stripCount) {
      totalStripCount = stripData.stripCount;
    }

    if (stripData.skillGroup) {
      // Found a strip with data
      firstValidStrip = stripData;
      firstValidStripNumber = i;
      console.log(`Found data in strip ${i}, stripCount: ${totalStripCount}`);
      break;
    } else {
      console.log(`Strip ${i} is empty, continuing...`);

      // If we've checked all strips based on stripCount, stop
      if (totalStripCount > 1 && i >= totalStripCount) {
        console.log(`Checked all ${totalStripCount} strips, none have data`);
        break;
      }
    }
  }

  // Clear the block
  block.innerHTML = '';

  if (!firstValidStrip?.skillGroup) {
    block.innerHTML = `<div class="error-state">${i18n.translations['alm.norecommendation']}</div>`;
    return;
  }

  // Create main container
  const container = document.createElement('div');
  container.className = 'recommendations-container';

  // Add first valid skill section
  const firstSection = createSkillSection(firstValidStrip.skillGroup, true);
  container.appendChild(firstSection);

  // Calculate remaining strips (excluding the one we already displayed)
  const remainingStripsCount = totalStripCount - firstValidStripNumber;

  // Add Show more button if there are more strips
  if (remainingStripsCount > 0) {
    const showMoreButton = document.createElement('button');
    showMoreButton.className = 'show-more-button';
    showMoreButton.textContent = i18n.translations['alm.recommendation.showmore'];

    showMoreButton.addEventListener('click', async () => {
      // Disable button and show loading state
      showMoreButton.disabled = true;
      showMoreButton.textContent = i18n.translations['alm.recommendation.loading'] + '...';

      // Fetch remaining strips (all strips after the first valid one)
      const stripPromises = [];
      for (let i = firstValidStripNumber + 1; i <= totalStripCount; i++) {
        stripPromises.push(fetchRecommendationStrip(i));
      }

      const remainingStrips = await Promise.all(stripPromises);

      // Add sections for remaining strips (only those with data)
      remainingStrips.forEach((stripData) => {
        if (stripData && stripData.skillGroup) {
          const section = createSkillSection(stripData.skillGroup, true);
          // Insert before the button
          container.insertBefore(section, showMoreButton);
        }
      });

      // Remove the Show more button
      showMoreButton.remove();
    });

    container.appendChild(showMoreButton);
  }

  // Replace block content
  block.appendChild(container);
}
