import { getAlmAccessToken } from '../../scripts/alm-token.js';

const { i18n } = window.alm;

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://learningmanager.adobe.com/primeapi/v2',
  headers: {
    Accept: 'application/vnd.api+json',
    Authorization: `oauth ${getAlmAccessToken()}`,
  },
};

// Search API function
async function searchLearningObjects(searchTerm, limit = 9, cursor = null) {
  try {
    const params = new URLSearchParams({
      'filter.loTypes': 'course,learningProgram,certification,jobAid',
      sort: 'relevance',
      'page[limit]': limit,
      include: 'model.instances.loResources.resources,model.instances.badge,model.supplementaryResources,model.enrollment.loResourceGrades,model.skills.skillLevel.skill',
      'filter.ignoreEnhancedLP': 'false',
      'enforcedFields[learningObject]': 'extensionOverrides',
      query: searchTerm,
      snippetType: 'courseName,courseOverview,courseDescription,moduleName,certificationName,certificationOverview,certificationDescription,jobAidName,jobAidDescription,lpName,lpDescription,lpOverview,embedLpName,embedLpDesc,embedLpOverview,skillName,skillDescription,note,badgeName,courseTag,moduleTag,jobAidTag,lpTag,certificationTag,embedLpTag,discussion',
      language: i18n.currentLocale || 'en-US',
    });

    if (cursor) {
      params.append('page[cursor]', cursor);
    }

    const url = `${API_CONFIG.baseUrl}/search?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching learning objects:', error);
    return { data: [], meta: { count: 0 }, links: {} };
  }
}

// Fetch learning objects from API
async function fetchLearningObjects(limit = 9, searchTerm = '', filters = {}, cursor = null) {
  try {
    const params = new URLSearchParams({
      include: 'instances.loResources.resources,instances.badge,supplementaryResources,enrollment.loResourceGrades,skills.skillLevel.skill,instances.loResources.resources.room',
      'page[limit]': limit,
      sort: '-date',
      'filter.ignoreEnhancedLP': 'false',
    });

    // Add cursor for pagination if provided
    if (cursor) {
      params.append('page[cursor]', cursor);
    }

    // Add search filter if provided
    if (searchTerm) {
      params.append('filter.search', searchTerm);
    }

    // Add type filters if provided
    if (filters.loTypes && filters.loTypes.length > 0) {
      params.append('filter.loTypes', filters.loTypes.join(','));
    }

    // Add skill filters if provided
    if (filters.skillNames && filters.skillNames.length > 0) {
      // Use the first skill for now, API might not support multiple skills
      params.append('filter.skillName', filters.skillNames[0]);
    }

    // Add tag filters if provided
    if (filters.tagNames && filters.tagNames.length > 0) {
      // Use the first tag for now, API might not support multiple tags
      params.append('filter.tagName', filters.tagNames[0]);
    }

    const url = `${API_CONFIG.baseUrl}/learningObjects?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching learning objects:', error);
    // Return fallback data in case of error
    return { data: [], meta: { count: 0 }, links: {} };
  }
}

