// Main Course Overview Module
// Orchestrates all components and handles the main decorate function

import { fetchLearnerCourseData, fetchCourseNotes } from './api-service.js';
import { getCourseIdFromUrl, extractDataFromCDN } from './ui-components.js';
import { 
  extractAuthorNames, 
  extractSkillsData, 
  extractEnrollmentData, 
  processModuleData,
  filterModulesByType 
} from './data-processor.js';
import { createCourseOverviewHTML } from './html-generator.js';
import { setupEventListeners, setupTabEventListeners } from './event-handlers.js';

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
    
    // Extract data from CDN HTML
    const cdnData = extractDataFromCDN(block);
    console.log('Extracted CDN data:', cdnData);
    
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
        cdnData.modules
      );
      
      // Filter modules by type
      regularModules = filterModulesByType(processedModules, 'regular');
      testoutModules = filterModulesByType(processedModules, 'testout');
      
      // Check if notes are available
      try {
        // Extract instanceId from learnerData
        let instanceId = null;
        
        if (learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.loInstance) {
          instanceId = learnerData.data.relationships.loInstance.data.id;
        } else if (learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.enrollment) {
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
      hasNotes
    );
    
    // Replace block content with new structure
    block.innerHTML = courseHTML;
    
    // Setup all event listeners
    setupEventListeners(block, courseId, learnerData);
    
    // Setup tab event listeners (only for enrolled users with tabs)
    if (enrollmentInfo.isEnrolled) {
      setupTabEventListeners(block, courseId, cdnData.courseTitle, learnerData, {
        regular: regularModules,
        testout: testoutModules,
        all: processedModules
      });
    }
    
    console.log('Course overview initialized successfully with modular architecture');
    
  } catch (error) {
    console.error('Error initializing course overview:', error);
  }
}
