// API Configuration
const API_CONFIG = {
  baseUrl: 'https://learningmanager.adobe.com/primeapi/v2',
  headers: {
    'Accept': 'application/vnd.api+json',
    'Authorization': `oauth ${sessionStorage.getItem('alm_access_token')}`
  }
};

// Check if user is already enrolled in course
async function checkEnrollmentStatus(courseId) {
  try {
    const accessToken = sessionStorage.getItem('alm_access_token');
    const params = new URLSearchParams({
      'include': 'enrollment.loResourceGrades,enrollment.loInstance.loResources.resources.room',
      'showLoContentSource': 'true',
      'access_token': accessToken
    });

    const url = `${API_CONFIG.baseUrl}/learningObjects/${courseId}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `oauth ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if user has enrollment data
    const hasEnrollment = data.data && 
                         data.data.relationships && 
                         data.data.relationships.enrollment && 
                         data.data.relationships.enrollment.data;
    
    return { isEnrolled: hasEnrollment, data: data };
  } catch (error) {
    console.error('Error checking enrollment status:', error);
    return { isEnrolled: false, data: null };
  }
}

// Enroll user in course
async function enrollUser(courseId) {
  try {
    const accessToken = sessionStorage.getItem('alm_access_token');
    const params = new URLSearchParams({
      'include': 'enrollment.loResourceGrades,enrollment.loInstance.loResources.resources.room',
      'showLoContentSource': 'true',
      'access_token': accessToken
    });

    const url = `${API_CONFIG.baseUrl}/learningObjects/${courseId}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `oauth ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error enrolling user:', error);
    return null;
  }
}

// Create and show fluidic player modal
function createFluidicPlayerModal(playerUrl) {
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

  // Add event listeners
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      document.body.removeChild(modalOverlay);
    }
  });

  // Listen for messages from the iframe to close modal
  window.addEventListener('message', function closePlayer(event) {
    if (event.data === 'status:close') {
      // Handle closing event from Adobe Learning Manager player
      if (document.body.contains(modalOverlay)) {
        document.body.removeChild(modalOverlay);
      }
    }
  });

  // Assemble modal
  modalContent.appendChild(iframe);
  modalOverlay.appendChild(modalContent);

  // Add to document
  document.body.appendChild(modalOverlay);
}

// Handle module click
async function handleModuleClick(courseId, resourceId, resourceData, includedData) {
  try {
    console.log('Starting module launch process...');
    
    // Check if user is already enrolled
    console.log('Checking enrollment status for course:', courseId);
    const enrollmentStatus = await checkEnrollmentStatus(courseId);
    
    let enrollmentResult = null;
    
    if (!enrollmentStatus.isEnrolled) {
      // User is not enrolled, so enroll them
      console.log('User not enrolled, enrolling in course:', courseId);
      enrollmentResult = await enrollUser(courseId);
      
      if (!enrollmentResult) {
        console.error('Failed to enroll user');
        alert('Failed to enroll in course. Please try again.');
        return;
      }
      
      console.log('User enrolled successfully');
    } else {
      console.log('User already enrolled, skipping enrollment');
      enrollmentResult = enrollmentStatus.data;
    }
    
    // Create embeddable player URL directly
    const accessToken = sessionStorage.getItem('alm_access_token');
    const baseUrl = API_CONFIG.baseUrl.replace('/primeapi/v2', ''); // Remove API path to get base domain
    const embeddableUrl = `${baseUrl}/app/player?lo_id=${courseId}&access_token=${accessToken}`;
    
    console.log('Launching embeddable player with URL:', embeddableUrl);
    
    // Open embeddable player in modal
    createFluidicPlayerModal(embeddableUrl);
    
  } catch (error) {
    console.error('Error launching module:', error);
    alert('An error occurred while launching the course. Please try again.');
  }
}

// Extract course ID and instance ID from URL parameters
function extractIdsFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  
  return {
    courseId: urlParams.get('trainingId'),
    instanceId: urlParams.get('trainingInstanceId')
  };
}

