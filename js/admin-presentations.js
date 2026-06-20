var presCollection = firestore.collection('presentations');
var mediaCollection = firestore.collection('media');
var editingId = null;

function createPresentation(e) {
  e.preventDefault();
  var name = document.getElementById('new-pres-name').value.trim();
  if (!name) return;

  presCollection.add({
    name: name,
    slides: [],
    isDefault: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    document.getElementById('new-pres-name').value = '';
    showStatus('Presentation "' + escapeHtml(name) + '" created.', 'success');
  }).catch(function(err) {
    showStatus('Error: ' + escapeHtml(err.message), 'error');
  });
}

function loadPresentations() {
  presCollection.orderBy('createdAt', 'desc').onSnapshot(function(snap) {
    var area = document.getElementById('pres-list-area');
    if (snap.empty) {
      area.innerHTML = '<div class="empty-state"><p>No presentations yet. Create one above.</p></div>';
      return;
    }
    var html = '<div class="presentation-list">';
    snap.forEach(function(doc) {
      var data = doc.data();
      var slideCount = data.slides ? data.slides.length : 0;
      html += '<div class="presentation-card">' +
        '<div class="info">' +
        '<div class="name">' + escapeHtml(data.name) +
        (data.isDefault ? ' <span class="badge-default">Default</span>' : '') +
        '</div>' +
        '<div class="meta">' + slideCount + ' slide' + (slideCount !== 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<div class="form-actions" style="margin:0;flex-shrink:0;">' +
        '<button class="btn btn-outline btn-sm" onclick="editPresentation(\'' + doc.id + '\')">Edit</button>' +
        '<button class="btn btn-outline btn-sm" onclick="activatePresentation(\'' + doc.id + '\')">Activate</button>' +
        '</div>' +
        '</div>';
    });
    html += '</div>';
    area.innerHTML = html;
  }, function(err) {
    document.getElementById('pres-list-area').innerHTML = '<div class="empty-state"><p>Error loading presentations.</p></div>';
  });
}

function editPresentation(id) {
  editingId = id;
  presCollection.doc(id).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    document.getElementById('edit-modal-title').textContent = 'Edit: ' + data.name;
    document.getElementById('edit-pres-id').value = id;
    document.getElementById('edit-pres-name').value = data.name;
    document.getElementById('edit-is-default').checked = data.isDefault || false;
    renderSlideList(data.slides || []);
    document.getElementById('edit-modal').style.display = 'flex';
  });
}

function renderSlideList(slides) {
  var list = document.getElementById('edit-slides-list');
  if (!slides.length) {
    list.innerHTML = '<div class="empty-state" style="padding:20px"><p>No slides yet. Add one below.</p></div>';
    return;
  }
  var html = '';
  slides.forEach(function(slide, i) {
    var typeIcon = slide.type === 'image' ? '&#128247;' : slide.type === 'video' ? '&#127909;' : '&#128279;';
    html += '<div class="slide-item" data-index="' + i + '">' +
      '<span class="slide-order">' + (i + 1) + '.</span>' +
      '<span class="slide-type">' + typeIcon + ' ' + (slide.type || 'unknown') + '</span>' +
      '<span class="slide-name">' + escapeHtml(slide.name || slide.url) + '</span>' +
      '<div class="slide-actions">' +
      '<button onclick="moveSlideUp(' + i + ')" title="Move up">&#9650;</button>' +
      '<button onclick="moveSlideDown(' + i + ')" title="Move down">&#9660;</button>' +
      '<button onclick="removeSlide(' + i + ')" title="Remove" style="color:var(--color-danger)">&#10005;</button>' +
      '</div>' +
      '</div>';
  });
  list.innerHTML = html;
}

function getCurrentSlides() {
  return JSON.parse(document.getElementById('edit-slides-list').dataset.slides || '[]');
}

function setCurrentSlides(slides) {
  document.getElementById('edit-slides-list').dataset.slides = JSON.stringify(slides);
  renderSlideList(slides);
}

