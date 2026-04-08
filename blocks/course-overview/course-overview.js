// Main Course Overview Module
// Orchestrates all components and handles the main decorate function

import { fetchLearnerCourseData, fetchCourseNotes } from './api-service.js';
import { getCourseIdFromUrl, extractDataFromCDN, enrichWithLocalizedMetadata } from './ui-components.js';
import {
  extractAuthorNames,
  extractSkillsData,
  extractEnrollmentData,
  processModuleData,
  filterModulesByType,
} from './data-processor.js';
import { createCourseOverviewHTML } from './html-generator.js';
import { setupEventListeners, setupTabEventListeners } from './event-handlers.js';

const { i18n } = window.alm;

// Create a module item element using createElement
function createModuleItem(module) {
  const moduleItem = document.createElement('div');
  moduleItem.className = `module-item ${module.statusClass || ''}`;
  moduleItem.dataset.resourceId = module.id || module.resourceId;

  const moduleIcon = document.createElement('div');
  moduleIcon.className = 'module-icon';
  moduleIcon.textContent = module.moduleIcon || module.icon;

  const moduleContent = document.createElement('div');
  moduleContent.className = 'module-content';

  const moduleLeft = document.createElement('div');
  moduleLeft.className = 'module-left';

  const moduleHeader = document.createElement('div');
  moduleHeader.className = 'module-header';

  const moduleFormat = document.createElement('span');
  moduleFormat.className = 'module-format';
  moduleFormat.textContent = module.format || (i18n.translations['alm.overview.selfpaced'] || 'SELF PACED');

  moduleHeader.appendChild(moduleFormat);

  const moduleTitle = document.createElement('div');
  moduleTitle.className = 'module-title';

  const moduleName = document.createElement('h4');
  moduleName.className = 'module-name';
  moduleName.textContent = module.name || module.title;

  moduleTitle.appendChild(moduleName);
  moduleLeft.appendChild(moduleHeader);
  moduleLeft.appendChild(moduleTitle);

  const moduleMeta = document.createElement('div');
  moduleMeta.className = 'module-meta';

  const moduleDuration = document.createElement('span');
  moduleDuration.className = 'module-duration';
  moduleDuration.textContent = module.duration;

  moduleMeta.appendChild(moduleDuration);

  if (module.statusText) {
    const moduleStatus = document.createElement('span');
    moduleStatus.className = 'module-status';
    moduleStatus.innerHTML = `${module.statusIcon} ${module.statusText}`;
    moduleMeta.appendChild(moduleStatus);
  }

  moduleContent.appendChild(moduleLeft);
  moduleContent.appendChild(moduleMeta);

  moduleItem.appendChild(moduleIcon);
  moduleItem.appendChild(moduleContent);

  return moduleItem;
}

export default async function decorate(block) {
  try {
    console.log('=== COURSE OVERVIEW DECORATE FUNCTION STARTED ===');

    // Get course ID from meta tag or URL
    let courseId = document.querySelector('meta[name="course-id"]')?.content;
    if (courseId) {
      courseId = `course:${courseId}`;
    } else {
      courseId = getCourseIdFromUrl();
    }

    if (!courseId) {
      console.error('No course ID found in meta tag or URL');
      return;
    }

    console.log('Course ID extracted:', courseId);

    // Fetch learner-specific data
    const learnerData = await fetchLearnerCourseData(courseId);
    console.log('Learner data fetched:', learnerData);

    // Extract data from CDN HTML, then enrich with locale-aware API metadata
    const rawCdnData = extractDataFromCDN(block);
    const cdnData = enrichWithLocalizedMetadata(rawCdnData, learnerData);

    // Process all data
    const authorNames = extractAuthorNames(learnerData);
    const skillsHtml = extractSkillsData(learnerData);
    const enrollmentInfo = extractEnrollmentData(learnerData);

    // Process modules for enrolled users
    let processedModules = [];
    let regularModules = [];
    let testoutModules = [];
    let hasNotes = false;

    if (enrollmentInfo.isEnrolled) {
      processedModules = processModuleData(
        enrollmentInfo.moduleResources,
        enrollmentInfo.resourceGrades,
        learnerData,
        cdnData.modules,
      );

      // Filter modules by type
      regularModules = filterModulesByType(processedModules, 'regular');
      testoutModules = filterModulesByType(processedModules, 'testout');

      // Check if notes are available
      try {
        // Extract instanceId from learnerData
        let instanceId = null;

        const rels = learnerData?.data?.relationships;
        if (rels && rels.loInstance) {
          instanceId = rels.loInstance.data.id;
        } else if (rels && rels.enrollment) {
          const enrollmentData = learnerData.data.relationships.enrollment.data;
          if (enrollmentData.relationships && enrollmentData.relationships.loInstance) {
            instanceId = enrollmentData.relationships.loInstance.data.id;
          }
        }

        // Fallback: construct from courseId if we have enrollment
        if (!instanceId && courseId) {
          const baseCourseId = courseId.replace('course:', '');
          instanceId = `course:${baseCourseId}_13216648`;
        }

        if (instanceId) {
          const notesData = await fetchCourseNotes(courseId, instanceId);
          hasNotes = notesData && notesData.data && notesData.data.length > 0;
        }
      } catch (error) {
        console.log('Notes check failed, hiding notes tab:', error.message);
        hasNotes = false;
      }
    }

    // Generate HTML
    const courseHTML = createCourseOverviewHTML(
      cdnData,
      courseId,
      learnerData,
      authorNames,
      skillsHtml,
      enrollmentInfo,
      regularModules,
      testoutModules,
      hasNotes,
    );

    // Replace block content with new structure
    block.innerHTML = courseHTML;

    // Populate modules using createElement
    const modulesContainer = block.querySelector('[data-modules-container]');
    if (modulesContainer) {
      const containerType = modulesContainer.dataset.modulesContainer;

      if (containerType === 'enrolled' && processedModules) {
        processedModules.forEach((module) => {
          const moduleElement = createModuleItem(module);
          modulesContainer.appendChild(moduleElement);
        });
      } else if (containerType === 'non-enrolled' && cdnData.modules) {
        cdnData.modules.forEach((module) => {
          const moduleElement = createModuleItem(module);
          modulesContainer.appendChild(moduleElement);
        });
      }
    }

    // Setup all event listeners
    setupEventListeners(block, courseId, learnerData);

    // Setup tab event listeners (only for enrolled users with tabs)
    if (enrollmentInfo.isEnrolled) {
      setupTabEventListeners(block, courseId, cdnData.courseTitle, learnerData, {
        regular: regularModules,
        testout: testoutModules,
        all: processedModules,
      });
    }

    console.log('Course overview initialized successfully with modular architecture');
  } catch (error) {
    console.error('Error initializing course overview:', error);
  }
}
