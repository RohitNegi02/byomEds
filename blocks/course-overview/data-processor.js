// Data Processor for Course Overview
// Handles data extraction and processing from API responses

const { i18n } = window.alm;

// Extract author names from API data
function extractAuthorNames(learnerData) {
  let authorNames = i18n.translations['alm.overview.unknownauthor'] || 'Unknown Author';

  if (learnerData && learnerData.data) {
    const { attributes, relationships } = learnerData.data;
    if (attributes && attributes.authorNames
      && attributes.authorNames.length > 0) {
      authorNames = attributes.authorNames.join(', ');
    } else if (attributes && attributes.authorDetails
      && attributes.authorDetails.length > 0) {
      authorNames = attributes.authorDetails
        .map((author) => author.authorName).join(', ');
    } else if (relationships && relationships.authors) {
      const authors = learnerData.data.relationships.authors.data;
      const authorNamesList = authors.map((authorRef) => {
        const authorData = learnerData.included.find((item) => item.type === 'user' && item.id === authorRef.id);
        return authorData ? authorData.attributes.name : null;
      }).filter((name) => name !== null);

      if (authorNamesList.length > 0) {
        authorNames = authorNamesList.join(', ');
      }
    }
  }

  return authorNames;
}

// Extract skills from API data
function extractSkillsData(learnerData) {
  let skillsHtml = '';

  if (!learnerData || !learnerData.included) {
    return skillsHtml;
  }

  // Get all learningObjectSkill items from included array
  const learningObjectSkills = learnerData.included.filter((item) => item.type === 'learningObjectSkill');

  console.log('Found learningObjectSkills:', learningObjectSkills);

  learningObjectSkills.forEach((skillObj) => {
    console.log('Processing skillObj:', skillObj);

    if (skillObj.relationships && skillObj.relationships.skillLevel
      && skillObj.relationships.skillLevel.data) {
      const skillLevelId = skillObj.relationships.skillLevel.data.id;
      console.log('Looking for skillLevel:', skillLevelId);

      const skillLevel = learnerData.included.find(
        (item) => item.type === 'skillLevel'
          && item.id === skillLevelId,
      );

      console.log('Found skillLevel:', skillLevel);

      if (skillLevel && skillLevel.relationships
        && skillLevel.relationships.skill
        && skillLevel.relationships.skill.data) {
        const skillId = skillLevel.relationships.skill.data.id;
        console.log('Looking for skill:', skillId);

        const skill = learnerData.included.find((item) => item.type === 'skill' && item.id === skillId);

        console.log('Found skill:', skill);

        if (skill && skillLevel && skillObj) {
          const skillName = skill.attributes.name;
          const skillLevelNum = skillLevel.attributes.level;
          const { credits } = skillObj.attributes;

          console.log(`Adding skill: ${skillName} - Level ${skillLevelNum} (${credits} Credits)`);
          const levelLabel = i18n.translations['alm.overview.level'] || 'Level';
          const creditsLabel = i18n.translations['alm.overview.credits'] || 'Credits';
          skillsHtml += `${skillName} - ${levelLabel} ${skillLevelNum} (${credits} ${creditsLabel})<br>`;
        }
      }
    }
  });

  console.log('Final skillsHtml:', skillsHtml);
  return skillsHtml;
}

// Extract enrollment data
function extractEnrollmentData(learnerData) {
  const isEnrolled = learnerData && learnerData.data
                    && learnerData.data.relationships
                    && learnerData.data.relationships.enrollment;

  if (!isEnrolled) {
    return {
      isEnrolled: false,
      progressPercent: 0,
      enrollmentData: null,
      resourceGrades: [],
      moduleResources: [],
      completedModules: 0,
      currentRating: 0,
    };
  }

  const enrollId = learnerData.data.relationships.enrollment.data.id;
  const enrollmentData = learnerData.included.find(
    (item) => item.type === 'learningObjectInstanceEnrollment'
      && item.id === enrollId,
  );

  const progressPercent = enrollmentData
    ? enrollmentData.attributes.progressPercent : 0;

  const currentRating = (enrollmentData
    && enrollmentData.attributes
    && enrollmentData.attributes.rating)
    ? enrollmentData.attributes.rating : 0;

  const attrs = learnerData.data && learnerData.data.attributes;
  const unenrollmentAllowed = (attrs
    && attrs.unenrollmentAllowed) || false;

  console.log('Current rating from API:', currentRating);
  console.log('Unenrollment allowed:', unenrollmentAllowed);

  // Get module completion data from resource grades
  const resourceGrades = learnerData.included.filter((item) => item.type === 'learningObjectResourceGrade');

  // Get actual modules from API data
  const enrolledInstance = learnerData.included.find((item) => item.type === 'learningObjectInstance'
    && item.relationships
    && item.relationships.enrollment);

  const moduleResources = enrolledInstance
    ? enrolledInstance.relationships.loResources.data : [];

  // Calculate completed modules
  const completedModules = resourceGrades.filter((grade) => grade.attributes.completed).length;

  return {
    isEnrolled: true,
    progressPercent,
    enrollmentData,
    resourceGrades,
    moduleResources,
    completedModules,
    currentRating,
    unenrollmentAllowed,
  };
}

