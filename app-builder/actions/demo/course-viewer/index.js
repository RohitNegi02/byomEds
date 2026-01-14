/*
* <license header>
*/

/**
 * Action: Course Viewer
 * Purpose: Generates HTML content for overlay paths under `/overview/trainingId/*` that the Helix Admin API consumes during
 *          preview. This action is invoked when users visit course URLs and provides course information from ALM API.
 *
 * How it works:
 * - Validates that the requested `__ow_path` is a course overlay path (`/overview/trainingId/*`). If not, returns 404.
 * - Extracts course ID and instance ID from the path structure
 * - Calls the ALM API to fetch course data using environment token
 * - Maps the API response to course data model and renders basic HTML with EDS block structure
 * - Returns `text/html` with course meta tags for EDS indexing and course-info block for decoration
 *
 * Inputs:
 * - params.__ow_path (string): Request path; must match `/overview/trainingId/{courseId}/trainingInstanceId/{instanceId}`
 *
 * Output:
 * - HTML page (Content-Type: text/html) with course meta tags and course-info block for EDS decoration.
 */
const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse } = require('../../utils')
const fs = require('fs')

const ALM_API_BASE = "https://learningmanager.adobe.com/primeapi/v2"

async function main(params) {
  const logger = Core.Logger('course-viewer', { level: params.LOG_LEVEL || 'debug' })

  try {
    logger.info('Invoked course-viewer action')
    
    // Print the entire payload for debugging
    logger.info('Received params keys:', Object.keys(params))
    logger.info('Received payload:', JSON.stringify(params, null, 2))

    let courseId = null;
    let instanceId = null;

    // Check for webhook payload in different possible formats
    let webhookData = null;
    
    // Check if this is a test connection
    if (params.message === "Test Connection") {
      logger.info('Received test connection from webhook - returning success response');
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'success',
          message: 'Webhook endpoint is working correctly',
          timestamp: new Date().toISOString()
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }
    
    // Format 1: Direct events array
    if (params.events && Array.isArray(params.events) && params.events.length > 0) {
      webhookData = params;
      logger.info('Found webhook payload format 1: Direct events array')
    }
    // Format 2: Nested in body
    else if (params.body && typeof params.body === 'string') {
      try {
        const parsedBody = JSON.parse(params.body);
        if (parsedBody.events && Array.isArray(parsedBody.events)) {
          webhookData = parsedBody;
          logger.info('Found webhook payload format 2: JSON string in body')
        }
      } catch (e) {
        logger.warn('Failed to parse body as JSON:', e.message)
      }
    }
    // Format 3: Already parsed body object
    else if (params.body && typeof params.body === 'object' && params.body.events) {
      webhookData = params.body;
      logger.info('Found webhook payload format 3: Object in body')
    }
    // Format 4: Check for any property that looks like webhook data
    else {
      for (const [key, value] of Object.entries(params)) {
        if (value && typeof value === 'object' && value.events && Array.isArray(value.events)) {
          webhookData = value;
          logger.info(`Found webhook payload format 4: In property '${key}'`)
          break;
        }
      }
    }
    
    // Format 5: Check if the webhook data might be in a different structure
    // Some webhooks send data as individual parameters
    if (!webhookData && params.accountId) {
      // Try to reconstruct webhook data from individual parameters
      const reconstructedData = {
        accountId: params.accountId,
        events: []
      };
      
      // Look for event data in various parameter formats
      if (params.eventId && params.eventName && params.loId) {
        reconstructedData.events.push({
          eventId: params.eventId,
          eventName: params.eventName,
          timestamp: params.timestamp || new Date().toISOString(),
          eventInfo: params.eventInfo || '',
          data: {
            loId: params.loId,
            loType: params.loType || 'course'
          }
        });
        webhookData = reconstructedData;
        logger.info('Found webhook payload format 5: Reconstructed from individual parameters')
      }
    }

    if (webhookData && webhookData.events && webhookData.events.length > 0) {
      logger.info('Processing webhook payload from ALM')
      logger.info('Full ALM webhook payload:', JSON.stringify(webhookData, null, 2))
      
      const event = webhookData.events[0]; // Process first event
      logger.info('Processing ALM event:', JSON.stringify(event, null, 2))
      
      if (event.data && event.data.loId) {
        // Extract course ID from loId (e.g., "learningProgram:123836" -> "123836")
        const loIdParts = event.data.loId.split(':');
        if (loIdParts.length === 2) {
          courseId = loIdParts[1];
          logger.info(`Extracted course ID from ALM webhook: ${courseId}`)
          
          // Check if instanceId is provided in the event data
          if (event.data.instanceId) {
            instanceId = event.data.instanceId;
            logger.info(`Instance ID provided in ALM webhook: ${instanceId}`)
          } else {
            logger.info('No instance ID in ALM webhook - will fetch all instances for this course')
          }
        } else {
          return errorResponse(400, `Invalid loId format: ${event.data.loId}`, logger);
        }
      } else {
        return errorResponse(400, 'Missing loId in event data', logger);
      }
    }
    // Fallback to URL path parsing for backward compatibility
    else if (params.__ow_path) {
      logger.info('Processing URL path:', params.__ow_path)
      
      let path = params.__ow_path;
      if (!path.startsWith("/")) {
        path = "/" + path;
      }

      // Check if this is a course overlay path
      if (!path.includes('/overview/trainingId/')) {
        return errorResponse(404, `${path} is not a course overlay path`, logger);
      }

      // Extract course ID and instance ID from path
      const pathParts = path.split('/').filter(part => part.length > 0);

      if (pathParts.length >= 3 && pathParts[0] === 'overview' && pathParts[1] === 'trainingId') {
        const numericCourseId = pathParts[2];
        courseId = numericCourseId;
        
        if (pathParts.length >= 5 && pathParts[3] === 'trainingInstanceId') {
          const instancePart = pathParts[4];
          instanceId = instancePart;
        }
      }
    } else {
      logger.error('No valid webhook payload or URL path found')
      logger.error('Available params keys:', Object.keys(params))
      return errorResponse(400, 'Missing webhook payload or URL path', logger);
    }

    if (!courseId) {
      return errorResponse(400, 'Could not extract course ID from request', logger);
    }

    logger.info(`Processing course ID: ${courseId}, instance ID: ${instanceId}`);

    // Fetch course data from ALM API and generate HTML
    const courseData = await fetchCourseData(courseId, logger);
    
    if (!courseData) {
      return errorResponse(404, 'Course not found', logger);
    }

    // Process course data for template
    const processedData = processCourseData(courseData, courseId, instanceId);
    
    // Generate HTML with meta tags and EDS block structure
    const html = generateCourseHTML(processedData, logger);

    const response = {
      statusCode: 200,
      body: html,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }

    logger.info(`${response.statusCode}: Course HTML rendered successfully for ${courseId}`);

    // Publish to EDS cache after HTML response is prepared (fire and forget - no await)
    publishToEdsCache(courseId, instanceId, params, logger).catch(publishError => {
      logger.error('Error publishing to EDS cache:', publishError);
      // This is fire-and-forget, so we just log the error
    });

    return response;

  } catch (error) {
    logger.error('Error in course-viewer action:', error);
    return errorResponse(500, 'server error', logger);
  }
}