function addImageSlide() {
  var url = prompt('Enter Cloudinary image URL (or upload in Media tab first):');
  if (!url || !url.trim()) return;
  url = url.trim();
  if (!validateUrl(url)) {
    showStatus('Please enter a valid URL.', 'error');
    return;
  }
  var slides = getCurrentSlides();
  var name = prompt('Give this slide a name:', 'Image ' + (slides.length + 1));
  slides.push({ type: 'image', url: url, name: name || 'Image' });
  setCurrentSlides(slides);
}

function addVideoSlide() {
  var url = prompt('Enter Cloudinary video URL (or upload in Media tab first):');
  if (!url || !url.trim()) return;
  url = url.trim();
  if (!validateUrl(url)) {
    showStatus('Please enter a valid URL.', 'error');
    return;
  }
  var slides = getCurrentSlides();
  var name = prompt('Give this slide a name:', 'Video ' + (slides.length + 1));
  slides.push({ type: 'video', url: url, name: name || 'Video' });
  setCurrentSlides(slides);
}

function addEmbedSlide() {
  var url = prompt('Enter the URL of the page to embed:');
  if (!url || !url.trim()) return;
  url = url.trim();
  if (!validateUrl(url)) {
    showStatus('Please enter a valid http or https URL.', 'error');
    return;
  }
  var slides = getCurrentSlides();
  var name = prompt('Give this slide a name:', 'Embed ' + (slides.length + 1));
  var duration = prompt('Duration in seconds (auto-advance):', '30');
  slides.push({ type: 'embed', url: url, name: name || 'Embed', duration: parseInt(duration) || 30 });
  setCurrentSlides(slides);
}

function moveSlideUp(index) {
  if (index <= 0) return;
  var slides = getCurrentSlides();
  var temp = slides[index];
  slides[index] = slides[index - 1];
  slides[index - 1] = temp;
  setCurrentSlides(slides);
}

function moveSlideDown(index) {
  var slides = getCurrentSlides();
  if (index >= slides.length - 1) return;
  var temp = slides[index];
  slides[index] = slides[index + 1];
  slides[index + 1] = temp;
  setCurrentSlides(slides);
}

function removeSlide(index) {
  if (!confirm('Remove this slide?')) return;
  var slides = getCurrentSlides();
  slides.splice(index, 1);
  setCurrentSlides(slides);
}

function savePresentation() {
  var id = document.getElementById('edit-pres-id').value;
  var name = document.getElementById('edit-pres-name').value.trim();
  var isDefault = document.getElementById('edit-is-default').checked;
  var slides = getCurrentSlides();

  if (!name) {
    showStatus('Enter a presentation name.', 'error');
    return;
  }

  var update = { name: name, slides: slides, isDefault: isDefault };

  presCollection.doc(id).update(update).then(function() {
    if (isDefault) {
      presCollection.where('isDefault', '==', true).get().then(function(snap) {
        var batch = firestore.batch();
        snap.forEach(function(doc) {
          if (doc.id !== id) {
            batch.update(doc.ref, { isDefault: false });
          }
        });
        batch.commit();
      });
    }
    closeEditModal();
    showStatus('Presentation saved.', 'success');
  }).catch(function(err) {
    showStatus('Error: ' + escapeHtml(err.message), 'error');
  });
}

function deletePresentation() {
  var id = document.getElementById('edit-pres-id').value;
  if (!id) return;
  if (!confirm('Permanently delete this presentation?')) return;
  presCollection.doc(id).delete().then(function() {
    closeEditModal();
    showStatus('Presentation deleted.', 'success');
  }).catch(function(err) {
    showStatus('Error: ' + escapeHtml(err.message), 'error');
  });
}

function activatePresentation(id) {
  presCollection.doc(id).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    database.ref('control').update({
      currentPresentationId: id,
      currentSlideIndex: 0,
      active: true,
      presentationChanged: firebase.database.ServerValue.TIMESTAMP
    }).then(function() {
      showStatus('Presentation "' + escapeHtml(data.name) + '" is now active on all monitors.', 'success');
    });
  });
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
  editingId = null;
}

function showStatus(msg, type) {
  var area = document.getElementById('status-area');
  area.innerHTML = '<div class="alert alert-' + type + '">' + msg + '</div>';
  setTimeout(function() { area.innerHTML = ''; }, 4000);
}
