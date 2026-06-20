var mediaCollection = firestore.collection('media');

function openUploadWidget() {
  var widget = cloudinary.createUploadWidget({
    cloudName: APP_CONFIG.cloudinary.cloudName,
    uploadPreset: APP_CONFIG.cloudinary.uploadPreset,
    sources: ['local', 'url', 'camera'],
    multiple: true,
    maxFiles: 10,
    showPoweredBy: false,
    resourceType: 'auto'
  }, function(error, result) {
    if (!error && result && result.event === 'success') {
      saveMedia(result.info);
    }
  });
  widget.open();
}

function saveMedia(info) {
  var type = info.resource_type === 'video' ? 'video' : 'image';
  mediaCollection.add({
    type: type,
    url: info.secure_url,
    name: info.original_filename || 'Untitled',
    order: Date.now(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    showStatus('Media uploaded successfully: ' + escapeHtml(info.original_filename), 'success');
  }).catch(function(err) {
    showStatus('Error saving media: ' + escapeHtml(err.message), 'error');
  });
}

function loadMedia() {
  mediaCollection.orderBy('order', 'desc').onSnapshot(function(snap) {
    var area = document.getElementById('media-grid-area');
    if (snap.empty) {
      area.innerHTML = '<div class="empty-state"><p>No media uploaded yet. Click "Upload Media" to get started.</p></div>';
      return;
    }
    var html = '<div class="media-grid">';
    snap.forEach(function(doc) {
      var data = doc.data();
      var id = doc.id;
      var preview = '';
      if (data.type === 'video') {
        preview = '<video class="preview" src="' + escapeHtml(data.url) + '" muted preload="metadata"></video>';
      } else {
        preview = '<img class="preview" src="' + escapeHtml(data.url) + '" alt="' + escapeHtml(data.name) + '" loading="lazy">';
      }
      html += '<div class="media-item" data-id="' + id + '">' +
        '<div class="actions">' +
        '<button onclick="deleteMedia(\'' + id + '\')" title="Delete">&#10005;</button>' +
        '</div>' +
        preview +
        '<div class="info">' +
        '<div class="name">' + escapeHtml(data.name) + '</div>' +
        '<div class="type">' + escapeHtml(data.type) + '</div>' +
        '</div>' +
        '</div>';
    });
    html += '</div>';
    area.innerHTML = html;
  }, function(err) {
    document.getElementById('media-grid-area').innerHTML = '<div class="empty-state"><p>Error loading media.</p></div>';
  });
}

function deleteMedia(id) {
  if (!confirm('Delete this media? It will be removed from all presentations that use it.')) return;
  mediaCollection.doc(id).delete().then(function() {
    showStatus('Media deleted.', 'success');
  }).catch(function(err) {
    showStatus('Error: ' + escapeHtml(err.message), 'error');
  });
}

function showStatus(msg, type) {
  var area = document.getElementById('status-area');
  area.innerHTML = '<div class="alert alert-' + type + '">' + msg + '</div>';
  setTimeout(function() { area.innerHTML = ''; }, 4000);
}
