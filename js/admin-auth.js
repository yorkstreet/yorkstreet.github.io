function requireAdminAuth() {
  auth.onAuthStateChanged(function(user) {
    if (!user || !user.email) {
      window.location.href = 'login.html';
    }
  });
}

function getCurrentUser() {
  return auth.currentUser;
}

function logout() {
  auth.signOut().then(function() {
    window.location.href = 'login.html';
  });
}

function setupLogoutButton() {
  var btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', logout);
  }
}
