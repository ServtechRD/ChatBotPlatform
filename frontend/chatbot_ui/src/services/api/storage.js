function clearAuthData() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('assistantsData');
}

function getUserId() {
  const userData = localStorage.getItem('userData');
  if (userData) {
    return JSON.parse(userData).user_id;
  }
  return null;
}

function getUserEmail() {
  const userData = localStorage.getItem('userData');
  if (userData) {
    return JSON.parse(userData).email;
  }
  return null;
}

function getUserName() {
  const userData = localStorage.getItem('userData');
  if (userData) {
    return JSON.parse(userData).name ?? '';
  }
  return '';
}

function formatWorkspaceTitle() {
  const email = getUserEmail() || 'default';
  const name = (getUserName() || '').trim();
  if (name) {
    return `${name}(${email})'s Workspace`;
  }
  return `${email}'s Workspace`;
}

function getUserAssistants() {
  const userData = localStorage.getItem('userData');
  if (userData) {
    return JSON.parse(userData).assistants;
  }
  return null;
}

function setUserData(userData) {
  localStorage.setItem('userData', JSON.stringify(userData));
  window.dispatchEvent(
    new CustomEvent('userDataUpdated', { detail: userData })
  );
}

function setToken(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem('token', accessToken);
  }
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
}

export const storage = {
  clearAuthData,
  getUserId,
  getUserEmail,
  getUserName,
  formatWorkspaceTitle,
  getUserAssistants,
  setUserData,
  setToken,
};
