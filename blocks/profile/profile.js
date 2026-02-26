// Profile Block - Displays user profile and skill interests
import { getAccessToken } from '../course-overview/api-service.js';

// Fetch user profile data
async function fetchUserProfile() {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://learningmanager.adobe.com/primeapi/v2/user`, {
      method: 'GET',
      headers: {
        'Authorization': `oauth ${accessToken}`,
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Fetch user skill interests
async function fetchUserSkillInterests(userId) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://learningmanager.adobe.com/primeapi/v2/users/${userId}/skillInterests?filter.skillInterestTypes=ADMIN_DEFINED&page%5Boffset%5D=0&page%5Blimit%5D=10&include=skill%2CuserSkills.skillLevel`, {
      method: 'GET',
      headers: {
        'Authorization': `oauth ${accessToken}`,
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching skill interests:', error);
    return null;
  }
}

// Fetch all available skills
async function fetchAllSkills() {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://learningmanager.adobe.com/primeapi/v2/skills?page%5Boffset%5D=0&page%5Blimit%5D=50`, {
      method: 'GET',
      headers: {
        'Authorization': `oauth ${accessToken}`,
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching all skills:', error);
    return null;
  }
}

// Add skill interests via API
async function addSkillInterests(userId, skillIds) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://learningmanager.adobe.com/primeapi/v2/users/${userId}/userSkillInterest`, {
      method: 'POST',
      headers: {
        'Authorization': `oauth ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(skillIds)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding skill interests:', error);
    throw error;
  }
}

// Generate profile HTML using createElement
function generateProfileHTML(userProfile, skillInterests) {
  const user = userProfile?.data;
  const userName = user?.attributes?.name || 'User Name';
  const userEmail = user?.attributes?.email || 'user@example.com';
  const userAvatar = user?.attributes?.avatarUrl || '';

  const container = document.createElement('div');
  container.className = 'profile-container';

  // Profile Header
  const profileHeader = document.createElement('div');
  profileHeader.className = 'profile-header';
  
  const profileTitle = document.createElement('h1');
  profileTitle.className = 'profile-title';
  profileTitle.textContent = 'Your Profile';
  profileHeader.appendChild(profileTitle);

  // User Info Section
  const userInfoSection = document.createElement('div');
  userInfoSection.className = 'user-info-section';

  const userAvatarDiv = document.createElement('div');
  userAvatarDiv.className = 'user-avatar';

  if (userAvatar) {
    const avatarImg = document.createElement('img');
    avatarImg.src = userAvatar;
    avatarImg.alt = 'Profile Picture';
    avatarImg.className = 'avatar-image';
    userAvatarDiv.appendChild(avatarImg);
  } else {
    const avatarPlaceholder = document.createElement('div');
    avatarPlaceholder.className = 'avatar-placeholder';
    avatarPlaceholder.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="40" fill="#e0e0e0"/>
        <circle cx="40" cy="30" r="12" fill="#999"/>
        <path d="M20 65c0-11 9-20 20-20s20 9 20 20" fill="#999"/>
      </svg>
    `;
    userAvatarDiv.appendChild(avatarPlaceholder);
  }

  const changeImageBtn = document.createElement('button');
  changeImageBtn.className = 'change-image-btn';
  changeImageBtn.textContent = 'Change image';
  userAvatarDiv.appendChild(changeImageBtn);

  const userDetails = document.createElement('div');
  userDetails.className = 'user-details';

  const userNameElem = document.createElement('h2');
  userNameElem.className = 'user-name';
  userNameElem.textContent = userName;

  const userEmailElem = document.createElement('p');
  userEmailElem.className = 'user-email';
  userEmailElem.textContent = userEmail;

  userDetails.appendChild(userNameElem);
  userDetails.appendChild(userEmailElem);

  userInfoSection.appendChild(userAvatarDiv);
  userInfoSection.appendChild(userDetails);

  // Skills Section
  const skillsSection = document.createElement('div');
  skillsSection.className = 'skills-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'section-title';
  sectionTitle.textContent = 'Your Areas of Interest';

  const sectionDescription = document.createElement('p');
  sectionDescription.className = 'section-description';
  sectionDescription.textContent = 'Select areas of interest. You will see recommendations based on your interest.';

  const skillsGrid = document.createElement('div');
  skillsGrid.className = 'skills-grid';

  // Process skill interests
  if (skillInterests && skillInterests.data && skillInterests.data.length > 0) {
    const skills = skillInterests.data.map(interest => {
      const skillId = interest.relationships?.skill?.data?.id;
      const skill = skillInterests.included?.find(item => 
        item.type === 'skill' && item.id === skillId
      );
      
      return {
        id: interest.id,
        skillId: skillId,
        name: skill?.attributes?.name || 'Unknown Skill'
      };
    });

    skills.forEach(skill => {
      const skillItem = document.createElement('div');
      skillItem.className = 'skill-interest-item';
      skillItem.dataset.skillId = skill.id;

      const skillName = document.createElement('span');
      skillName.className = 'skill-name';
      skillName.textContent = skill.name;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-skill-btn';
      deleteBtn.title = 'Remove from My interests';
      deleteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;

      const skillTooltip = document.createElement('div');
      skillTooltip.className = 'skill-tooltip';
      
      const tooltipContent = document.createElement('div');
      tooltipContent.className = 'tooltip-content';
      
      const tooltipTitle = document.createElement('h4');
      tooltipTitle.textContent = skill.name;
      
      const tooltipText = document.createElement('p');
      tooltipText.textContent = 'Added based on your learnings';
      
      tooltipContent.appendChild(tooltipTitle);
      tooltipContent.appendChild(tooltipText);
      
      const tooltipArrow = document.createElement('div');
      tooltipArrow.className = 'tooltip-arrow';
      
      skillTooltip.appendChild(tooltipContent);
      skillTooltip.appendChild(tooltipArrow);

      skillItem.appendChild(skillName);
      skillItem.appendChild(deleteBtn);
      skillItem.appendChild(skillTooltip);
      
      skillsGrid.appendChild(skillItem);
    });
  } else {
    const noSkills = document.createElement('div');
    noSkills.className = 'no-skills';
    
    const noSkillsText = document.createElement('p');
    noSkillsText.textContent = 'No skill interests found. Add some interests to see personalized recommendations.';
    noSkills.appendChild(noSkillsText);
    
    skillsGrid.appendChild(noSkills);
  }

  const profileActions = document.createElement('div');
  profileActions.className = 'profile-actions';

  const modifyBtn = document.createElement('button');
  modifyBtn.className = 'modify-interest-btn';
  modifyBtn.textContent = 'Modify Interest';
  profileActions.appendChild(modifyBtn);

  skillsSection.appendChild(sectionTitle);
  skillsSection.appendChild(sectionDescription);
  skillsSection.appendChild(skillsGrid);
  skillsSection.appendChild(profileActions);

  // Profile Footer
  const profileFooter = document.createElement('div');
  profileFooter.className = 'profile-footer';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-changes-btn';
  saveBtn.textContent = 'Save Changes';
  profileFooter.appendChild(saveBtn);

  // Assemble container
  container.appendChild(profileHeader);
  container.appendChild(userInfoSection);
  container.appendChild(skillsSection);
  container.appendChild(profileFooter);

  return container;
}

