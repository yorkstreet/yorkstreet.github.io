var monitorName = '';
var monitorToken = '';
var monitorUid = null;
var currentSlides = [];
var localSlideIndex = 0;
var isActive = true;
var notificationData = null;
var embedOverrideData = null;
var slideTimer = null;
var heartbeatInterval = null;
var monitorRTDBRef = null;
var currentPresentationId = '';
var assignedPresentationId = null;

// Set up event listener for submit button
document.addEventListener('DOMContentLoaded', function() {
  var submitBtn = document.getElementById('submit-monitor-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitMonitorName);
  }
});

function init() {
  var saved = localStorage.getItem('ys_monitor_name');
  var savedToken = localStorage.getItem('ys_monitor_token');
  if (saved && savedToken) {
    monitorName = saved;
    monitorToken = savedToken;
    document.getElementById('name-modal').style.display = 'none';
    document.getElementById('monitor-container').style.display = 'block';
    document.getElementById('monitor-name-badge').textContent = saved;
    connectAndStart();
  }
}

function submitMonitorName() {
  var input = document.getElementById('monitor-name-input');
  var name = input.value.trim();
  var errorEl = document.getElementById('name-error');

  if (!name) {
    errorEl.textContent = 'Please enter a display name.';
    errorEl.style.display = 'block';
    return;
  }

  monitorName = name;
  monitorToken = generateToken();
  localStorage.setItem('ys_monitor_name', name);
  localStorage.setItem('ys_monitor_token', monitorToken);

  document.getElementById('name-modal').style.display = 'none';
  document.getElementById('monitor-container').style.display = 'block';
  document.getElementById('monitor-name-badge').textContent = name;
  connectAndStart();
}

function connectAndStart() {
  auth.signInAnonymously().then(function() {
    monitorUid = auth.currentUser ? auth.currentUser.uid : null;
    registerMonitor();
    setupAssignmentListener();
    setupControlListener();
    setupNotificationListener();
    setupEmbedListener();
    startHeartbeat();
  }).catch(function(err) {
    showError('Connection failed: ' + err.message);
  });
}