// Extract course data from the existing HTML (generated by the action)
function extractCourseDataFromHTML() {
  const courseOverview = document.querySelector('.course-overview');
  if (!courseOverview) return null;

  // Extract course ID from meta tag or module data attributes
  const courseId = document.querySelector('meta[name="course-id"]')?.content || 
                  document.querySelector('.module-item')?.dataset.courseId;

  // Extract course title
  const courseTitle = document.querySelector('.course-title')?.textContent || 
                     document.querySelector('meta[name="course-title"]')?.content;

  // Extract modules data from existing HTML
  const moduleElements = document.querySelectorAll('.module-item');
  const modules = Array.from(moduleElements).map(moduleEl => ({
    id: moduleEl.dataset.resourceId,
    courseId: moduleEl.dataset.courseId,
    name: moduleEl.querySelector('.module-link')?.textContent,
    type: moduleEl.querySelector('.module-type')?.textContent?.split(':')[0],
    contentType: moduleEl.querySelector('.module-type')?.textContent?.split(':')[1]?.trim(),
    duration: moduleEl.querySelector('.module-duration')?.textContent?.replace('⏱️', '').trim(),
    status: moduleEl.classList.contains('completed') ? 'completed' : 'in-progress',
    isCompleted: moduleEl.classList.contains('completed'),
    statusText: moduleEl.querySelector('.module-status')?.textContent?.replace(/[⏱️✓]/g, '').trim(),
    statusIcon: moduleEl.querySelector('.module-status')?.textContent?.match(/[⏱️✓]/)?.[0] || '⏱️'
  }));

  return {
    courseId,
    courseTitle,
    modules,
    // Extract other data as needed
    duration: document.querySelector('.duration-badge')?.textContent?.replace(/[⏱️()estimated]/g, '').trim()
  };
}

// Format duration
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return 'Self-paced';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Create course header
function createCourseHeader(courseData) {
  const attributes = courseData.attributes;
  const metadata = attributes.localizedMetadata && attributes.localizedMetadata[0] 
    ? attributes.localizedMetadata[0] 
    : { name: attributes.name || 'Course', description: '' };

  const header = document.createElement('div');
  header.className = 'course-header';
  
  header.innerHTML = `
    <div class="course-hero">
      <h1 class="course-title">${metadata.name}</h1>
      <div class="course-format">${attributes.loFormat || 'Self-paced'}</div>
    </div>
  `;
  
  return header;
}

// Create prerequisites section
function createPrerequisitesSection(courseData, includedData = []) {
  // Check if there are prerequisites
  const hasPrerequisites = courseData.relationships && 
                          courseData.relationships.prerequisiteLOs && 
                          courseData.relationships.prerequisiteLOs.data && 
                          courseData.relationships.prerequisiteLOs.data.length > 0;
  
  // Return null if no prerequisites to hide the section
  if (!hasPrerequisites) {
    return null;
  }
  
  const section = document.createElement('div');
  section.className = 'course-section prerequisites-section';
  
  const prerequisites = courseData.relationships.prerequisiteLOs.data.map(prereq => {
    // Find the prerequisite details in included data
    const prereqData = includedData.find(item => item.id === prereq.id);
    if (prereqData && prereqData.attributes) {
      const prereqMetadata = prereqData.attributes.localizedMetadata && prereqData.attributes.localizedMetadata[0] 
        ? prereqData.attributes.localizedMetadata[0] 
        : { name: prereqData.attributes.name || 'Prerequisite Course' };
      
      return `
        <div class="prerequisite-item">
          <span class="prerequisite-type">Course: ${prereqData.attributes.loFormat || 'Self-paced'}</span>
          <a href="#" class="prerequisite-link">${prereqMetadata.name}</a>
        </div>
      `;
    }
    return '';
  }).join('');
  
  section.innerHTML = `
    <h2 class="section-title">Course Prerequisites <span class="optional-label">(Optional)</span></h2>
    <div class="prerequisites-content">
      ${prerequisites}
    </div>
  `;
  
  return section;
}