// Generate skill selection HTML using createElement
function generateSkillSelectionHTML(availableSkills) {
  const container = document.createElement('div');
  container.className = 'skill-selection-container';

  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'section-title';
  sectionTitle.textContent = 'Your Areas of Interest';

  const sectionDescription = document.createElement('p');
  sectionDescription.className = 'section-description';
  sectionDescription.textContent = 'Select areas of interest. You will see recommendations based on your interest.';

  const skillsGrid = document.createElement('div');
  skillsGrid.className = 'skills-grid';

  availableSkills.forEach(skill => {
    const skillItem = document.createElement('div');
    skillItem.className = 'skill-selection-item';
    skillItem.dataset.skillId = skill.id;

    const skillName = document.createElement('span');
    skillName.className = 'skill-name';
    skillName.textContent = skill.name;

    skillItem.appendChild(skillName);
    skillsGrid.appendChild(skillItem);
  });

  const skillSelectionActions = document.createElement('div');
  skillSelectionActions.className = 'skill-selection-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'add-interest-btn';
  addBtn.textContent = 'Add Interest';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-selection-btn';
  cancelBtn.textContent = 'Cancel';

  skillSelectionActions.appendChild(addBtn);
  skillSelectionActions.appendChild(cancelBtn);

  container.appendChild(sectionTitle);
  container.appendChild(sectionDescription);
  container.appendChild(skillsGrid);
  container.appendChild(skillSelectionActions);

  return container;
}