function registerMonitor() {
  if (!monitorUid) return;
  monitorRTDBRef = database.ref('monitors/' + monitorUid);
  monitorRTDBRef.set({
    name: monitorName,
    status: 'online',
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    token: monitorToken
  });
  monitorRTDBRef.onDisconnect().update({
    status: 'offline',
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
}

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(function() {
    if (monitorRTDBRef) {
      monitorRTDBRef.update({
        status: 'online',
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
    }
  }, 30000);
}

function getEffectivePresentationId() {
  return assignedPresentationId || currentPresentationId;
}

function setupAssignmentListener() {
  if (!monitorUid) return;
  firestore.collection('monitors').doc(monitorUid).onSnapshot(function(doc) {
    if (doc.exists) {
      assignedPresentationId = doc.data().assignedPresentation || null;
    } else {
      assignedPresentationId = null;
    }
    reloadPresentation();
  });
}

function setupControlListener() {
  database.ref('control').on('value', function(snap) {
    if (!snap.exists()) return;
    var data = snap.val();
    isActive = data.active !== false;
    var newGlobalPresId = data.currentPresentationId || '';
    var newSlideIndex = data.currentSlideIndex || 0;

    var changed = (currentPresentationId !== newGlobalPresId);
    currentPresentationId = newGlobalPresId;

    if (changed) {
      reloadPresentation();
      return;
    }

    localSlideIndex = newSlideIndex;
    if (!assignedPresentationId && currentSlides.length > 0) {
      showSlide(localSlideIndex);
    }
  });
}

function setupNotificationListener() {
  database.ref('control/notification').on('value', function(snap) {
    if (!snap.exists()) return;
    notificationData = snap.val();
    handleNotification();
  });
}

function setupEmbedListener() {
  database.ref('control/embedOverride').on('value', function(snap) {
    if (!snap.exists()) return;
    embedOverrideData = snap.val();
    handleEmbedOverride();
  });
}

function reloadPresentation() {
  var presId = getEffectivePresentationId();
  if (!presId) {
    showWaitingScreen();
    return;
  }
  firestore.collection('presentations').doc(presId).get().then(function(doc) {
    if (!doc.exists) {
      showWaitingScreen();
      return;
    }
    currentSlides = doc.data().slides || [];
    if (currentSlides.length === 0) {
      showWaitingScreen();
      return;
    }
    localSlideIndex = 0;
    if (embedOverrideData && embedOverrideData.active) {
      showEmbedFrame(embedOverrideData.url);
      return;
    }
    showSlide(localSlideIndex);
  }).catch(function() {
    showWaitingScreen();
  });
}

function showSlide(index) {
  if (slideTimer) {
    clearTimeout(slideTimer);
    slideTimer = null;
  }

  localSlideIndex = index;
  var slides = currentSlides;
  if (!slides || slides.length === 0) {
    showWaitingScreen();
    return;
  }

  if (index >= slides.length) index = 0;
  if (index < 0) index = 0;
  localSlideIndex = index;

  var slide = slides[index];
  var area = document.getElementById('content-area');
  var container = document.getElementById('monitor-container');

  container.className = 'monitor-container';
  if (notificationData && notificationData.active) {
    container.classList.add('notification-' + (notificationData.position || 'bottom'));
  }

  area.innerHTML = '';

  if (slide.type === 'image') {
    var img = document.createElement('img');
    img.src = slide.url;
    img.alt = slide.name || '';
    img.draggable = false;
    area.appendChild(img);
    scheduleNext(10000);
  } else if (slide.type === 'video') {
    var video = document.createElement('video');
    video.src = slide.url;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = false;
    area.appendChild(video);
    var vidIndex = index;
    video.addEventListener('ended', function() {
      advanceLocal(vidIndex);
    });
    video.addEventListener('error', function() {
      advanceLocal(vidIndex);
    });
    scheduleNext(60000);
  } else if (slide.type === 'embed') {
    showEmbedFrame(slide.url, area, false);
    var duration = (slide.duration || 30) * 1000;
    scheduleNext(duration);
  } else {
    area.innerHTML = '<div style="color:#fff;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:18px;">Unknown slide type</div>';
    scheduleNext(10000);
  }
}

function scheduleNext(delay) {
  if (slideTimer) clearTimeout(slideTimer);
  if (!isActive) return;
  slideTimer = setTimeout(function() {
    advanceLocal(localSlideIndex);
  }, delay);
}

function advanceLocal(currentIdx) {
  if (!isActive || currentSlides.length === 0) return;
  var nextIdx = currentIdx + 1;
  if (nextIdx >= currentSlides.length) nextIdx = 0;
  showSlide(nextIdx);
}

function showEmbedFrame(url, container, showFallbackImmediately) {
  if (!container) container = document.getElementById('content-area');
  container.innerHTML = '';

  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:100%;height:100%;position:relative;';

  var iframe = document.createElement('iframe');
  iframe.className = 'embed-frame';
  iframe.src = url;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
  iframe.loading = 'lazy';
  iframe.title = 'Embedded Content';
  wrapper.appendChild(iframe);

  var openBtn = document.createElement('a');
  openBtn.href = url;
  openBtn.target = '_blank';
  openBtn.rel = 'noopener';
  openBtn.textContent = 'Open in new tab';
  openBtn.style.cssText = 'position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.5);color:#fff;padding:6px 12px;border-radius:4px;font-size:12px;z-index:90;text-decoration:none;';
  openBtn.addEventListener('click', function(e) { e.stopPropagation(); });
  wrapper.appendChild(openBtn);

  container.appendChild(wrapper);

  if (showFallbackImmediately) {
    showEmbedFallback(url, container);
    return;
  }

  var timeoutId = setTimeout(function() {
    try {
      if (iframe.contentDocument) {
        if (iframe.contentDocument.readyState === 'complete' && (!iframe.contentDocument.body || iframe.contentDocument.body.innerHTML.trim().length < 50)) {
          showEmbedFallback(url, container);
        }
      }
    } catch(e) {
      showEmbedFallback(url, container);
    }
  }, 4000);

  iframe.addEventListener('load', function() {
    clearTimeout(timeoutId);
    try {
      if (iframe.contentDocument && iframe.contentDocument.body) {
        if (iframe.contentDocument.body.innerHTML.trim().length < 50) {
          showEmbedFallback(url, container);
        }
      }
    } catch(e) {
      showEmbedFallback(url, container);
    }
  });
}

function showEmbedFallback(url, container) {
  var fb = document.getElementById('embed-fallback');
  if (!fb) return;
  var clone = fb.cloneNode(true);
  clone.style.display = 'flex';
  clone.querySelector('a').href = url;
  var iframe = container.querySelector('.embed-frame');
  if (iframe) iframe.style.display = 'none';
  container.appendChild(clone);
}

function handleNotification() {
  var notifEl = document.getElementById('notification-bar');
  var msgEl = document.getElementById('notif-message');
  var tsEl = document.getElementById('notif-timestamp');
  var container = document.getElementById('monitor-container');

  if (!notificationData || !notificationData.active) {
    notifEl.style.display = 'none';
    container.className = 'monitor-container';
    return;
  }

  notifEl.style.display = 'flex';
  notifEl.style.background = notificationData.bgColor || '#d93025';
  notifEl.style.color = notificationData.textColor || '#ffffff';
  msgEl.textContent = notificationData.message || '';
  tsEl.textContent = notificationData.timestamp ? formatTimestamp(notificationData.timestamp) : '';

  container.className = 'monitor-container shrunk';
  container.classList.add('notification-' + (notificationData.position || 'bottom'));
}

function handleEmbedOverride() {
  var area = document.getElementById('content-area');

  if (embedOverrideData && embedOverrideData.active && embedOverrideData.url) {
    if (slideTimer) clearTimeout(slideTimer);
    slideTimer = null;
    showEmbedFrame(embedOverrideData.url, area, false);
  } else {
    if (currentSlides.length > 0) {
      showSlide(localSlideIndex);
    } else {
      showWaitingScreen();
    }
  }
}

function showWaitingScreen() {
  var area = document.getElementById('content-area');
  area.innerHTML = '<div class="empty-state" style="background:#111;color:#fff;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
    '<div class="spinner" style="border-top-color:#fff;border-color:rgba(255,255,255,.2);"></div>' +
    '<p style="margin-top:12px;font-size:16px;color:rgba(255,255,255,.6);">Waiting for presentation...</p>' +
    '</div>';
}

function showError(msg) {
  var area = document.getElementById('content-area');
  area.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#111;color:#e57373;padding:40px;text-align:center;font-size:16px;">' +
    escapeHtml(msg) + '</div>';
}

document.addEventListener('DOMContentLoaded', init);