// Process module data for enrolled users
function processModuleData(moduleResources, resourceGrades, learnerData, cdnModules) {
  return moduleResources.map((moduleRef, index) => {
    const moduleResource = learnerData.included.find(
      (item) => item.type === 'learningObjectResource'
        && item.id === moduleRef.id,
    );
    const resourceGrade = resourceGrades.find(
      (grade) => grade.relationships.loResource.data.id
        === moduleRef.id,
    );

    if (!moduleResource) return null;

    const { currentLocale } = i18n;
    const locMeta = (currentLocale
      && moduleResource.attributes.localizedMetadata?.find(
        (m) => m.locale === currentLocale,
      ))
      || moduleResource.attributes.localizedMetadata?.[0];
    const moduleName = locMeta?.name || moduleResource.attributes.name || '';
    const isCompleted = resourceGrade ? resourceGrade.attributes.completed : false;
    const hasStarted = resourceGrade && resourceGrade.attributes.progressPercent > 0;
    // Get the loResourceType to determine if this is a testout module
    const { loResourceType } = moduleResource.attributes;

    // Get resource details for duration and type
    const resData = moduleResource.relationships.resources;
    const resource = resData
      ? learnerData.included.find(
        (item) => item.type === 'resource'
          && item.id === resData.data[0].id,
      ) : null;

    let duration = cdnModules[index]?.duration || 'N/A';
    if (resource && resource.attributes.desiredDuration) {
      const mins = Math.floor(
        resource.attributes.desiredDuration / 60,
      );
      duration = `${mins} mins`;
    } else if (resource) {
      duration = '0 mins';
    }

    const contentType = resource ? resource.attributes.contentType : 'Content';

    // Determine status based on completion and progress
    let statusText = '';
    let statusIcon = '';
    let statusClass = '';

    if (isCompleted) {
      statusText = i18n.translations['alm.overview.lastvisited'] || 'Last Visited';
      statusIcon = '✓';
      statusClass = 'completed';
    } else if (hasStarted) {
      statusText = i18n.translations['alm.overview.inprogress'] || 'In Progress';
      statusIcon = '⏱️';
      statusClass = 'in-progress';
    } else {
      statusText = '';
      statusIcon = '';
      statusClass = '';
    }

    // Map content types to icons
    let moduleIcon = '📖';
    if (contentType === 'QUIZ') moduleIcon = '✓';
    else if (contentType === 'PDF') moduleIcon = '📄';
    else if (contentType === 'VIDEO') moduleIcon = '▶️';
    else if (contentType === 'Activity') moduleIcon = '🔧';

    // Use different icon for testout modules
    if (loResourceType === 'Test Out') {
      moduleIcon = '✖️'; // X icon for testout as shown in screenshot
    }

    return {
      id: moduleRef.id,
      name: moduleName,
      duration,
      contentType,
      loResourceType,
      statusText,
      statusIcon,
      statusClass,
      moduleIcon,
      isCompleted,
      hasStarted,
    };
  }).filter((module) => module !== null);
}

// Filter modules by type
function filterModulesByType(processedModules, type) {
  if (type === 'testout') {
    return processedModules.filter((module) => module.loResourceType === 'Test Out');
  }
  // Regular modules (exclude Test Out)
  return processedModules.filter((module) => module.loResourceType !== 'Test Out');
}

// Export functions
export {
  extractAuthorNames,
  extractSkillsData,
  extractEnrollmentData,
  processModuleData,
  filterModulesByType,
};
