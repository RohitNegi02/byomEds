// HTML Generator for Course Overview
// Handles HTML template generation for different states

const { i18n } = window.alm;

// Generate enrolled user HTML layout
function generateEnrolledHTML(
  data,
  courseId,
  learnerData,
  authorNames,
  skillsHtml,
  enrollmentInfo,
  processedModules,
  testoutModules = [],
  hasNotes = false,
) {
  const { progressPercent, completedModules, moduleResources } = enrollmentInfo;

  // Determine which tabs to show
  const hasTestoutModules = testoutModules && testoutModules.length > 0;

  // Generate tabs HTML conditionally
  const t = i18n.translations;
  let tabsHTML = '';
  if (hasTestoutModules || hasNotes) {
    tabsHTML = `
      <!-- Tabs Section -->
      <div class="course-tabs">
        <button class="tab-button active">${t['alm.overview.module'] || 'Module'}</button>
        ${hasTestoutModules ? `<button class="tab-button">${t['alm.overview.testout'] || 'Testout'}</button>` : ''}
        ${hasNotes ? `<button class="tab-button">${t['alm.overview.notes'] || 'Notes'}</button>` : ''}
      </div>
    `;
  }

  return `
    <!-- Course Header with Progress -->
    <div class="course-header enrolled-header">
      <div class="course-header-content">
        <h1 class="course-title">${data.courseTitle}</h1>
        <div class="course-format">${data.courseFormat}</div>
        <div class="progress-section">
          <span class="progress-label">${t['alm.overview.progress'] || 'Progress'}:</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <span class="progress-text">${progressPercent}%</span>
        </div>
      </div>
      <button class="share-btn">🔗 ${t['alm.overview.share'] || 'Share'}</button>
    </div>

    <!-- Course Description -->
    <div class="course-overview-section">
      <p class="course-description">${data.courseDescription}</p>
    </div>

    ${tabsHTML}

    <!-- Main Content -->
    <div class="course-main-content enrolled-layout">
      <!-- Left Content -->
      <div class="course-left-content">
        <div class="course-section modules-section">
          <h3 class="content-title">
            ${t['alm.overview.corecontent'] || 'Core Content'}
            <span class="duration-badge">${Math.floor(learnerData.data.attributes.duration / 60)} ${t['alm.overview.mins'] || 'mins'} ${learnerData.data.attributes.duration % 60} ${t['alm.overview.secs'] || 'secs'}</span>
          </h3>
          <div class="modules-list" data-modules-container="enrolled">
          </div>


        </div>
      </div>

      <!-- Learner Sidebar -->
      <div class="learner-sidebar enrolled-sidebar">
        <div class="sidebar-actions">
          <button class="start-btn">${t['alm.overview.start'] || 'Start'}</button>
          <button class="save-btn">🔖 ${t['alm.overview.save'] || 'Save'}</button>
        </div>

        <!-- Rating Section -->
        <div class="sidebar-section">
          <div class="rating-section">
            <h4>${t['alm.overview.ratecourse'] || 'Rate this Course'}</h4>
            <div class="star-rating">
              ${Array.from({ length: 5 }, (_, idx) => {
    const starIndex = idx + 1;
    const isSelected = starIndex <= enrollmentInfo.currentRating;
    return `<span class="star" data-rating="${starIndex}">${isSelected ? '⭐' : '☆'}</span>`;
  }).join('')}
              <button class="submit-rating">${t['alm.overview.submit'] || 'Submit'}</button>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="instance-details">
            <h4>📋 ${t['alm.overview.instancedetails'] || 'Instance details'}</h4>
            <p>${t['alm.overview.defaultinstance'] || 'Default Instance'}</p>
            <a href="#" class="view-instances">${t['alm.overview.viewallinstances'] || 'View All Instances'}</a>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="progress-info">
            <h4>${completedModules}/${moduleResources.length} ${t['alm.overview.corecontentcompleted'] || 'Core Content Completed'}</h4>
          </div>
        </div>

        <!-- Badges Section -->
        <div class="sidebar-section">
          <div class="badges-section">
            <h4>🏆 ${t['alm.overview.badges'] || 'Badges'}</h4>
            <div class="badge-item">
              <img src="https://cpcontents.adobe.com/public/account/121816/accountassets/121816/badges/1f250de126e649e2b5dfb0434e0702b3/badge_hero.png"
                   alt="Hero Badge" class="badge-icon">
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="skills-covered">
            <h4>✈️ ${t['alm.overview.skillscovered'] || 'Skills covered'}</h4>
            <div class="skills-list">
              <p>${skillsHtml || (t['alm.overview.noskills'] || 'No skills specified')}</p>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="author-info">
            <h4>${t['alm.overview.authors'] || 'Author(s)'}</h4>
            <div class="author-item">
              <div class="author-avatar">👤</div>
              <span class="author-name">${authorNames}</span>
            </div>
          </div>
        </div>

        <!-- Unenroll Button - Only show if enrolled and unenrollment is allowed -->
        ${enrollmentInfo.unenrollmentAllowed ? `
        <div class="sidebar-section">
          <button class="unenroll-btn" data-course-id="${courseId}">${t['alm.overview.unenroll'] || 'Unenroll from Course'}</button>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Generate non-enrolled user HTML layout
function generateNonEnrolledHTML(data, courseId, authorNames) {
  const t = i18n.translations;
  const enrollButtonText = t['alm.overview.enroll'] || 'Enroll';
  const saveButtonClass = 'save-btn disabled';
  const progressText = t['alm.overview.enrollments'] || '0 enrollment(s)';

  return `
    <!-- Course Header -->
    <div class="course-header">
      <div class="course-header-content">
        <h1 class="course-title">${data.courseTitle}</h1>
        <div class="course-format">${data.courseFormat}</div>
      </div>
      <button class="share-btn">🔗 ${t['alm.overview.share'] || 'Share'}</button>
    </div>

    <!-- Course Description -->
    <div class="course-overview-section">
      <p class="course-description">${data.courseDescription}</p>
    </div>

    <!-- Main Content -->
    <div class="course-main-content">
      <!-- Left Content -->
      <div class="course-left-content">
        <div class="course-section modules-section">
          <h3 class="content-title">
            ${t['alm.overview.corecontent'] || 'Core Content'}
            <span class="duration-badge">41m</span>
          </h3>
          <div class="modules-list" data-modules-container="non-enrolled">
          </div>
        </div>
      </div>

      <!-- Learner Sidebar -->
      <div class="learner-sidebar">
        <div class="sidebar-actions">
          <button class="enroll-btn" data-course-id="${courseId}">${enrollButtonText}</button>
          <button class="${saveButtonClass}">🔖 ${t['alm.overview.save'] || 'Save'}</button>
        </div>

        <div class="sidebar-section">
          <div class="instance-details">
            <h4>📋 ${t['alm.overview.instancedetails'] || 'Instance details'}</h4>
            <p>${t['alm.overview.defaultinstance'] || 'Default Instance'}</p>
            <a href="#" class="view-instances">${t['alm.overview.viewallinstances'] || 'View All Instances'}</a>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="enrollment-info">
            <h4>👥 ${progressText}</h4>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="skills-covered">
            <h4>✈️ ${t['alm.overview.skillscovered'] || 'Skills covered'}</h4>
            <div class="skills-list">
              <p>${data.skillsHtml || (t['alm.overview.noskills'] || 'No skills specified')}</p>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="author-info">
            <h4>${t['alm.overview.authors'] || 'Author(s)'}</h4>
            <div class="author-item">
              <div class="author-avatar">👤</div>
              <span class="author-name">${authorNames}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Main HTML generation function
function createCourseOverviewHTML(
  data,
  courseId,
  learnerData,
  authorNames,
  skillsHtml,
  enrollmentInfo,
  processedModules,
  testoutModules = [],
  hasNotes = false,
) {
  if (enrollmentInfo.isEnrolled) {
    return generateEnrolledHTML(
      data,
      courseId,
      learnerData,
      authorNames,
      skillsHtml,
      enrollmentInfo,
      processedModules,
      testoutModules,
      hasNotes,
    );
  }
  return generateNonEnrolledHTML(data, courseId, authorNames);
}

// Generate notes content HTML with module segregation
function generateNotesHTML(notesData, courseTitle, processedModules = []) {
  if (!notesData || !notesData.data || notesData.data.length === 0) {
    return `
      <div class="notes-content">
        <div class="notes-header">
          <h3 class="content-title">${courseTitle}</h3>
        </div>
        <div class="no-notes">
          <p>${i18n.translations['alm.overview.nonotes'] || 'No notes available for this course.'}</p>
        </div>
      </div>
    `;
  }

  const notes = notesData.data;

  // Group notes by module (loResource)
  const notesByModule = {};

  notes.forEach((note) => {
    // Get module/resource ID from relationships
    const resourceId = note.relationships?.loResource?.data?.id || 'unknown';

    if (!notesByModule[resourceId]) {
      notesByModule[resourceId] = [];
    }
    notesByModule[resourceId].push(note);
  });

  // Create a lookup map for module names
  const moduleNameMap = {};
  processedModules.forEach((module) => {
    moduleNameMap[module.id] = module.name;
  });

  // Generate HTML for each module section
  const moduleNotesHTML = Object.entries(notesByModule).map(([resourceId, moduleNotes]) => {
    // Get the actual module name from the processed modules data
    const moduleName = moduleNameMap[resourceId] || `Module ${resourceId.split('_')[1] || resourceId}`;

    return `
      <div class="module-notes-section">
        <div class="module-notes-header">
          <h4 class="module-name">${moduleName}</h4>
        </div>
        <div class="module-notes-list">
          ${moduleNotes.map((note) => `
            <div class="note-item">
              <div class="note-icon">💬</div>
              <div class="note-content">
                <div class="note-page">${i18n.translations['alm.overview.page'] || 'Page'} ${note.attributes.marker || 'N/A'}</div>
                <div class="note-text">${note.attributes.text || ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="notes-content">
      <div class="notes-header">
        <h3 class="content-title">${courseTitle}</h3>
      </div>
      <div class="notes-modules">
        ${moduleNotesHTML}
      </div>
    </div>
  `;
}

// Export functions
export {
  generateEnrolledHTML,
  generateNonEnrolledHTML,
  createCourseOverviewHTML,
  generateNotesHTML,
};