/**
 * Fetches course data from ALM API
 */
async function fetchCourseData(courseId, logger) {
  const includeParams = 'instances.enrollment.loResourceGrades,enrollment.loInstance.loResources.resources,authors,supplementaryLOs.instances.loResources.resources,supplementaryResources,prerequisiteLOs.enrollment,instances.loResources.resources.room,subLOs.instances.loResources,skills.skillLevel.skill';
  
  // Hardcoded ALM access token
  const ALM_ACCESS_TOKEN = "c0806f12f2e49aad953eae277e281b84";
  
  // courseId is now just the numeric ID (e.g., "7235188")
  const numericCourseId = courseId;
  
  try {
    // Try course endpoint first
    const courseUrl = `${ALM_API_BASE}/learningObjects/course:${numericCourseId}?include=${includeParams}&useCache=true&filter.ignoreEnhancedLP=false`;
    logger.info(`Fetching course data from: ${courseUrl}`);
    
    const response = await fetch(courseUrl, {
      headers: {
        'Authorization': `Bearer ${ALM_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.api+json'
      }
    });

    logger.info(`Course API response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const courseData = await response.json();
      logger.info('Course data fetched successfully as course type');
      return courseData;
    } else {
      logger.info(`Course not found (${response.status}), trying as learning program`);
      
      // Try learning program endpoint
      const programUrl = `${ALM_API_BASE}/learningObjects/learningProgram:${numericCourseId}?include=${includeParams}&useCache=true&filter.ignoreEnhancedLP=false`;
      logger.info(`Fetching learning program data from: ${programUrl}`);
      
      const programResponse = await fetch(programUrl, {
        headers: {
          'Authorization': `Bearer ${ALM_ACCESS_TOKEN}`,
          'Accept': 'application/vnd.api+json'
        }
      });

      logger.info(`Learning program API response status: ${programResponse.status} ${programResponse.statusText}`);

      if (programResponse.ok) {
        const programData = await programResponse.json();
        logger.info('Course data fetched successfully as learning program type');
        return programData;
      } else {
        logger.error(`Failed to fetch course data: ${programResponse.status} ${programResponse.statusText}`);
        return null;
      }
    }
  } catch (error) {
    logger.error('Error fetching course data:', error);
    return null;
  }
}

/**
 * Processes raw course data into template-ready format
 */
function processCourseData(courseResponse, courseId, instanceId) {
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  const courseType = courseData.type === 'learningProgram' ? 'Learning Program' : 'Course';
  
  // Extract course information
  const courseTitle = safeGet(courseData, 'attributes.localizedMetadata.0.name', 'Untitled Course');
  const courseDescription = safeGet(courseData, 'attributes.localizedMetadata.0.description', 'No description available');
  const courseOverview = safeGet(courseData, 'attributes.localizedMetadata.0.overview', 'No overview available');
  
  // Format duration from seconds to readable format
  const durationSeconds = safeGet(courseData, 'attributes.duration', 0);
  const courseDuration = formatDuration(durationSeconds);
  
  // Extract skills
  const skillArray = extractSkills(courseResponse);
  
  // Extract skill level
  let courseLevel = safeGet(courseData, 'attributes.skillLevel', 'N/A');
  if (courseLevel === 'N/A' && skillArray.length > 0) {
    const firstSkill = courseResponse.included?.find(item => item.type === 'skillLevel');
    if (firstSkill) {
      courseLevel = firstSkill.attributes?.name || 'N/A';
    }
  }

  // Extract modules/resources from instances
  const coreModules = extractCoreModules(courseResponse);
  
  // Extract prerequisites
  const prerequisites = extractPrerequisites(courseResponse);
  
  // Extract job aids
  const jobAids = extractJobAids(courseResponse);

  return {
    courseId,
    instanceId,
    courseTitle,
    courseDescription: courseDescription || 'No description available',
    courseOverview: courseOverview || 'No overview available',
    courseType,
    courseDuration,
    courseLevel,
    courseSkills: skillArray.join(', ') || 'No skills specified',
    enrollmentCount: safeGet(courseData, 'attributes.enrollmentCount', 0),
    ratingAvg: safeGet(courseData, 'attributes.rating.averageRating', 0),
    ratingCount: safeGet(courseData, 'attributes.rating.ratingsCount', 0),
    imageUrl: safeGet(courseData, 'attributes.imageUrl', ''),
    loFormat: safeGet(courseData, 'attributes.loFormat', 'Self-paced'),
    coreModules: coreModules,
    prerequisites: prerequisites,
    jobAids: jobAids,
    timestamp: new Date().toISOString()
  };
}

/**
 * Safely gets nested object properties
 */
function safeGet(obj, path, defaultValue = '') {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
}

/**
 * Extracts skills from course response
 */
function extractSkills(courseResponse) {
  const skills = [];
  if (courseResponse.included) {
    courseResponse.included.forEach(item => {
      if (item.type === 'skill') {
        skills.push(item.attributes.name);
      }
    });
  }
  return skills;
}

/**
 * Extracts core modules from course instances
 */
function extractCoreModules(courseResponse) {
  const modules = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  // Get course instances and modules
  if (courseData.relationships && courseData.relationships.instances && courseData.relationships.instances.data) {
    const instanceId = courseData.relationships.instances.data[0]?.id;
    const instanceData = includedData.find(item => item.id === instanceId && item.type === 'learningObjectInstance');
    
    if (instanceData && instanceData.relationships && instanceData.relationships.loResources) {
      const resources = instanceData.relationships.loResources.data;
      
      resources.forEach((resource, index) => {
        const resourceData = includedData.find(item => item.id === resource.id);
        if (resourceData && resourceData.attributes) {
          const resourceMetadata = resourceData.attributes.localizedMetadata && resourceData.attributes.localizedMetadata[0] 
            ? resourceData.attributes.localizedMetadata[0] 
            : { name: resourceData.attributes.name || 'Module' };
          
          const isCompleted = Math.random() > 0.5; // Mock completion status
          const status = isCompleted ? 'completed' : 'in-progress';
          
          const moduleType = resourceData.attributes.loFormat || 'Self-paced';
          
          // Handle duration based on module type
          let moduleDuration;
          if (moduleType.toLowerCase() === 'self-paced') {
            moduleDuration = 'Self-paced'; // Don't show duration for self-paced content
          } else {
            const durationSeconds = resourceData.attributes.desiredDuration || 
                                   resourceData.attributes.duration || 
                                   900; // Default to 15 minutes for timed content
            moduleDuration = formatDuration(durationSeconds);
          }
          
          modules.push({
            id: resource.id,
            courseId: courseData.id,
            name: resourceMetadata.name,
            type: moduleType,
            contentType: resourceData.attributes.contentType || 'SCORM2004',
            duration: moduleDuration,
            status: status,
            isCompleted: isCompleted,
            statusText: isCompleted ? 'Last visited' : 'In Progress',
            statusIcon: isCompleted ? '✓' : '⏱️'
          });
        }
      });
    }
  }
  
  return modules;
}

/**
 * Extracts prerequisites from course response
 */
function extractPrerequisites(courseResponse) {
  const prerequisites = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  // Check if there are prerequisites
  if (courseData.relationships && courseData.relationships.prerequisiteLOs && courseData.relationships.prerequisiteLOs.data) {
    courseData.relationships.prerequisiteLOs.data.forEach(prereq => {
      // Find the prerequisite details in included data
      const prereqData = includedData.find(item => item.id === prereq.id);
      if (prereqData && prereqData.attributes) {
        const prereqMetadata = prereqData.attributes.localizedMetadata && prereqData.attributes.localizedMetadata[0] 
          ? prereqData.attributes.localizedMetadata[0] 
          : { name: prereqData.attributes.name || 'Prerequisite Course' };
        
        prerequisites.push({
          id: prereq.id,
          name: prereqMetadata.name,
          type: prereqData.attributes.loFormat || 'Self-paced'
        });
      }
    });
  }
  
  return prerequisites;
}

/**
 * Extracts job aids from supplementary resources
 */
function extractJobAids(courseResponse) {
  const jobAids = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  // Get job aids from supplementary resources
  if (courseData.relationships && courseData.relationships.supplementaryLOs && courseData.relationships.supplementaryLOs.data) {
    const jobAidItems = courseData.relationships.supplementaryLOs.data.filter(item => {
      const itemData = includedData.find(included => included.id === item.id);
      return itemData && itemData.attributes && itemData.attributes.loType === 'jobAid';
    });
    
    jobAidItems.forEach(jobAid => {
      const jobAidData = includedData.find(item => item.id === jobAid.id);
      if (jobAidData && jobAidData.attributes) {
        const jobAidMetadata = jobAidData.attributes.localizedMetadata && jobAidData.attributes.localizedMetadata[0] 
          ? jobAidData.attributes.localizedMetadata[0] 
          : { name: jobAidData.attributes.name || 'Job Aid', description: '' };
        
        jobAids.push({
          id: jobAid.id,
          name: jobAidMetadata.name,
          description: jobAidMetadata.description || 'Job aid description'
        });
      }
    });
  }
  
  return jobAids;
}

/**
 * Formats duration from seconds to readable format
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return 'N/A';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Generates HTML with comprehensive course overview structure
 */
function generateCourseHTML(courseData, logger) {
  logger.info('Generating comprehensive course HTML with EDS structure')
  
  const imageUrl = courseData.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80'
  
  // Calculate progress
  const coreContentCompleted = courseData.coreModules.filter(m => m.isCompleted).length;
  const totalCoreContent = courseData.coreModules.length;
  
  // Generate prerequisites HTML
  const prerequisitesHTML = courseData.prerequisites.length > 0 ? `
    <div class="course-section prerequisites-section">
      <h2 class="section-title">Course Prerequisites <span class="optional-label">(Optional)</span></h2>
      <div class="prerequisites-content">
        ${courseData.prerequisites.map(prereq => `
          <div class="prerequisite-item">
            <span class="prerequisite-type">Course: ${escapeHtml(prereq.type)}</span>
            <a href="#" class="prerequisite-link">${escapeHtml(prereq.name)}</a>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  // Generate modules HTML
  const modulesHTML = `
    <div class="course-section modules-section">
      <div class="section-tabs">
        <button class="tab-button active">Modules</button>
        <button class="tab-button">Notes</button>
      </div>
      <div class="modules-content">
        <div class="core-content-section">
          <h3 class="content-title">
            Core content 
            <span class="duration-badge">⏱️ ${escapeHtml(courseData.courseDuration)} (estimated)</span>
          </h3>
          <div class="modules-list">
            ${courseData.coreModules.map(module => `
              <div class="module-item ${module.status}" data-resource-id="${escapeHtml(module.id)}" data-course-id="${escapeHtml(courseData.courseId)}">
                <div class="module-icon">⭐</div>
                <div class="module-content">
                  <div class="module-header">
                    <span class="module-type">${escapeHtml(module.type)}: ${escapeHtml(module.contentType)}</span>
                  </div>
                  <div class="module-title">
                    <a href="#" class="module-link">${escapeHtml(module.name)}</a>
                  </div>
                  <div class="module-meta">
                    <span class="module-duration">⏱️ ${escapeHtml(module.duration)}</span>
                    <span class="module-status">${module.statusIcon} ${escapeHtml(module.statusText)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Generate job aids HTML
  const jobAidsHTML = courseData.jobAids.length > 0 ? `
    <div class="sidebar-section job-aids-section">
      <h3 class="sidebar-title">🔧 Job aids</h3>
      <div class="job-aids-list">
        ${courseData.jobAids.map(jobAid => `
          <div class="job-aid-item">
            <a href="#" class="job-aid-link">${escapeHtml(jobAid.name)}</a>
            <p class="job-aid-description">${escapeHtml(jobAid.description)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  return `<head>
  <meta charset="utf-8">
  <title>${escapeHtml(courseData.courseTitle)} - Course Viewer</title>
  <meta name="description" content="${escapeHtml(courseData.courseDescription)}">
  <meta name="author" content="ALM Course Viewer">
  <meta name="timestamp" content="${courseData.timestamp}">
  
  <!-- Course Meta Tags for EDS Indexing -->
  <meta name="course-id" content="${escapeHtml(courseData.courseId)}">
  <meta name="course-title" content="${escapeHtml(courseData.courseTitle)}">
  <meta name="course-duration" content="${escapeHtml(courseData.courseDuration)}">
  <meta name="course-skill-level" content="${escapeHtml(courseData.courseLevel)}">
  <meta name="course-skills" content="${escapeHtml(courseData.courseSkills)}">
  <meta name="course-type" content="${escapeHtml(courseData.courseType)}">
  <meta name="course-rating" content="${courseData.ratingAvg}">
  <meta name="course-enrollment-count" content="${courseData.enrollmentCount}">

  <!-- Open Graph Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(courseData.courseTitle)} - Course Viewer">
  <meta property="og:description" content="${escapeHtml(courseData.courseDescription)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
</head>

<body>
  <header></header>
  <main>
    <div>
      <div class="course-overview">
        <!-- Course Header -->
        <div class="course-header">
          <div class="course-hero">
            <h1 class="course-title">${escapeHtml(courseData.courseTitle)}</h1>
            <div class="course-format">${escapeHtml(courseData.loFormat)}</div>
          </div>
        </div>
        
        <!-- Main Content -->
        <div class="course-main-content">
          <!-- Left Content -->
          <div class="course-left-content">
            ${prerequisitesHTML}
            ${modulesHTML}
          </div>
          
          <!-- Sidebar -->
          <div class="course-sidebar">
            <div class="sidebar-actions">
              <button class="continue-btn">Continue</button>
            </div>
            
            <div class="sidebar-section progress-section">
              <div class="progress-item">
                <span class="progress-count">${coreContentCompleted}/${totalCoreContent}</span>
                <span class="progress-label">Core content completed</span>
              </div>
            </div>
            
            ${jobAidsHTML}
          </div>
        </div>
      </div>
    </div>
  </main>
  <footer></footer>
</body>

</html>`
}

/**
 * Publishes course content to EDS cache
 */
async function publishToEdsCache(courseId, instanceId, params, logger) {
  logger.info(`Publishing to EDS cache for courseId: ${courseId}, instanceId: ${instanceId}`);
  
  try {
    // Get EDS_AUTH_TOKEN from environment variables
    const edsAuthToken = params.EDS_AUTH_TOKEN;
    if (!edsAuthToken) {
      logger.warn('EDS_AUTH_TOKEN not provided, skipping EDS cache publishing');
      return;
    }

    const myHeaders = new Headers();
    myHeaders.append("Authorization", `token ${edsAuthToken}`);
    myHeaders.append("Content-Type", "application/json");

    const baseUrl = "rohitnegi02/byomeds/main";
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      redirect: "follow",
      body: JSON.stringify({ refresh: true })
    };

    if (instanceId) {
      // Specific instance provided - update cache only for this instance
      const publishUrl = `https://admin.hlx.page/preview/${baseUrl}/overview/trainingId/${courseId}/trainingInstanceId/${instanceId}`;
      logger.info(`Publishing to EDS cache for specific instance: ${publishUrl}`);
      
      const response = await fetch(publishUrl, requestOptions);
      const result = await response.text();
      
      if (response.ok) {
        logger.info(`Successfully published to EDS cache for instance ${instanceId}: ${response.status}`);
        logger.debug(`EDS response: ${result}`);
      } else {
        logger.warn(`EDS cache publishing failed for instance ${instanceId}: ${response.status} - ${result}`);
      }
    } else {
      // No instance ID provided - fetch all instances and update cache for each
      logger.info('No instance ID provided - fetching all instances for course');
      
      const instances = await fetchCourseInstances(courseId, logger);
      if (instances && instances.length > 0) {
        logger.info(`Found ${instances.length} instances for course ${courseId}`);
        
        // Update EDS cache for each instance
        const publishPromises = instances.map(async (instance) => {
          const publishUrl = `https://admin.hlx.page/preview/${baseUrl}/overview/trainingId/${courseId}/trainingInstanceId/${instance.id}`;
          logger.info(`Publishing to EDS cache for instance ${instance.id}: ${publishUrl}`);
          
          try {
            const response = await fetch(publishUrl, requestOptions);
            const result = await response.text();
            
            if (response.ok) {
              logger.info(`Successfully published to EDS cache for instance ${instance.id}: ${response.status}`);
              return { instanceId: instance.id, success: true, status: response.status };
            } else {
              logger.warn(`EDS cache publishing failed for instance ${instance.id}: ${response.status} - ${result}`);
              return { instanceId: instance.id, success: false, status: response.status, error: result };
            }
          } catch (error) {
            logger.error(`Error publishing to EDS cache for instance ${instance.id}:`, error);
            return { instanceId: instance.id, success: false, error: error.message };
          }
        });
        
        // Wait for all publishing operations to complete
        const results = await Promise.allSettled(publishPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        logger.info(`EDS cache publishing completed: ${successCount}/${instances.length} instances updated successfully`);
        
      } else {
        logger.warn(`No instances found for course ${courseId} - publishing to course-level cache`);
        
        // Fallback: publish to course-level cache if no instances found
        const publishUrl = `https://admin.hlx.page/preview/${baseUrl}/overview/trainingId/${courseId}`;
        logger.info(`Publishing to EDS cache for course level: ${publishUrl}`);
        
        const response = await fetch(publishUrl, requestOptions);
        const result = await response.text();
        
        if (response.ok) {
          logger.info(`Successfully published to EDS cache for course level: ${response.status}`);
          logger.debug(`EDS response: ${result}`);
        } else {
          logger.warn(`EDS cache publishing failed for course level: ${response.status} - ${result}`);
        }
      }
    }
    
  } catch (error) {
    logger.error('Error publishing to EDS cache:', error);
    throw error;
  }
}

/**
 * Fetches all instances for a course from ALM API
 */
async function fetchCourseInstances(courseId, logger) {
  const ALM_ACCESS_TOKEN = "c0806f12f2e49aad953eae277e281b84";
  
  try {
    // Try course endpoint first
    let courseUrl = `${ALM_API_BASE}/learningObjects/course:${courseId}?include=instances`;
    logger.info(`Fetching course instances from: ${courseUrl}`);
    
    let response = await fetch(courseUrl, {
      headers: {
        'Authorization': `Bearer ${ALM_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      // Try learning program endpoint
      courseUrl = `${ALM_API_BASE}/learningObjects/learningProgram:${courseId}?include=instances`;
      logger.info(`Course not found, trying learning program: ${courseUrl}`);
      
      response = await fetch(courseUrl, {
        headers: {
          'Authorization': `Bearer ${ALM_ACCESS_TOKEN}`,
          'Accept': 'application/vnd.api+json'
        }
      });
    }

    if (response.ok) {
      const courseData = await response.json();
      const instances = [];
      
      // Extract instances from the response
      if (courseData.data.relationships && courseData.data.relationships.instances && courseData.data.relationships.instances.data) {
        courseData.data.relationships.instances.data.forEach(instanceRef => {
          // Find the instance details in included data
          const instanceData = courseData.included?.find(item => item.id === instanceRef.id && item.type === 'learningObjectInstance');
          if (instanceData) {
            // Extract instance ID for EDS cache URL format
            // ALM format: "course:12495374_13216648" -> EDS format: "12495374-13216648"
            const almInstanceId = instanceData.id; // e.g., "course:12495374_13216648"
            let edsInstanceId = almInstanceId;
            
            // Convert ALM instance format to EDS format
            if (almInstanceId.includes(':') && almInstanceId.includes('_')) {
              const parts = almInstanceId.split(':')[1]; // "12495374_13216648"
              edsInstanceId = parts.replace('_', '-'); // "12495374-13216648"
            }
            
            instances.push({
              id: edsInstanceId, // Use EDS format for cache URLs
              almId: almInstanceId, // Keep ALM format for reference
              name: instanceData.attributes?.localizedMetadata?.[0]?.name || 'Default Instance',
              state: instanceData.attributes?.state || 'Active'
            });
          } else {
            // If instance details not in included, extract from reference ID
            const almInstanceId = instanceRef.id;
            let edsInstanceId = almInstanceId;
            
            if (almInstanceId.includes(':') && almInstanceId.includes('_')) {
              const parts = almInstanceId.split(':')[1];
              edsInstanceId = parts.replace('_', '-');
            }
            
            instances.push({
              id: edsInstanceId,
              almId: almInstanceId,
              name: `Instance ${edsInstanceId}`,
              state: 'Unknown'
            });
          }
        });
      }
      
      logger.info(`Found ${instances.length} instances for course ${courseId}`);
      instances.forEach(instance => {
        logger.debug(`Instance: ${instance.id} (ALM: ${instance.almId}) - ${instance.name} (${instance.state})`);
      });
      
      return instances;
    } else {
      logger.error(`Failed to fetch course instances: ${response.status} ${response.statusText}`);
      return [];
    }
  } catch (error) {
    logger.error('Error fetching course instances:', error);
    return [];
  }
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return text;
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

module.exports = { main }