// Create modules section
function createModulesSection(courseData, includedData = []) {
  const section = document.createElement('div');
  section.className = 'course-section modules-section';
  
  // Get course instances and modules
  let modulesContent = '';
  let coreContentCompleted = 0;
  let totalCoreContent = 0;
  
  if (courseData.relationships && courseData.relationships.instances && courseData.relationships.instances.data) {
    const instanceId = courseData.relationships.instances.data[0]?.id;
    const instanceData = includedData.find(item => item.id === instanceId && item.type === 'learningObjectInstance');
    
    if (instanceData && instanceData.relationships && instanceData.relationships.loResources) {
      const resources = instanceData.relationships.loResources.data;
      totalCoreContent = resources.length;
      
      modulesContent = `
        <div class="core-content-section">
          <h3 class="content-title">
            Core content 
            <span class="duration-badge">⏱️ ${formatDuration(courseData.attributes.duration)} (estimated)</span>
          </h3>
          <div class="modules-list">
            ${resources.map((resource, index) => {
              const resourceData = includedData.find(item => item.id === resource.id);
              if (resourceData && resourceData.attributes) {
                const resourceMetadata = resourceData.attributes.localizedMetadata && resourceData.attributes.localizedMetadata[0] 
                  ? resourceData.attributes.localizedMetadata[0] 
                  : { name: resourceData.attributes.name || 'Module' };
                
                const isCompleted = Math.random() > 0.5; // Mock completion status
                const status = isCompleted ? 'completed' : 'in-progress';
                const statusIcon = isCompleted ? '✓' : '⏱️';
                const statusText = isCompleted ? 'Last visited' : 'In Progress';
                
                if (isCompleted) coreContentCompleted++;
                
                return `
                  <div class="module-item ${status}" data-resource-id="${resource.id}" data-course-id="${courseData.id}">
                    <div class="module-icon">⭐</div>
                    <div class="module-content">
                      <div class="module-header">
                        <span class="module-type">${resourceData.attributes.loFormat || 'Self-paced'}: ${resourceData.attributes.contentType || 'SCORM2004'}</span>
                      </div>
                      <div class="module-title">
                        <a href="#" class="module-link">${resourceMetadata.name}</a>
                      </div>
                      <div class="module-meta">
                        <span class="module-duration">⏱️ ${formatDuration(resourceData.attributes.desiredDuration)}</span>
                        <span class="module-status">${statusIcon} ${statusText}</span>
                      </div>
                    </div>
                  </div>
                `;
              }
              return '';
            }).join('')}
          </div>
        </div>
      `;
    }
  }
  
  if (!modulesContent) {
    modulesContent = '<div class="no-modules">No modules available</div>';
  }
  
  section.innerHTML = `
    <div class="section-tabs">
      <button class="tab-button active">Modules</button>
      <button class="tab-button">Notes</button>
    </div>
    <div class="modules-content">
      ${modulesContent}
    </div>
  `;
  
  return { section, coreContentCompleted, totalCoreContent };
}

// Create sidebar
function createSidebar(coreContentCompleted, totalCoreContent, courseData, includedData = []) {
  const sidebar = document.createElement('div');
  sidebar.className = 'course-sidebar';
  
  // Get job aids from supplementary resources
  let jobAidsContent = '';
  if (courseData.relationships && courseData.relationships.supplementaryLOs && courseData.relationships.supplementaryLOs.data) {
    const jobAids = courseData.relationships.supplementaryLOs.data.filter(item => {
      const itemData = includedData.find(included => included.id === item.id);
      return itemData && itemData.attributes && itemData.attributes.loType === 'jobAid';
    });
    
    if (jobAids.length > 0) {
      jobAidsContent = `
        <div class="sidebar-section job-aids-section">
          <h3 class="sidebar-title">🔧 Job aids</h3>
          <div class="job-aids-list">
            ${jobAids.map(jobAid => {
              const jobAidData = includedData.find(item => item.id === jobAid.id);
              if (jobAidData && jobAidData.attributes) {
                const jobAidMetadata = jobAidData.attributes.localizedMetadata && jobAidData.attributes.localizedMetadata[0] 
                  ? jobAidData.attributes.localizedMetadata[0] 
                  : { name: jobAidData.attributes.name || 'Job Aid', description: '' };
                
                return `
                  <div class="job-aid-item">
                    <a href="#" class="job-aid-link">${jobAidMetadata.name}</a>
                    <p class="job-aid-description">${jobAidMetadata.description || 'Job aid description'}</p>
                  </div>
                `;
              }
              return '';
            }).join('')}
          </div>
        </div>
      `;
    }
  }
  
  sidebar.innerHTML = `
    <div class="sidebar-actions">
      <button class="continue-btn">Continue</button>
    </div>
    
    <div class="sidebar-section progress-section">
      <div class="progress-item">
        <span class="progress-count">${coreContentCompleted}/${totalCoreContent}</span>
        <span class="progress-label">Core content completed</span>
      </div>
    </div>
    
    ${jobAidsContent}
  `;
  
  return sidebar;
}

