// HTML Generator for Course Overview
// Handles HTML template generation for different states

import { formatDuration } from './ui-components.js';

// Generate enrolled user HTML layout
function generateEnrolledHTML(data, courseId, learnerData, authorNames, skillsHtml, enrollmentInfo, processedModules, testoutModules = [], hasNotes = false) {
  const { progressPercent, completedModules, moduleResources } = enrollmentInfo;
  
  // Determine which tabs to show
  const hasTestoutModules = testoutModules && testoutModules.length > 0;
  
  // Generate tabs HTML conditionally
  let tabsHTML = '';
  if (hasTestoutModules || hasNotes) {
    tabsHTML = `
      <!-- Tabs Section -->
      <div class="course-tabs">
        <button class="tab-button active">Module</button>
        ${hasTestoutModules ? '<button class="tab-button">Testout</button>' : ''}
        ${hasNotes ? '<button class="tab-button">Notes</button>' : ''}
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
          <span class="progress-label">Progress:</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <span class="progress-text">${progressPercent}%</span>
        </div>
      </div>
      <button class="share-btn">🔗 Share</button>
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
            Core Content 
            <span class="duration-badge">${Math.floor(learnerData.data.attributes.duration / 60)} mins ${learnerData.data.attributes.duration % 60} secs</span>
          </h3>
          <div class="modules-list">
            ${processedModules.map(module => `
              <div class="module-item ${module.statusClass}" data-resource-id="${module.id}">
                <div class="module-icon">${module.moduleIcon}</div>
                <div class="module-content">
                  <div class="module-left">
                    <div class="module-header">
                      <span class="module-format">SELF PACED</span>
                    </div>
                    <div class="module-title">
                      <h4 class="module-name">${module.name}</h4>
                    </div>
                  </div>
                  <div class="module-meta">
                    <span class="module-duration">${module.duration}</span>
                    ${module.statusText ? `<span class="module-status">${module.statusIcon} ${module.statusText}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          
        </div>
      </div>
      
      <!-- Learner Sidebar -->
      <div class="learner-sidebar enrolled-sidebar">
        <div class="sidebar-actions">
          <button class="start-btn">Start</button>
          <button class="save-btn">🔖 Save</button>
        </div>
        
        <!-- Rating Section -->
        <div class="sidebar-section">
          <div class="rating-section">
            <h4>Rate this Course</h4>
            <div class="star-rating">
              ${Array.from({length: 5}, (_, i) => {
                const starIndex = i + 1;
                const isSelected = starIndex <= enrollmentInfo.currentRating;
                return `<span class="star" data-rating="${starIndex}">${isSelected ? '⭐' : '☆'}</span>`;
              }).join('')}
              <button class="submit-rating">Submit</button>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="instance-details">
            <h4>📋 Instance details</h4>
            <p>Default Instance</p>
            <a href="#" class="view-instances">View All Instances</a>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="progress-info">
            <h4>${completedModules}/${moduleResources.length} Core Content Completed</h4>
          </div>
        </div>
        
        <!-- Badges Section -->
        <div class="sidebar-section">
          <div class="badges-section">
            <h4>🏆 Badges</h4>
            <div class="badge-item">
              <img src="https://cpcontents.adobe.com/public/account/121816/accountassets/121816/badges/1f250de126e649e2b5dfb0434e0702b3/badge_hero.png" 
                   alt="Hero Badge" class="badge-icon">
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="skills-covered">
            <h4>✈️ Skills covered</h4>
            <div class="skills-list">
              <p>${skillsHtml || 'No skills specified'}</p>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="author-info">
            <h4>Author(s)</h4>
            <div class="author-item">
              <div class="author-avatar">👤</div>
              <span class="author-name">${authorNames}</span>
            </div>
          </div>
        </div>
        
        <!-- Unenroll Button - Only show if enrolled -->
        <div class="sidebar-section">
          <button class="unenroll-btn" data-course-id="${courseId}">Unenroll from Course</button>
        </div>
      </div>
    </div>
  `;
}

// Generate non-enrolled user HTML layout
function generateNonEnrolledHTML(data, courseId, authorNames) {
  const enrollButtonText = 'Enroll';
  const saveButtonClass = 'save-btn disabled';
  const progressText = '0 enrollment(s)';
  
  return `
    <!-- Course Header -->
    <div class="course-header">
      <div class="course-header-content">
        <h1 class="course-title">${data.courseTitle}</h1>
        <div class="course-format">${data.courseFormat}</div>
      </div>
      <button class="share-btn">🔗 Share</button>
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
            Core Content 
            <span class="duration-badge">41m</span>
          </h3>
          <div class="modules-list">
            ${data.modules.map(module => `
              <div class="module-item" data-resource-id="${module.resourceId}">
                <div class="module-icon">${module.icon}</div>
                <div class="module-content">
                  <div class="module-left">
                    <div class="module-header">
                      <span class="module-format">${module.format}</span>
                    </div>
                    <div class="module-title">
                      <h4 class="module-name">${module.title}</h4>
                    </div>
                  </div>
                  <div class="module-meta">
                    <span class="module-duration">${module.duration}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <!-- Learner Sidebar -->
      <div class="learner-sidebar">
        <div class="sidebar-actions">
          <button class="enroll-btn" data-course-id="${courseId}">${enrollButtonText}</button>
          <button class="${saveButtonClass}">🔖 Save</button>
        </div>
        
        <div class="sidebar-section">
          <div class="instance-details">
            <h4>📋 Instance details</h4>
            <p>Default Instance</p>
            <a href="#" class="view-instances">View All Instances</a>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="enrollment-info">
            <h4>👥 ${progressText}</h4>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="skills-covered">
            <h4>✈️ Skills covered</h4>
            <div class="skills-list">
              <p>Photoshop - Level 2 (3 Credits)<br>AEM - Level 1 (2 Credits)</p>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="author-info">
            <h4>Author(s)</h4>
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
function createCourseOverviewHTML(data, courseId, learnerData, authorNames, skillsHtml, enrollmentInfo, processedModules, testoutModules = [], hasNotes = false) {
  if (enrollmentInfo.isEnrolled) {
    return generateEnrolledHTML(data, courseId, learnerData, authorNames, skillsHtml, enrollmentInfo, processedModules, testoutModules, hasNotes);
  } else {
    return generateNonEnrolledHTML(data, courseId, authorNames);
  }
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
          <p>No notes available for this course.</p>
        </div>
      </div>
    `;
  }

  const notes = notesData.data;
  
  // Group notes by module (loResource)
  const notesByModule = {};
  
  notes.forEach(note => {
    // Get module/resource ID from relationships
    const resourceId = note.relationships?.loResource?.data?.id || 'unknown';
    
    if (!notesByModule[resourceId]) {
      notesByModule[resourceId] = [];
    }
    notesByModule[resourceId].push(note);
  });
  
  // Create a lookup map for module names
  const moduleNameMap = {};
  processedModules.forEach(module => {
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
          ${moduleNotes.map(note => `
            <div class="note-item">
              <div class="note-icon">💬</div>
              <div class="note-content">
                <div class="note-page">Page ${note.attributes.marker || 'N/A'}</div>
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
  generateNotesHTML
};
