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

function getUserAssistants() {
  const userData = localStorage.getItem('userData');
  if (userData) {
    return JSON.parse(userData).assistants;
  }
  return null;
}

function getAssistants() {
  const assistantsData = localStorage.getItem('assistantsData');
  if (assistantsData) {
    return JSON.parse(assistantsData);
  }
  return null;
}

/** @deprecated 拼字相容 */
function getAssistatns() {
  return getAssistants();
}

function setUserData(userData) {
  localStorage.setItem('userData', JSON.stringify(userData));
  window.dispatchEvent(
    new CustomEvent('userDataUpdated', { detail: userData })
  );
}

function setAssistantsData(assistants) {
  localStorage.setItem('assistantsData', JSON.stringify(assistants));
  window.dispatchEvent(
    new CustomEvent('assistantsDataUpdated', { detail: assistants })
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
  getUserAssistants,
  getAssistants,
  getAssistatns,
  setUserData,
  setAssistantsData,
  setToken,
};
