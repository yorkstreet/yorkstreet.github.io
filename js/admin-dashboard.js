var monitorsRef = database.ref('monitors');
var controlRef = database.ref('control');
var monitorsOnline = {};
var presentationsCache = {};

function initDashboard() {
  setupMonitorListener();
  setupControlListener();
  setupColorPickers();
  loadPresentations();
  loadStats();
}

function loadStats() {
  firestore.collection('presentations').get().then(function(snap) {
    var presCount = snap.size;
    document.getElementById('stat-presentations').textContent = presCount;
    var totalSlides = 0;
    snap.forEach(function(doc) {
      var data = doc.data();
      if (data.slides) totalSlides += data.slides.length;
    });
    document.getElementById('stat-slides-total').textContent = totalSlides;
  }).catch(function() {});

  firestore.collection('presentations').onSnapshot(function(snap) {
    presentationsCache = {};
    snap.forEach(function(doc) {
      presentationsCache[doc.id] = doc.data();
    });
    updateActivePresentation();
    var presCount = snap.size;
    document.getElementById('stat-presentations').textContent = presCount;
    var totalSlides = 0;
    snap.forEach(function(doc) {
      var data = doc.data();
      if (data.slides) totalSlides += data.slides.length;
    });
    document.getElementById('stat-slides-total').textContent = totalSlides;
  });
}

function setupMonitorListener() {
  monitorsRef.on('value', function(snap) {
    monitorsOnline = {};
    var html = '';
    var onlineCount = 0;
    var totalCount = 0;
    if (snap.exists()) {
      snap.forEach(function(child) {
          totalCount++;
          var data = child.val();
          var key = child.key;
          var name = data.name || key;
          var status = data.status || 'offline';
        var lastSeen = data.lastSeen || 0;
        var isOnline = (status === 'online');
        if (isOnline) {
            onlineCount++;
            monitorsOnline[key] = data;
        }
        var timeAgo = '';
        if (lastSeen) {
          var diff = Date.now() - lastSeen;
          if (diff < 60000) timeAgo = 'Just now';
          else if (diff < 3600000) timeAgo = Math.floor(diff/60000) + 'm ago';
          else if (diff < 86400000) timeAgo = Math.floor(diff/3600000) + 'h ago';
          else timeAgo = Math.floor(diff/86400000) + 'd ago';
        }
        html += '<tr>' +
          '<td>' + escapeHtml(name) + '</td>' +
          '<td><span class="badge ' + (isOnline ? 'badge-online' : 'badge-offline') + '">' + escapeHtml(status) + '</span></td>' +
          '<td>' + escapeHtml(timeAgo) + '</td>' +
          '</tr>';
      });
    }
    document.getElementById('stat-monitors-online').textContent = onlineCount;
    document.getElementById('stat-monitors-total').textContent = totalCount;
    if (html) {
      document.getElementById('monitor-list-area').innerHTML =
        '<div class="table-container"><table><thead><tr><th>Name</th><th>Status</th><th>Last Seen</th></tr></thead><tbody>' + html + '</tbody></table></div>';
    } else {
      document.getElementById('monitor-list-area').innerHTML = '<div class="empty-state"><p>No monitors connected yet.</p></div>';
    }
  });
}

function setupControlListener() {
  controlRef.on('value', function(snap) {
    if (!snap.exists()) return;
    var data = snap.val();
    var isActive = data.active !== false;
    var btn = document.getElementById('btn-toggle-play');
    if (btn) btn.textContent = isActive ? 'Pause' : 'Play';
    updateActivePresentation();
  });
}

function updateActivePresentation() {
  controlRef.child('currentPresentationId').once('value', function(snap) {
    var presId = snap.val();
    var nameEl = document.getElementById('active-pres-name');
    if (presId && presentationsCache[presId]) {
      nameEl.textContent = presentationsCache[presId].name || presId;
    } else if (presId) {
      nameEl.textContent = presId;
    } else {
      nameEl.textContent = 'None';
    }
  });
  controlRef.child('currentSlideIndex').once('value', function(snap) {
    var idx = snap.val() || 0;
    document.getElementById('active-slide-info').textContent = (idx + 1) + ' / ?';
  });
}