// Handle modify interest button click
async function handleModifyInterest(block) {
  try {
    // Show loading state
    const skillsSection = block.querySelector('.skills-section');
    skillsSection.innerHTML = '<div class="loading">Loading available skills...</div>';

    // Get current user skill interests
    const userId = block.dataset.userId;
    const currentSkillInterests = await fetchUserSkillInterests(userId);
    
    // Get all available skills
    const allSkills = await fetchAllSkills();
    
    if (!allSkills || !allSkills.data) {
      skillsSection.innerHTML = '<div class="error">Failed to load available skills.</div>';
      return;
    }

    // Get current skill IDs to filter out already subscribed skills
    const currentSkillIds = new Set();
    if (currentSkillInterests && currentSkillInterests.data) {
      currentSkillInterests.data.forEach(interest => {
        const skillId = interest.relationships?.skill?.data?.id;
        if (skillId) {
          currentSkillIds.add(skillId);
        }
      });
    }

    // Filter out already subscribed skills
    const availableSkills = allSkills.data
      .filter(skill => !currentSkillIds.has(skill.id))
      .map(skill => ({
        id: skill.id,
        name: skill.attributes?.name || 'Unknown Skill'
      }));

    // Generate and display skill selection HTML
    const selectionHTML = generateSkillSelectionHTML(availableSkills);
    skillsSection.innerHTML = '';
    skillsSection.appendChild(selectionHTML);

    // Setup skill selection event listeners
    setupSkillSelectionListeners(skillsSection, block);

  } catch (error) {
    console.error('Error in modify interest:', error);
    const skillsSection = block.querySelector('.skills-section');
    skillsSection.innerHTML = '<div class="error">Failed to load skills for modification.</div>';
  }
}

