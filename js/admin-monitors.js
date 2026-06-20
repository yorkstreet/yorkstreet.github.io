var monitorRef = database.ref('monitors');
var presentations = {};

function initMonitors() {
  loadPresentations();
  setupMonitorsListener();
}

function loadPresentations() {
  firestore.collection('presentations').onSnapshot(function(snap) {
    presentations = {};
    snap.forEach(function(doc) {
      presentations[doc.id] = doc.data().name;
    });
    refreshMonitorTable();
  });
}

function setupMonitorsListener() {
  monitorRef.on('value', function(snap) {
    refreshMonitorTable();
  });
}

var cachedMonitorData = {};

function refreshMonitorTable() {
  monitorRef.once('value', function(snap) {
    cachedMonitorData = {};
    var html = '';
    var hasData = false;
    if (snap.exists()) {
      snap.forEach(function(child) {
        hasData = true;
        var data = child.val();
        var key = child.key;
        var displayName = data.name || key;
        cachedMonitorData[key] = data;
        var status = data.status || 'offline';
        var isOnline = (status === 'online');
        var lastSeen = data.lastSeen || 0;
        var timeAgo = '';
        if (lastSeen) {
          var diff = Date.now() - lastSeen;
          if (diff < 60000) timeAgo = 'Just now';
          else if (diff < 3600000) timeAgo = Math.floor(diff/60000) + 'm ago';
          else if (diff < 86400000) timeAgo = Math.floor(diff/3600000) + 'h ago';
          else timeAgo = Math.floor(diff/86400000) + 'd ago';
        }

        html += '<tr>' +
          '<td>' + escapeHtml(displayName) + '</td>' +
          '<td><span class="badge ' + (isOnline ? 'badge-online' : 'badge-offline') + '">' + escapeHtml(status) + '</span></td>' +
          '<td>' + escapeHtml(timeAgo) + '</td>' +
          '<td>' + buildPresDropdown(key, data.assignedPresentation) + '</td>' +
          '</tr>';
      });
    }
    if (hasData) {
      document.getElementById('monitors-table-area').innerHTML =
        '<div class="table-container"><table><thead><tr><th>Name</th><th>Status</th><th>Last Seen</th><th>Assigned Presentation</th></tr></thead><tbody>' + html + '</tbody></table></div>';
    } else {
      document.getElementById('monitors-table-area').innerHTML = '<div class="empty-state"><p>No monitors have connected yet. Open monitor.html on a display device.</p></div>';
    }
  });
}

function buildPresDropdown(monitorName, currentAssigned) {
  var html = '<select onchange="assignPresentation(\'' + escapeHtml(monitorName) + '\', this.value)" class="pres-select" style="min-width:160px">';
  html += '<option value="">— Default —</option>';
  for (var id in presentations) {
    var selected = (id === currentAssigned) ? ' selected' : '';
    html += '<option value="' + id + '"' + selected + '>' + escapeHtml(presentations[id]) + '</option>';
  }
  html += '</select>';
  return html;
}

function assignPresentation(monitorName, presId) {
  if (!presId) {
    firestore.collection('monitors').doc(monitorName).set({
      name: monitorName,
      assignedPresentation: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function() {
      showStatus('Assignment cleared for ' + escapeHtml(monitorName), 'success');
    });
  } else {
    firestore.collection('monitors').doc(monitorName).set({
      name: monitorName,
      assignedPresentation: presId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function() {
      showStatus('Assigned presentation to ' + escapeHtml(monitorName), 'success');
    });
  }
}

function showStatus(msg, type) {
  var area = document.getElementById('status-area');
  area.innerHTML = '<div class="alert alert-' + type + '">' + msg + '</div>';
  setTimeout(function() { area.innerHTML = ''; }, 4000);
}