function setupColorPickers() {
  var bg = document.getElementById('notif-bg');
  var bgLabel = document.getElementById('notif-bg-label');
  var text = document.getElementById('notif-text');
  var textLabel = document.getElementById('notif-text-label');
  var preview = document.getElementById('notif-preview');

  if (bg) bg.addEventListener('input', function() {
    bgLabel.textContent = this.value;
    updatePreview();
  });
  if (text) text.addEventListener('input', function() {
    textLabel.textContent = this.value;
    updatePreview();
  });
  var msg = document.getElementById('notif-message');
  if (msg) msg.addEventListener('input', updatePreview);
}

function updatePreview() {
  var msg = document.getElementById('notif-message').value;
  var bg = document.getElementById('notif-bg').value;
  var text = document.getElementById('notif-text').value;
  var preview = document.getElementById('notif-preview');
  if (msg) {
    preview.style.display = 'block';
    preview.style.background = bg;
    preview.style.color = text;
    preview.textContent = msg;
  } else {
    preview.style.display = 'none';
  }
}

function sendNotification(e) {
  e.preventDefault();
  var msg = document.getElementById('notif-message').value.trim();
  var bg = document.getElementById('notif-bg').value;
  var text = document.getElementById('notif-text').value;
  var pos = document.getElementById('notif-position').value;
  var statusEl = document.getElementById('notif-status');

  if (!msg) {
    statusEl.innerHTML = '<div class="alert alert-error">Enter a notification message.</div>';
    return;
  }

  controlRef.child('notification').set({
    active: true,
    message: msg,
    bgColor: bg,
    textColor: text,
    position: pos,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  }).then(function() {
    statusEl.innerHTML = '<div class="alert alert-success">Notification sent!</div>';
    setTimeout(function() { statusEl.innerHTML = ''; }, 3000);
  }).catch(function(err) {
    statusEl.innerHTML = '<div class="alert alert-error">' + escapeHtml(err.message) + '</div>';
  });
}

function clearNotification() {
  controlRef.child('notification').update({ active: false, timestamp: firebase.database.ServerValue.TIMESTAMP }).then(function() {
    document.getElementById('notif-status').innerHTML = '<div class="alert alert-info">Notification cleared.</div>';
    setTimeout(function() { document.getElementById('notif-status').innerHTML = ''; }, 2000);
  });
}

function setEmbedOverride(e) {
  e.preventDefault();
  var url = document.getElementById('embed-url').value.trim();
  var statusEl = document.getElementById('embed-status');

  if (!url) {
    statusEl.innerHTML = '<div class="alert alert-error">Enter a URL.</div>';
    return;
  }
  if (!validateUrl(url)) {
    statusEl.innerHTML = '<div class="alert alert-error">Enter a valid http or https URL.</div>';
    return;
  }

  controlRef.child('embedOverride').set({
    active: true,
    url: url,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  }).then(function() {
    statusEl.innerHTML = '<div class="alert alert-success">Embed activated! Monitors will now display this page.</div>';
    setTimeout(function() { statusEl.innerHTML = ''; }, 4000);
  }).catch(function(err) {
    statusEl.innerHTML = '<div class="alert alert-error">' + escapeHtml(err.message) + '</div>';
  });
}

function clearEmbedOverride() {
  controlRef.child('embedOverride').update({ active: false, timestamp: firebase.database.ServerValue.TIMESTAMP }).then(function() {
    document.getElementById('embed-status').innerHTML = '<div class="alert alert-info">Embed deactivated. Monitors will return to the presentation.</div>';
    setTimeout(function() { document.getElementById('embed-status').innerHTML = ''; }, 3000);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var prevBtn = document.getElementById('btn-prev-slide');
  var nextBtn = document.getElementById('btn-next-slide');
  var playBtn = document.getElementById('btn-toggle-play');

  if (prevBtn) prevBtn.addEventListener('click', function() {
    controlRef.child('currentSlideIndex').transaction(function(current) {
      return Math.max(0, (current || 0) - 1);
    });
  });

  if (nextBtn) nextBtn.addEventListener('click', function() {
    controlRef.child('currentSlideIndex').transaction(function(current) {
      return (current || 0) + 1;
    });
  });

  if (playBtn) playBtn.addEventListener('click', function() {
    controlRef.child('active').transaction(function(current) {
      return current === false;
    });
  });
});