// Save user profile changes via API
async function saveUserProfile(userId, profileData) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const requestBody = {
      data: {
        type: "user",
        id: userId,
        attributes: profileData
      }
    };

    const response = await fetch(`https://learningmanager.adobe.com/primeapi/v2/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `oauth ${accessToken}`,
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
}

// Handle save changes button click
async function handleSaveChanges(block) {
  try {
    const userId = block.dataset.userId;
    const saveBtn = block.querySelector('.save-changes-btn');
    
    // Show loading state
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    // For now, we'll save with empty attributes since no profile fields are editable yet
    // In the future, this would collect changed profile data from form fields
    const profileData = {};
    
    // Save profile changes via API
    await saveUserProfile(userId, profileData);
    
    // Show success state
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 2000);
    
    console.log('Profile changes saved successfully');
    
  } catch (error) {
    console.error('Error saving profile changes:', error);
    
    // Reset button state on error
    const saveBtn = block.querySelector('.save-changes-btn');
    saveBtn.textContent = 'Save Changes';
    saveBtn.disabled = false;
    
    console.log('Failed to save profile changes. Please try again.');
  }
}

// Handle change image button click
function handleChangeImage() {
  // This would open a file picker or image upload modal
  console.log('Change Image functionality would be implemented here');
}

// Delete skill interest via API
async function deleteSkillInterest(userId, skillInterestId) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://learningmanager.adobe.com/primeapi/v2/users/${userId}/userSkillInterest/${skillInterestId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `oauth ${accessToken}`,
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting skill interest:', error);
    throw error;
  }
}

// Handle delete skill button click
async function handleDeleteSkill(skillInterestId, skillElement, userId) {
  try {
    const confirmDelete = confirm('Are you sure you want to remove this skill from your interests?');
    if (!confirmDelete) {
      return;
    }

    // Show loading state on the skill item
    skillElement.classList.add('deleting');
    
    // Make actual API call to delete the skill interest
    await deleteSkillInterest(userId, skillInterestId);

    // Remove the skill element from the DOM
    skillElement.remove();

    // Show success message
    console.log(`Skill interest ${skillInterestId} removed successfully`);

  } catch (error) {
    console.error('Error deleting skill:', error);
    skillElement.classList.remove('deleting');
    console.log('Failed to remove skill. Please try again.');
  }
}

// Setup skill selection event listeners
function setupSkillSelectionListeners(skillsSection, block) {
  const addInterestBtn = skillsSection.querySelector('.add-interest-btn');
  const cancelBtn = skillsSection.querySelector('.cancel-selection-btn');
  const skillItems = skillsSection.querySelectorAll('.skill-selection-item');

  // Handle skill item selection
  skillItems.forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('selected');
      
      // Update Add Interest button state
      const selectedSkills = skillsSection.querySelectorAll('.skill-selection-item.selected');
      if (addInterestBtn) {
        addInterestBtn.disabled = selectedSkills.length === 0;
        addInterestBtn.textContent = selectedSkills.length > 0 
          ? `Add Interest (${selectedSkills.length})` 
          : 'Add Interest';
      }
    });
  });

  // Handle Add Interest button
  if (addInterestBtn) {
    addInterestBtn.addEventListener('click', async () => {
      const selectedSkills = skillsSection.querySelectorAll('.skill-selection-item.selected');
      const selectedSkillIds = Array.from(selectedSkills).map(item => item.dataset.skillId);
      
      if (selectedSkillIds.length > 0) {
        await handleAddSkillInterests(selectedSkillIds, block);
      }
    });
  }

  // Handle Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      await reloadProfileView(block);
    });
  }
}

// Handle adding skill interests
async function handleAddSkillInterests(skillIds, block) {
  try {
    const userId = block.dataset.userId;
    const skillsSection = block.querySelector('.skills-section');
    
    // Show loading state
    skillsSection.innerHTML = '<div class="loading">Adding skill interests...</div>';
    
    // Add skill interests via API
    await addSkillInterests(userId, skillIds);
    
    // Reload the profile view to show updated interests
    await reloadProfileView(block);
    
    console.log(`Successfully added ${skillIds.length} skill interests`);
    
  } catch (error) {
    console.error('Error adding skill interests:', error);
    console.log('Failed to add skill interests. Please try again.');
    
    // Reload the profile view on error
    await reloadProfileView(block);
  }
}

// Reload the profile view
async function reloadProfileView(block) {
  try {
    const userId = block.dataset.userId;
    
    // Fetch updated skill interests
    const skillInterests = await fetchUserSkillInterests(userId);
    
    // Get user profile from existing data or fetch again
    const userProfile = await fetchUserProfile();
    
    // Regenerate the profile HTML
    const profileHTML = generateProfileHTML(userProfile, skillInterests);
    block.innerHTML = '';
    block.appendChild(profileHTML);
    
    // Setup event listeners again
    setupProfileEventListeners(block);
    
  } catch (error) {
    console.error('Error reloading profile view:', error);
    block.querySelector('.skills-section').innerHTML = '<div class="error">Failed to reload profile. Please refresh the page.</div>';
  }
}

// Setup event listeners
function setupProfileEventListeners(block) {
  const modifyBtn = block.querySelector('.modify-interest-btn');
  const saveBtn = block.querySelector('.save-changes-btn');
  const changeImageBtn = block.querySelector('.change-image-btn');

  if (modifyBtn) {
    modifyBtn.addEventListener('click', () => handleModifyInterest(block));
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => handleSaveChanges(block));
  }

  if (changeImageBtn) {
    changeImageBtn.addEventListener('click', handleChangeImage);
  }

  // Setup delete skill button listeners
  const deleteButtons = block.querySelectorAll('.delete-skill-btn');
  deleteButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      const skillElement = button.closest('.skill-interest-item');
      const skillInterestId = skillElement.dataset.skillId;
      
      // Get user ID from the block's data or fetch it
      const userId = block.dataset.userId;
      
      await handleDeleteSkill(skillInterestId, skillElement, userId);
    });
  });

  // Setup skill item hover listeners for tooltip
  const skillItems = block.querySelectorAll('.skill-interest-item');
  skillItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      const tooltip = item.querySelector('.skill-tooltip');
      if (tooltip) {
        tooltip.classList.add('visible');
      }
    });

    item.addEventListener('mouseleave', () => {
      const tooltip = item.querySelector('.skill-tooltip');
      if (tooltip) {
        tooltip.classList.remove('visible');
      }
    });
  });
}

// Main decorate function
export default async function decorate(block) {
  try {
    console.log('=== PROFILE BLOCK DECORATE FUNCTION STARTED ===');

    // Show loading state
    block.innerHTML = '<div class="loading">Loading profile...</div>';

    // Fetch user profile
    const userProfile = await fetchUserProfile();
    if (!userProfile) {
      block.innerHTML = '<div class="error">Failed to load profile. Please try again.</div>';
      return;
    }

    // Get user ID from profile data
    const userId = userProfile.data?.id;
    if (!userId) {
      block.innerHTML = '<div class="error">User ID not found.</div>';
      return;
    }

    // Fetch skill interests
    const skillInterests = await fetchUserSkillInterests(userId);

    // Generate and display HTML
    const profileHTML = generateProfileHTML(userProfile, skillInterests);
    block.innerHTML = '';
    block.appendChild(profileHTML);

    // Store user ID in block dataset for delete operations
    block.dataset.userId = userId;

    // Setup event listeners
    setupProfileEventListeners(block);

    console.log('Profile block initialized successfully');

  } catch (error) {
    console.error('Error initializing profile block:', error);
    block.innerHTML = '<div class="error">An error occurred while loading the profile.</div>';
  }
}