// Fetch skill details from API
async function fetchSkillDetails(skillId) {
  try {
    const url = `${API_CONFIG.baseUrl}/skills/${skillId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching skill details:', error);
    return null;
  }
}

// Fetch available tags from API
async function fetchTags() {
  try {
    const url = `${API_CONFIG.baseUrl}/data?filter.tagName=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data.attributes.names || [];
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

// Fetch available skills from API
async function fetchSkills() {
  try {
    const url = `${API_CONFIG.baseUrl}/data?filter.skillName=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data.attributes.names || [];
  } catch (error) {
    console.error('Error fetching skills:', error);
    return [];
  }
}

// Fetch available catalogs from API
async function fetchCatalogs() {
  try {
    const url = `${API_CONFIG.baseUrl}/catalogs`;

    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching catalogs:', error);
    return [];
  }
}

// Cache for skill names to avoid repeated API calls
const skillCache = new Map();

// Get skill names for a learning object
async function getSkillNames(item) {
  if (!item.relationships || !item.relationships.skills || !item.relationships.skills.data) {
    return [i18n.translations['alm.catalog.general'] || 'General'];
  }

  const skillPromises = item.relationships.skills.data.map(async (skillRef) => {
    // Extract skill ID from the learningObjectSkill ID
    // Format is usually "course:id_skillId" or similar
    const skillIdMatch = skillRef.id.match(/_(\d+)$/);
    if (!skillIdMatch) return i18n.translations['alm.catalog.general'] || 'General';

    const skillId = skillIdMatch[1];

    // Check cache first
    if (skillCache.has(skillId)) {
      return skillCache.get(skillId);
    }

    // Fetch skill details
    const skillData = await fetchSkillDetails(skillId);
    if (skillData && skillData.attributes && skillData.attributes.name) {
      const skillName = skillData.attributes.name;
      skillCache.set(skillId, skillName);
      return skillName;
    }

    return i18n.translations['alm.catalog.general'] || 'General';
  });

  try {
    const generalLabel = i18n.translations['alm.catalog.general'] || 'General';
    const skillNames = await Promise.all(skillPromises);
    return skillNames.filter((name) => name !== generalLabel).slice(0, 2); // Show max 2 skills
  } catch (error) {
    console.error('Error getting skill names:', error);
    return [i18n.translations['alm.catalog.general'] || 'General'];
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return i18n.translations['alm.catalog.selfpaced'] || 'Self-paced';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getCardIcon(loFormat, loType) {
  const icons = {
    'Self Paced': '📚',
    'Virtual Classroom': '🎓',
    certification: '🏆',
    learningProgram: '📋',
    jobAid: '🔧',
  };

  return icons[loFormat] || icons[loType] || '📖';
}

function getCardClass(loFormat) {
  const formatMap = {
    'Self Paced': 'self-paced',
    'Virtual Classroom': 'virtual-classroom',
    Blended: 'self-paced',
  };

  return formatMap[loFormat] || 'self-paced';
}

function getEnrollmentStatus() {
  return i18n.translations['alm.catalog.complete'] || 'Complete';
}

async function createCourseCard(originalItem, includedData = []) {
  let currentItem = originalItem;
  let { attributes } = currentItem;

  // Handle search API response structure
  if (currentItem.type === 'searchResult' && currentItem.relationships?.model?.data) {
    const modelId = currentItem.relationships.model.data.id;
    const actualLO = includedData.find(
      (included) => included.id === modelId
        && included.type === 'learningObject',
    );

    if (actualLO) {
      attributes = actualLO.attributes;
      currentItem = actualLO;
    }
  }

  // Handle both regular API and search API response structures
  const { currentLocale } = i18n;
  const untitled = i18n.translations['alm.catalog.untitledcourse']
    || 'Untitled Course';
  const metadata = (currentLocale
    && attributes.localizedMetadata?.find(
      (m) => m.locale === currentLocale,
    ))
    || attributes.localizedMetadata?.[0]
    || { name: attributes.name || untitled, description: '', overview: '' };
  const cardClass = getCardClass(attributes.loFormat);
  const icon = getCardIcon(attributes.loFormat, attributes.loType);
  const duration = formatDuration(attributes.duration);
  const status = getEnrollmentStatus();

  // Get actual skill names
  const skillNames = await getSkillNames(currentItem);
  const generalLabel = i18n.translations['alm.catalog.general'] || 'General';
  const skillsText = skillNames.length > 0
    ? skillNames.join(', ') : generalLabel;

  const card = document.createElement('div');
  card.className = 'course-card';
  card.dataset.courseId = currentItem.id;

  // Check if course has an image
  const hasImage = attributes.imageUrl && attributes.imageUrl.trim() !== '';

  // Create card structure using createElement
  if (hasImage) {
    const cardImage = document.createElement('div');
    cardImage.className = 'card-image';

    const img = document.createElement('img');
    img.src = attributes.imageUrl;
    img.alt = metadata.name;
    img.loading = 'lazy';
    img.onerror = function () { this.style.display = 'none'; };

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    const typeBadge = document.createElement('div');
    typeBadge.className = 'card-type-badge';
    typeBadge.textContent = attributes.loFormat || 'Self Paced';

    overlay.appendChild(typeBadge);
    cardImage.appendChild(img);
    cardImage.appendChild(overlay);
    card.appendChild(cardImage);
  } else {
    const cardHeader = document.createElement('div');
    cardHeader.className = `card-header ${cardClass}`;

    const typeBadge = document.createElement('div');
    typeBadge.className = 'card-type-badge';
    typeBadge.textContent = attributes.loFormat || 'Self Paced';

    const cardIcon = document.createElement('div');
    cardIcon.className = 'card-icon';
    cardIcon.textContent = icon;

    cardHeader.appendChild(typeBadge);
    cardHeader.appendChild(cardIcon);
    card.appendChild(cardHeader);
  }

  // Card body
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';

  const cardTitle = document.createElement('h4');
  cardTitle.className = 'card-title';
  cardTitle.textContent = metadata.name;

  const cardType = document.createElement('div');
  cardType.className = 'card-type';
  cardType.textContent = attributes.loType;

  const cardFooter = document.createElement('div');
  cardFooter.className = 'card-footer';

  const cardSkills = document.createElement('div');
  cardSkills.className = 'card-skills';

  const skillIcon = document.createElement('span');
  skillIcon.textContent = '🎯';

  const skillText = document.createElement('span');
  skillText.textContent = `${i18n.translations['alm.catalog.skills'] || 'Skills'}: ${skillsText}`;

  cardSkills.appendChild(skillIcon);
  cardSkills.appendChild(skillText);
  cardFooter.appendChild(cardSkills);

  if (status) {
    const cardStatus = document.createElement('div');
    cardStatus.className = 'card-status status-complete';
    cardStatus.textContent = status;
    cardFooter.appendChild(cardStatus);
  }

  const cardDuration = document.createElement('div');
  cardDuration.className = 'card-duration';
  cardDuration.textContent = duration;

  cardBody.appendChild(cardTitle);
  cardBody.appendChild(cardType);
  cardBody.appendChild(cardFooter);
  cardBody.appendChild(cardDuration);
  card.appendChild(cardBody);

  // Add click handler
  card.addEventListener('click', () => {
    const courseId = currentItem.id.replace('course:', '');
    let instanceId = courseId;

    // Try to get the first instance ID from the course data
    const { instances } = currentItem.relationships || {};
    if (instances && instances.data && instances.data.length > 0) {
      const fullInstanceId = instances.data[0].id;
      instanceId = fullInstanceId
        .replace('course:', '').replace('_', '-');
    }

    // Construct the overview URL with proper path format
    const overviewUrl = `/overview/trainingId/${courseId}/trainingInstanceId/${instanceId}`;

    // Navigate to the overview page
    window.location.href = overviewUrl;
  });

  return card;
}

async function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'catalog-sidebar';

  // Fetch catalogs, tags and skills data
  const [catalogs, tags, skills] = await Promise.all([fetchCatalogs(), fetchTags(), fetchSkills()]);

  // Create catalog filter items
  const catalogFilterItems = catalogs.map((catalog) => {
    const locale = i18n.currentLocale;
    const locMeta = locale
      && catalog.attributes?.localizedMetadata?.find(
        (m) => m.locale === locale,
      );
    const catalogName = locMeta?.name
      || catalog.attributes?.localizedMetadata?.[0]?.name
      || catalog.attributes?.name
      || `Catalog ${catalog.id}`;
    const catalogId = `catalog-${catalog.id}`;

    return `
      <div class="filter-item">
        <input type="checkbox" id="${catalogId}" data-catalog="${catalog.id}">
        <label for="${catalogId}">${catalogName}</label>
      </div>
    `;
  }).join('');

  // Create tags filter items
  const tagsFilterItems = tags.map((tag) => `
    <div class="filter-item">
      <input type="checkbox" id="tag-${tag.toLowerCase().replace(/\s+/g, '-')}" data-tag="${tag}">
      <label for="tag-${tag.toLowerCase().replace(/\s+/g, '-')}">${tag}</label>
    </div>
  `).join('');

  // Create skills filter items
  const skillsFilterItems = skills.map((skill) => `
    <div class="filter-item">
      <input type="checkbox" id="skill-${skill.toLowerCase().replace(/\s+/g, '-')}" data-skill="${skill}">
      <label for="skill-${skill.toLowerCase().replace(/\s+/g, '-')}">${skill}</label>
    </div>
  `).join('');

  sidebar.innerHTML = `
    <div class="sidebar-section">
      <h3>${i18n.translations['alm.catalog.catalogs'] || 'Catalogs'}</h3>
      <div class="filter-group" id="catalogs-filter-group">
        ${catalogFilterItems || `<div class="filter-item">${i18n.translations['alm.catalog.nocatalogs'] || 'No catalogs available'}</div>`}
      </div>
    </div>

    <div class="sidebar-section">
      <h3>${i18n.translations['alm.catalog.type'] || 'Type'}</h3>
      <div class="filter-group">
        <div class="filter-item">
          <input type="checkbox" id="courses">
          <label for="courses">${i18n.translations['alm.catalog.courses'] || 'Courses'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="learning-paths">
          <label for="learning-paths">${i18n.translations['alm.catalog.learningpaths'] || 'Learning Paths'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="job-aids">
          <label for="job-aids">${i18n.translations['alm.catalog.jobaids'] || 'Job aids'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="certifications">
          <label for="certifications">${i18n.translations['alm.catalog.certifications'] || 'Certifications'}</label>
        </div>
      </div>
    </div>

    <div class="sidebar-section">
      <h3>${i18n.translations['alm.catalog.tags'] || 'Tags'}</h3>
      <div class="filter-group" id="tags-filter-group">
        ${tagsFilterItems || `<div class="filter-item">${i18n.translations['alm.catalog.notags'] || 'No tags available'}</div>`}
      </div>
    </div>

    <div class="sidebar-section">
      <h3>${i18n.translations['alm.catalog.skillsheading'] || 'Skills'}</h3>
      <div class="filter-group" id="skills-filter-group">
        ${skillsFilterItems || `<div class="filter-item">${i18n.translations['alm.catalog.noskills'] || 'No skills available'}</div>`}
      </div>
    </div>

    <div class="sidebar-section">
      <h3>${i18n.translations['alm.catalog.format'] || 'Format'}</h3>
      <div class="filter-group" id="format-filter-group">
        <div class="filter-item">
          <input type="checkbox" id="format-activity" data-format="Activity">
          <label for="format-activity">${i18n.translations['alm.catalog.activity'] || 'Activity'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-blended" data-format="Blended">
          <label for="format-blended">${i18n.translations['alm.catalog.blended'] || 'Blended'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-self-paced" data-format="Self Paced">
          <label for="format-self-paced">${i18n.translations['alm.catalog.selfpacedformat'] || 'Self Paced'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-virtual-classroom" data-format="Virtual Classroom">
          <label for="format-virtual-classroom">${i18n.translations['alm.catalog.virtualclassroom'] || 'Virtual Classroom'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-classroom" data-format="Classroom">
          <label for="format-classroom">${i18n.translations['alm.catalog.classroom'] || 'Classroom'}</label>
        </div>
      </div>
    </div>

    <div class="sidebar-section">
      <h3>${i18n.translations['alm.catalog.duration'] || 'Duration'}</h3>
      <div class="filter-group" id="duration-filter-group">
        <div class="filter-item">
          <input type="checkbox" id="duration-30-mins" data-duration="30-mins">
          <label for="duration-30-mins">${i18n.translations['alm.catalog.duration30mins'] || '30 mins or less'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="duration-30-mins-2-hours" data-duration="30-mins-2-hours">
          <label for="duration-30-mins-2-hours">${i18n.translations['alm.catalog.duration30to2hrs'] || '30 mins to 2 hours'}</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="duration-2-hours-plus" data-duration="2-hours-plus">
          <label for="duration-2-hours-plus">${i18n.translations['alm.catalog.duration2hrsplus'] || '2 hours+'}</label>
        </div>
      </div>
    </div>
  `;

  return sidebar;
}

function createHeader() {
  const header = document.createElement('div');
  header.className = 'catalog-header';

  header.innerHTML = `
    <h1 class="catalog-title">${i18n.translations['alm.catalog.title'] || 'Repository of Courses, Certifications and Learning Paths'}</h1>
    <div class="catalog-search">
      <input type="text" class="search-input" placeholder="${i18n.translations['alm.catalog.search'] || 'Search'}">
      <button class="filters-toggle">
        <span>${i18n.translations['alm.catalog.search'] || 'Search'}</span>
      </button>
    </div>
  `;

  return header;
}

export default async function decorate(block) {
  block.innerHTML = '';

  // Show loading state
  const loadingMsg = i18n.translations['alm.catalog.loading']
    || 'Loading courses...';
  block.innerHTML = `<div style="text-align: center; padding: 40px;">${loadingMsg}</div>`;

  // Create header
  const header = createHeader();

  // Create main content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'catalog-content';

  // Create sidebar (now async)
  const sidebar = await createSidebar();
  contentContainer.appendChild(sidebar);

  // Create main content area
  const mainContent = document.createElement('div');
  mainContent.className = 'catalog-main';

  // Create course grid
  const courseGrid = document.createElement('div');
  courseGrid.className = 'catalog-grid';

  // Create load more container
  const loadMoreContainer = document.createElement('div');
  loadMoreContainer.className = 'load-more-container';

  // Store current data and pagination state
  let allCourses = [];
  let nextCursor = null;
  let hasMoreData = false;
  let isLoading = false;
  const currentFilters = {
    searchTerm: '',
    loTypes: [
      'course', 'learningProgram', 'certification', 'jobAid',
    ],
  };

  // --- Filter helpers (defined before use) ---

  function getActiveTypeFilters() {
    const sel = '#courses, #learning-paths, #job-aids, #certifications';
    const typeCheckboxes = sidebar.querySelectorAll(sel);
    const activeTypes = [];
    const typeMap = {
      courses: 'course',
      'learning-paths': 'learningProgram',
      'job-aids': 'jobAid',
      certifications: 'certification',
    };

    typeCheckboxes.forEach((cb) => {
      if (cb.checked && typeMap[cb.id]) {
        activeTypes.push(typeMap[cb.id]);
      }
    });

    return activeTypes.length > 0
      ? activeTypes
      : ['course', 'learningProgram', 'certification', 'jobAid'];
  }

  function getActiveFormatFilters() {
    const sel = '#format-filter-group input[type="checkbox"]:checked';
    const cbs = sidebar.querySelectorAll(sel);
    const activeFormats = [];
    cbs.forEach((cb) => { activeFormats.push(cb.dataset.format); });
    return activeFormats;
  }

  function getActiveDurationFilters() {
    const sel = '#duration-filter-group input[type="checkbox"]:checked';
    const cbs = sidebar.querySelectorAll(sel);
    const activeDurations = [];
    cbs.forEach((cb) => { activeDurations.push(cb.dataset.duration); });
    return activeDurations;
  }

  function getActiveTagFilters() {
    const sel = '#tags-filter-group input[type="checkbox"]:checked';
    const cbs = sidebar.querySelectorAll(sel);
    const activeTags = [];
    cbs.forEach((cb) => { activeTags.push(cb.dataset.tag); });
    return activeTags;
  }

  function getActiveSkillFilters() {
    const sel = '#skills-filter-group input[type="checkbox"]:checked';
    const cbs = sidebar.querySelectorAll(sel);
    const activeSkills = [];
    cbs.forEach((cb) => { activeSkills.push(cb.dataset.skill); });
    return activeSkills;
  }

  function matchSkillInCache(courseSkillIds, activeSkills) {
    let found = false;
    courseSkillIds.some((skillId) => {
      if (skillCache.has(skillId)) {
        const name = skillCache.get(skillId);
        const nameLower = name.toLowerCase();
        const match = activeSkills.some(
          (s) => nameLower.includes(s.toLowerCase())
            || s.toLowerCase().includes(nameLower),
        );
        if (match) { found = true; }
      }
      return found;
    });
    return found;
  }

  function filterCoursesByClientSide(courses) {
    const activeFormats = getActiveFormatFilters();
    const activeDurations = getActiveDurationFilters();
    const activeTags = getActiveTagFilters();
    const activeSkills = getActiveSkillFilters();

    return courses.filter((course) => {
      const { attributes } = course;

      // Format filter
      if (activeFormats.length > 0) {
        const fmt = attributes.loFormat || 'Self Paced';
        if (!activeFormats.includes(fmt)) return false;
      }

      // Duration filter
      if (activeDurations.length > 0) {
        const mins = (attributes.duration || 0) / 60;
        let matchesDuration = false;
        activeDurations.forEach((d) => {
          switch (d) {
            case '30-mins':
              if (mins <= 30) matchesDuration = true;
              break;
            case '30-mins-2-hours':
              if (mins > 30 && mins <= 120) matchesDuration = true;
              break;
            case '2-hours-plus':
              if (mins > 120) matchesDuration = true;
              break;
            default:
              break;
          }
        });
        if (!matchesDuration) return false;
      }

      // Tags filter
      if (activeTags.length > 0) {
        const courseTags = attributes.tags || [];
        const hasTag = activeTags.some(
          (tag) => courseTags.some(
            (ct) => ct.toLowerCase().includes(tag.toLowerCase()),
          ),
        );
        if (!hasTag) return false;
      }

      // Skills filter
      if (activeSkills.length > 0) {
        let hasMatchingSkill = false;

        const skillsData = course.relationships
          && course.relationships.skills
          && course.relationships.skills.data;
        if (skillsData) {
          const ids = skillsData.map((ref) => {
            const m = ref.id.match(/_(\d+)$/);
            return m ? m[1] : null;
          }).filter((id) => id !== null);

          hasMatchingSkill = matchSkillInCache(ids, activeSkills);
        }

        if (!hasMatchingSkill) {
          const courseTags = attributes.tags || [];
          const loc = i18n.currentLocale;
          const meta = (loc
            && attributes.localizedMetadata?.find(
              (m) => m.locale === loc,
            ))
            || attributes.localizedMetadata?.[0];
          const cName = meta
            ? meta.name.toLowerCase() : '';
          const cDesc = meta
            ? (meta.description || '').toLowerCase() : '';

          hasMatchingSkill = activeSkills.some((sel) => {
            const sl = sel.toLowerCase();
            return courseTags.some(
              (tag) => tag.toLowerCase().includes(sl),
            ) || cName.includes(sl) || cDesc.includes(sl);
          });
        }

        if (!hasMatchingSkill) return false;
      }

      return true;
    });
  }

  // --- Render and data helpers ---

  function showError(message) {
    courseGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #d32f2f;">${message}</div>`;
  }

  async function renderCourses(
    courses,
    append = false,
    includedData = [],
  ) {
    if (!append) {
      courseGrid.innerHTML = '';
    }

    const filtered = filterCoursesByClientSide(courses);

    if (filtered.length === 0 && !append) {
      const msg = i18n.translations['alm.catalog.noresults']
        || 'No courses found matching your criteria.';
      courseGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">${msg}</div>`;
      return;
    }

    const cardPromises = filtered.map(
      (course) => createCourseCard(course, includedData),
    );
    const cards = await Promise.all(cardPromises);
    cards.forEach((card) => { courseGrid.appendChild(card); });
  }

  function updateLoadMoreButton() {
    loadMoreContainer.innerHTML = '';

    if (isLoading) {
      const msg = i18n.translations['alm.catalog.loadingmore']
        || 'Loading more courses...';
      loadMoreContainer.innerHTML = `<div class="loading-text">${msg}</div>`;
    } else if (hasMoreData) {
      const btn = document.createElement('button');
      btn.className = 'load-more-btn';
      btn.textContent = i18n.translations['alm.catalog.loadmore']
        || 'Load More';
      // eslint-disable-next-line no-use-before-define
      btn.addEventListener('click', loadMoreCourses);
      loadMoreContainer.appendChild(btn);
    }
  }

  async function loadCourses(resetData = true) {
    try {
      isLoading = true;
      updateLoadMoreButton();

      const cursor = resetData ? null : nextCursor;
      const data = await fetchLearningObjects(
        9,
        currentFilters.searchTerm,
        {
          loTypes: getActiveTypeFilters(),
          skillNames: getActiveSkillFilters(),
          tagNames: getActiveTagFilters(),
        },
        cursor,
      );

      const newCourses = data.data || [];

      if (resetData) {
        allCourses = newCourses;
        renderCourses(allCourses, false);
      } else {
        allCourses = [...allCourses, ...newCourses];
        renderCourses(newCourses, true);
      }

      nextCursor = null;
      hasMoreData = false;

      if (data.links && data.links.next) {
        const nextUrl = new URL(data.links.next);
        nextCursor = nextUrl.searchParams.get('page[cursor]');
        hasMoreData = true;
      }

      isLoading = false;
      updateLoadMoreButton();
    } catch (error) {
      console.error('Failed to load courses:', error);
      isLoading = false;
      if (resetData) {
        const msg = i18n.translations['alm.catalog.loaderror']
          || 'Failed to load courses. Please try again later.';
        showError(msg);
      }
      updateLoadMoreButton();
    }
  }

  async function loadMoreCourses() {
    if (!hasMoreData || isLoading) return;
    await loadCourses(false);
  }

  // Initial load
  await loadCourses(true);

  // Clear loading and add content
  block.innerHTML = '';
  block.appendChild(header);

  mainContent.appendChild(courseGrid);
  mainContent.appendChild(loadMoreContainer);
  contentContainer.appendChild(mainContent);
  block.appendChild(contentContainer);

  // Add search functionality with debouncing
  let searchTimeout;
  const searchInput = header.querySelector('.search-input');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      currentFilters.searchTerm = e.target.value;

      if (currentFilters.searchTerm.trim()) {
        try {
          isLoading = true;
          updateLoadMoreButton();

          const data = await searchLearningObjects(
            currentFilters.searchTerm,
            9,
          );
          const newCourses = data.data || [];

          allCourses = newCourses;
          await renderCourses(
            allCourses,
            false,
            data.included || [],
          );

          nextCursor = null;
          hasMoreData = false;
          if (data.links && data.links.next) {
            const nextUrl = new URL(data.links.next);
            nextCursor = nextUrl.searchParams.get('page[cursor]');
            hasMoreData = true;
          }

          isLoading = false;
          updateLoadMoreButton();
        } catch (error) {
          console.error('Search failed:', error);
          isLoading = false;
          const msg = i18n.translations['alm.catalog.searcherror']
            || 'Search failed. Please try again.';
          showError(msg);
        }
      } else {
        await loadCourses(true);
      }
    }, 500);
  });

  // Add filter functionality
  const filterCheckboxes = sidebar.querySelectorAll(
    'input[type="checkbox"]',
  );
  filterCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const serverFilters = [
        'courses', 'learning-paths', 'job-aids', 'certifications',
      ];
      const isServerFilter = serverFilters.includes(checkbox.id)
        || checkbox.dataset.skill
        || checkbox.dataset.tag
        || checkbox.dataset.catalog;

      if (isServerFilter) {
        await loadCourses(true);
      } else {
        await renderCourses(allCourses, false);
      }
    });
  });
}