export default async function decorate(block) {
  try {
    console.log('=== COURSE OVERVIEW DECORATE FUNCTION STARTED ===');
    
    // Restructure the existing HTML into proper layout
    const existingHTML = block.innerHTML;
    console.log('Original HTML:', existingHTML);
    
    // Extract data from existing elements
    const h1 = block.querySelector('h1');
    const courseTitle = h1 ? h1.textContent : 'Course Title';
    
    const paragraphs = block.querySelectorAll('p');
    let courseFormat = 'Self Paced';
    let moduleButtons = [];
    let continueText = '';
    let progressText = '';
    
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text === 'Self Paced') {
        courseFormat = text;
      } else if (text === 'Continue') {
        continueText = text;
      } else if (text.includes('Core content completed')) {
        progressText = text;
      } else if (p.classList.contains('button-container')) {
        const button = p.querySelector('a.button');
        if (button) {
          moduleButtons.push({
            text: button.textContent,
            title: button.title || button.textContent
          });
        }
      }
    });
    
    // Create new structured HTML
    const newHTML = `
      <!-- Course Header -->
      <div class="course-header">
        <div class="course-hero">
          <h1 class="course-title">${courseTitle}</h1>
          <div class="course-format">${courseFormat}</div>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="course-main-content">
        <!-- Left Content -->
        <div class="course-left-content">
          <div class="course-section modules-section">
            <div class="section-tabs">
              <button class="tab-button active">Modules</button>
              <button class="tab-button">Notes</button>
            </div>
            <div class="modules-content">
              <div class="core-content-section">
                <h3 class="content-title">
                  Core content 
                  <span class="duration-badge">⏱️ 1h (estimated)</span>
                </h3>
                <div class="modules-list">
                  ${moduleButtons.map((module, index) => `
                    <div class="module-item ${index < 2 ? 'completed' : 'in-progress'}" data-resource-id="module-${index}" data-course-id="course:12495374">
                      <div class="module-icon">⭐</div>
                      <div class="module-content">
                        <div class="module-header">
                          <span class="module-type">Self-paced: SCORM2004</span>
                        </div>
                        <div class="module-title">
                          <a href="#" class="module-link">${module.text}</a>
                        </div>
                        <div class="module-meta">
                          <span class="module-duration">⏱️ N/A</span>
                          <span class="module-status">${index < 2 ? '✓ Last visited' : '⏱️ In Progress'}</span>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Sidebar -->
        <div class="course-sidebar">
          <div class="sidebar-actions">
            <button class="continue-btn">Continue</button>
          </div>
          
          <div class="sidebar-section progress-section">
            <div class="progress-item">
              <span class="progress-count">2/3</span>
              <span class="progress-label">Core content completed</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Replace the block content
    block.innerHTML = newHTML;
    console.log('HTML restructured successfully');
    
    // Extract course data from the existing HTML
    const courseData = extractCourseDataFromHTML();
    
    if (!courseData || !courseData.courseId) {
      console.error('No course data found in HTML');
      return;
    }
    
    console.log('Course data extracted:', courseData);
    
    // Add event listeners for module clicks
    const moduleItems = document.querySelectorAll('.module-item');
    moduleItems.forEach(moduleItem => {
      moduleItem.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const resourceId = moduleItem.dataset.resourceId;
        const courseId = moduleItem.dataset.courseId;
        
        if (resourceId && courseId) {
          console.log('Module clicked:', { resourceId, courseId });
          await handleModuleClick(courseId, resourceId, null, []);
        }
      });
      
      // Add cursor pointer style
      moduleItem.style.cursor = 'pointer';
    });
    
    // Add event listeners for continue button
    const continueBtn = document.querySelector('.continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Find the first incomplete module or first module
        const incompleteModule = courseData.modules.find(m => !m.isCompleted);
        const targetModule = incompleteModule || courseData.modules[0];
        
        if (targetModule) {
          console.log('Continue clicked, launching module:', targetModule.name);
          await handleModuleClick(targetModule.courseId, targetModule.id, null, []);
        }
      });
    }
    
    // Add tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all tabs
        tabButtons.forEach(tab => tab.classList.remove('active'));
        
        // Add active class to clicked tab
        button.classList.add('active');
        
        // Handle tab content switching (if needed)
        const tabText = button.textContent.toLowerCase();
        console.log('Tab clicked:', tabText);
        
        // You can add tab content switching logic here if needed
      });
    });
    
    console.log('Course overview block initialized successfully');
    
  } catch (error) {
    console.error('Error initializing course overview:', error);
  }
}
