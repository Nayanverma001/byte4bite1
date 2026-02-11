/**
 * FoodCycle — Single-page router and view logic
 * All views live in index.html; this script switches between them.
 */
(function() {
  'use strict';

  var currentView = 'landing';
  var currentChat = { foodId: null, buyerContact: null };
  var viewHistory = [];
  var showView;

  function saveDraftFromForm() {
    var form = document.getElementById('donorForm');
    var imgEl = document.getElementById('selectedImageUrl');
    if (!form || !imgEl) return;
    saveDraftListing({
      foodName: form.foodName.value,
      quantity: form.quantity.value,
      location: form.location.value,
      expiryDate: form.expiryDate.value,
      expiryTime: form.expiryTime.value,
      description: form.description.value,
      foodType: (form.querySelector('input[name="foodType"]:checked') || {}).value,
      imageUrl: imgEl.value
    });
  }

  function openChat(foodId, buyerContact) {
    currentChat = { foodId: foodId, buyerContact: buyerContact || (getCurrentRole() === 'buyer' ? (getCurrentUser() && getCurrentUser().contact) : '') };
    // Mark notifications as read when donor opens a chat
    if (typeof markNotificationsRead === 'function' && getCurrentRole() === 'donor') {
      markNotificationsRead();
    }
    viewHistory.push(currentView);
    currentView = 'chat';
    document.querySelectorAll('.view').forEach(function(el) {
      el.style.display = el.id === 'view-chat' ? 'block' : 'none';
    });
    document.body.classList.remove('landing');
    document.getElementById('siteHeader').style.display = 'none';
    if (window._chatHeaderEl) {
      window._chatHeaderEl.style.display = '';
      var food = getFoodById(foodId);
      var user = getCurrentUser();
      var role = getCurrentRole();
      var otherName = role === 'donor' ? (getInterestsForFood(foodId).find(function(i) { return i.buyerContact === currentChat.buyerContact; }) || {}).buyerName : (food && food.donorName);
      window._chatHeaderEl.querySelector('.chat-header-title').textContent = (food ? food.foodName : 'Food') + ' — ' + (otherName || (role === 'donor' ? 'Buyer' : 'Donor'));
    }
    renderChat();
  }

  function renderLanding() {}

  function renderLogin() {
    var role = getCurrentRole();
    if (!role) {
      showView('landing');
      return;
    }
    document.getElementById('loginTitle').textContent = 'Sign in';
    document.getElementById('loginSub').textContent = role === 'donor'
      ? 'List your surplus food and help someone in need.'
      : 'Find surplus food near you.';
    document.getElementById('loginAlert').classList.add('hidden');
  }

  function renderDonor() {
    var user = getCurrentUser();
    var role = getCurrentRole();
    if (!user || role !== 'donor') {
      showView('landing');
      return;
    }
    document.getElementById('donorName').textContent = user.name || 'Donor';

    var unread = getNotifications().filter(function(n) { return !n.read; });
    var area = document.getElementById('notificationArea');
    var panel = document.getElementById('notificationsPanel');
    var list = document.getElementById('notificationsList');
    if (unread.length === 0) {
      area.innerHTML = '';
      panel.style.display = 'none';
    } else {
      area.innerHTML = '<a href="#notificationsPanel" class="notification-bell" title="Notifications">' +
        '<svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
        '<span class="notification-bell-count">' + unread.length + '</span></a>';
      panel.style.display = 'block';
      list.innerHTML = unread.slice(0, 10).map(function(n) {
        return '<div class="notification-item">' +
          '<span>Someone is interested in <strong>' + (n.foodName || 'Food') + '</strong> — ' + (n.buyerName || 'Buyer') + '</span>' +
          ' <a href="#" class="link link-chat" data-open-chat data-food-id="' + (n.foodId || '') + '" data-buyer-contact="' + (n.buyerContact || '') + '">Chat</a>' +
          '</div>';
      }).join('');
    }

    var allMy = getMyListings(user.contact);
    var activeListings = allMy.filter(function(f) { return getSafetyStatus(f) !== 'expired'; });
    var expiredListings = allMy.filter(function(f) { return getSafetyStatus(f) === 'expired'; });

    var myPanel = document.getElementById('myListingsPanel');
    var myGrid = document.getElementById('myListingsGrid');
    if (activeListings.length > 0) {
      myPanel.style.display = 'block';
      myGrid.innerHTML = activeListings.slice(0, 8).map(function(f) {
        var img = f.imageUrl || (PRESET_FOOD_IMAGES[0] && PRESET_FOOD_IMAGES[0].url);
        return '<div class="listing-mini-card">' +
          '<img src="' + img + '" alt="">' +
          '<div><strong>' + (f.foodName || 'Food') + '</strong><br><span class="text-muted">' + (f.location || '') + ' · ' + (getInterestsForFood(f.id).length) + ' interest(s)</span></div>' +
          '</div>';
      }).join('');
    } else {
      myPanel.style.display = 'none';
      myGrid.innerHTML = '';
    }

    var outPanel = document.getElementById('outOfStockPanel');
    var outGrid = document.getElementById('outOfStockGrid');
    if (expiredListings.length > 0) {
      outPanel.style.display = 'block';
      outGrid.innerHTML = expiredListings.slice(0, 8).map(function(f) {
        var img = f.imageUrl || (PRESET_FOOD_IMAGES[0] && PRESET_FOOD_IMAGES[0].url);
        return '<div class="listing-mini-card">' +
          '<img src="' + img + '" alt="">' +
          '<div><strong>' + (f.foodName || 'Food') + '</strong><br><span class="text-muted">' + (f.location || '') + '</span></div>' +
          '</div>';
      }).join('');
    } else {
      outPanel.style.display = 'none';
      outGrid.innerHTML = '';
    }

    var convos = getConversationsForDonor(user.contact);
    if (convos.length > 0) {
      document.getElementById('chatsPanel').style.display = 'block';
      document.getElementById('chatsPreviewList').innerHTML = convos.slice(0, 5).map(function(c) {
        return '<a href="#" class="chat-preview" data-open-chat data-food-id="' + c.foodId + '" data-buyer-contact="' + (c.buyerContact || '') + '">' +
          '<span class="chat-preview-food">' + (c.foodName || 'Food') + '</span>' +
          '<span class="chat-preview-user">' + (c.buyerName || 'Buyer') + '</span>' +
          '</a>';
      }).join('');
    } else {
      document.getElementById('chatsPanel').style.display = 'none';
    }

    if (!window._donorPresetDone) {
      window._donorPresetDone = true;
      var presetEl = document.getElementById('presetImages');
      presetEl.innerHTML = '';
      PRESET_FOOD_IMAGES.forEach(function(p, idx) {
        var div = document.createElement('div');
        div.className = 'preset-img' + (idx === 0 ? ' selected' : '');
        div.dataset.url = p.url;
        div.innerHTML = '<img src="' + p.url + '" alt=""><span>' + p.label + '</span>';
        div.addEventListener('click', function() {
          document.querySelectorAll('.preset-img').forEach(function(el) { el.classList.remove('selected'); });
          this.classList.add('selected');
          document.getElementById('selectedImageUrl').value = this.dataset.url;
          saveDraftFromForm();
        });
        presetEl.appendChild(div);
      });
      document.getElementById('selectedImageUrl').value = (PRESET_FOOD_IMAGES[0] && PRESET_FOOD_IMAGES[0].url) || '';
      var quickEl = document.getElementById('quickFill');
      quickEl.innerHTML = '';
      QUICK_FILL_ITEMS.forEach(function(item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-fill-btn';
        btn.textContent = item.name;
        btn.addEventListener('click', function() {
          var form = document.getElementById('donorForm');
          form.foodName.value = item.name;
          form.quantity.value = item.quantity;
          var img = PRESET_FOOD_IMAGES[item.imageIndex];
          if (img) {
            document.getElementById('selectedImageUrl').value = img.url;
            document.querySelectorAll('.preset-img').forEach(function(el) {
              el.classList.toggle('selected', el.dataset.url === img.url);
            });
          }
          saveDraftFromForm();
        });
        quickEl.appendChild(btn);
      });
    }

    function restoreDraft() {
      var draft = getDraftListing();
      if (!draft) return;
      var form = document.getElementById('donorForm');
      if (draft.foodName) form.foodName.value = draft.foodName;
      if (draft.quantity) form.quantity.value = draft.quantity;
      if (draft.location) form.location.value = draft.location;
      if (draft.expiryDate) form.expiryDate.value = draft.expiryDate;
      if (draft.expiryTime) form.expiryTime.value = draft.expiryTime;
      if (draft.description) form.description.value = draft.description;
      if (draft.foodType) {
        var radio = form.querySelector('input[name="foodType"][value="' + draft.foodType + '"]');
        if (radio) radio.checked = true;
      }
      if (draft.imageUrl && document.querySelectorAll('.preset-img').length) {
        document.getElementById('selectedImageUrl').value = draft.imageUrl;
        document.querySelectorAll('.preset-img').forEach(function(el) {
          el.classList.toggle('selected', el.dataset.url === draft.imageUrl);
        });
      }
    }
    restoreDraft();
    var today = new Date().toISOString().split('T')[0];
    var dateInput = document.getElementById('expiryDate');
    if (dateInput) dateInput.setAttribute('min', today);
  }

  function renderBuyer() {
    var user = getCurrentUser();
    var role = getCurrentRole();
    if (!user || role !== 'buyer') {
      showView('landing');
      return;
    }
    if (window._buyerFilterFoods) window._buyerFilterFoods();
  }

  function renderChats() {
    var user = getCurrentUser();
    if (!user) {
      showView('landing');
      return;
    }
    var role = getCurrentRole();
    var isDonor = role === 'donor';
    var convos = isDonor ? getConversationsForDonor(user.contact) : getConversationsForBuyer(user.contact);
    var list = document.getElementById('chatsList');
    var empty = document.getElementById('chatsEmpty');
    if (convos.length === 0) {
      list.style.display = 'none';
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.style.display = 'block';
    list.innerHTML = convos.map(function(c) {
      var otherName = isDonor ? c.buyerName : c.donorName;
      var sub = isDonor ? 'Re: ' + (c.foodName || 'Food') : (c.foodName || 'Food');
      return '<a href="#" class="chat-list-item" data-open-chat data-food-id="' + c.foodId + '" data-buyer-contact="' + (isDonor ? (c.buyerContact || '') : '') + '">' +
        '<div class="chat-list-avatar">' + (otherName ? otherName.charAt(0).toUpperCase() : '?') + '</div>' +
        '<div class="chat-list-body">' +
          '<span class="chat-list-name">' + (otherName || 'Unknown') + '</span>' +
          '<span class="chat-list-preview">' + sub + '</span>' +
        '</div>' +
        '<span class="chat-list-arrow">→</span>' +
        '</a>';
    }).join('');
  }

  function renderChat() {
    var user = getCurrentUser();
    var role = getCurrentRole();
    var foodId = currentChat.foodId;
    var buyerContact = currentChat.buyerContact || (role === 'buyer' ? user.contact : '');
    if (!user || !foodId || !buyerContact) {
      showView('chats');
      return;
    }
    var conversationId = getConversationId(foodId, buyerContact);
    var food = getFoodById(foodId);
    var otherName = '';
    if (role === 'donor') {
      var interests = getInterestsForFood(foodId);
      var interest = interests.find(function(i) { return i.buyerContact === buyerContact; });
      otherName = interest ? interest.buyerName : 'Buyer';
    } else {
      otherName = food ? food.donorName : 'Donor';
    }
    var messagesEl = document.getElementById('chatMessages');
    var inputEl = document.getElementById('chatInput');
    var sendBtn = document.getElementById('sendBtn');
    function escapeHtml(s) {
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }
    function formatChatTime(iso) {
      var d = new Date(iso);
      var now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    function renderMessages() {
      var messages = getMessages(conversationId);
      messagesEl.innerHTML = messages.map(function(m) {
        var isMe = m.from === role;
        return '<div class="chat-bubble ' + (isMe ? 'chat-bubble-me' : 'chat-bubble-them') + '">' +
          '<span class="chat-bubble-sender">' + (isMe ? 'You' : m.senderName) + '</span>' +
          '<p class="chat-bubble-text">' + escapeHtml(m.text) + '</p>' +
          '<span class="chat-bubble-time">' + formatChatTime(m.createdAt) + '</span>' +
          '</div>';
      }).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    function sendMessage() {
      var text = (inputEl.value || '').trim();
      if (!text) return;
      addMessage(conversationId, role, user.name, text);
      inputEl.value = '';
      renderMessages();
    }
    sendBtn.onclick = sendMessage;
    inputEl.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    renderMessages();
  }

  // Chat view has its own header title — add it to header when in chat view
  function updateHeaderForChat() {
    if (currentView !== 'chat') return;
    var headerActions = document.getElementById('headerActions');
    var existing = document.querySelector('.chat-header-title');
    if (existing) return;
    var foodId = currentChat.foodId;
    var buyerContact = currentChat.buyerContact;
    var user = getCurrentUser();
    var role = getCurrentRole();
    var food = getFoodById(foodId);
    var otherName = '';
    if (role === 'donor') {
      var interests = getInterestsForFood(foodId);
      var interest = interests.find(function(i) { return i.buyerContact === buyerContact; });
      otherName = interest ? interest.buyerName : 'Buyer';
    } else {
      otherName = food ? food.donorName : 'Donor';
    }
    var span = document.createElement('span');
    span.className = 'chat-header-title';
    span.textContent = (food ? food.foodName : 'Food') + ' — ' + otherName;
    headerActions.insertBefore(span, headerActions.firstChild);
  }

  // Global nav: data-goto and data-open-chat
  document.addEventListener('click', function(e) {
    var link = e.target.closest('[data-goto]');
    if (link) {
      e.preventDefault();
      var view = link.getAttribute('data-goto');
      if (view) showView(view);
      return;
    }
    var chatTrigger = e.target.closest('[data-open-chat]');
    if (chatTrigger) {
      e.preventDefault();
      var fid = chatTrigger.getAttribute('data-food-id');
      var bc = chatTrigger.getAttribute('data-buyer-contact');
      if (getCurrentRole() === 'buyer') bc = (getCurrentUser() && getCurrentUser().contact) || bc;
      openChat(fid, bc);
    }
  });

  // Role cards: set role then go to login
  document.querySelectorAll('.role-card[data-role]').forEach(function(card) {
    card.addEventListener('click', function(e) {
      var role = this.getAttribute('data-role');
      if (role) localStorage.setItem(STORAGE_KEYS.role, role);
    });
  });

  // Logo → landing
  document.getElementById('logoLink').addEventListener('click', function(e) {
    e.preventDefault();
    viewHistory = [];
    showView('landing');
  });

  // Login form
  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var name = (document.getElementById('name').value || '').trim();
    var contact = (document.getElementById('contact').value || '').trim();
    var role = getCurrentRole();
    var alertEl = document.getElementById('loginAlert');
    if (!name || !contact) {
      alertEl.textContent = 'Please enter your name and phone or email.';
      alertEl.classList.remove('hidden');
      return;
    }
    alertEl.classList.add('hidden');
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ name: name, contact: contact, role: role }));
    showView(role === 'donor' ? 'donor' : 'buyer');
  });

  // Donor form
  document.getElementById('donorForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var user = getCurrentUser();
    var form = document.getElementById('donorForm');
    var foodTypeEl = form.querySelector('input[name="foodType"]:checked');
    var data = {
      foodName: form.foodName.value.trim(),
      foodType: foodTypeEl ? foodTypeEl.value : 'vegetarian',
      quantity: form.quantity.value.trim(),
      location: form.location.value.trim(),
      expiryDate: form.expiryDate.value,
      expiryTime: form.expiryTime.value,
      description: (form.description.value || '').trim(),
      donorName: user.name,
      donorContact: user.contact,
      imageUrl: (form.imageUrl && form.imageUrl.value) || (PRESET_FOOD_IMAGES[0] && PRESET_FOOD_IMAGES[0].url)
    };
    var errors = validateDonorForm(data);
    var errEl = document.getElementById('formError');
    if (errors.length > 0) {
      errEl.textContent = errors.join(' ');
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    addFood(data);
    clearDraftListing();
    document.getElementById('formPanel').classList.add('hidden');
    document.getElementById('thankYouSection').classList.remove('hidden');
    form.reset();
    document.getElementById('selectedImageUrl').value = (PRESET_FOOD_IMAGES[0] && PRESET_FOOD_IMAGES[0].url) || '';
    document.querySelectorAll('.preset-img').forEach(function(el, i) { el.classList.toggle('selected', i === 0); });
    var myPanel = document.getElementById('myListingsPanel');
    var myGrid = document.getElementById('myListingsGrid');
    var listings = getMyListings(user.contact).filter(function(f) { return getSafetyStatus(f) !== 'expired'; });
    if (listings.length > 0) {
      myPanel.style.display = 'block';
      myGrid.innerHTML = listings.slice(0, 8).map(function(f) {
        var img = f.imageUrl || (PRESET_FOOD_IMAGES[0] && PRESET_FOOD_IMAGES[0].url);
        return '<div class="listing-mini-card">' +
          '<img src="' + img + '" alt="">' +
          '<div><strong>' + (f.foodName || 'Food') + '</strong><br><span class="text-muted">' + (f.location || '') + ' · ' + (getInterestsForFood(f.id).length) + ' interest(s)</span></div>' +
          '</div>';
      }).join('');
    }
  });

  document.getElementById('listAnotherBtn').addEventListener('click', function() {
    document.getElementById('thankYouSection').classList.add('hidden');
    document.getElementById('formPanel').classList.remove('hidden');
  });

  document.getElementById('donorForm').addEventListener('input', function() {
    clearTimeout(window._draftTimer);
    window._draftTimer = setTimeout(function() {
      var form = document.getElementById('donorForm');
      var imgEl = document.getElementById('selectedImageUrl');
      if (!form || !imgEl) return;
      saveDraftListing({
        foodName: form.foodName.value,
        quantity: form.quantity.value,
        location: form.location.value,
        expiryDate: form.expiryDate.value,
        expiryTime: form.expiryTime.value,
        description: form.description.value,
        foodType: (form.querySelector('input[name="foodType"]:checked') || {}).value,
        imageUrl: imgEl.value
      });
    }, 500);
  });
  document.getElementById('donorForm').addEventListener('change', function() {
    var form = document.getElementById('donorForm');
    var imgEl = document.getElementById('selectedImageUrl');
    if (form && imgEl) saveDraftListing({
      foodName: form.foodName.value,
      quantity: form.quantity.value,
      location: form.location.value,
      expiryDate: form.expiryDate.value,
      expiryTime: form.expiryTime.value,
      description: form.description.value,
      foodType: (form.querySelector('input[name="foodType"]:checked') || {}).value,
      imageUrl: imgEl.value
    });
  });

  // Buyer: filter, sort, grid, toast, review modal
  var currentFilter = 'all';
  var currentSort = 'expiry';
  var selectedRating = 0;

  function showToast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
    el.classList.add('toast-visible');
    setTimeout(function() {
      el.classList.remove('toast-visible');
      setTimeout(function() { el.classList.add('hidden'); }, 300);
    }, 2500);
  }

  function getSafetyLabel(s) {
    return s === 'safe' ? 'Safe' : s === 'soon' ? 'Consume Soon' : 'Expired';
  }
  function getSafetyClass(s) {
    return s === 'safe' ? 'safety-safe' : s === 'soon' ? 'safety-soon' : 'safety-expired';
  }
  function foodTypeLabel(ft) {
    return ft === 'non-vegetarian' ? 'Non-veg' : 'Veg';
  }
  function foodTypeClass(ft) {
    return ft === 'non-vegetarian' ? 'food-type-badge non-veg' : 'food-type-badge veg';
  }
  function renderStars(avg) {
    if (avg == null) return '—';
    var full = Math.floor(avg);
    var half = (avg % 1) >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    var s = '';
    for (var i = 0; i < full; i++) s += '<span class="star filled">★</span>';
    if (half) s += '<span class="star half">★</span>';
    for (var i = 0; i < empty; i++) s += '<span class="star">★</span>';
    return s;
  }
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function openReviewModal(food) {
    document.getElementById('reviewFoodId').value = food.id;
    document.getElementById('reviewModalTitle').textContent = 'Reviews — ' + (food.foodName || 'Food');
    var reviews = getReviews(food.id);
    var avg = getAverageRating(food.id);
    document.getElementById('reviewsSummary').innerHTML =
      '<div class="reviews-avg">' +
        '<span class="reviews-avg-number">' + (avg != null ? avg.toFixed(1) : '—') + '</span>' +
        '<span class="reviews-avg-stars">' + renderStars(avg) + '</span>' +
        '<span class="reviews-avg-count">' + reviews.length + ' reviews</span>' +
      '</div>';
    document.getElementById('reviewsList').innerHTML = reviews.length === 0
      ? '<p class="text-muted">No reviews yet. Be the first to review!</p>'
      : reviews.slice().reverse().map(function(r) {
          return '<div class="review-card">' +
            '<div class="review-card-header">' +
              '<span class="review-card-name">' + (r.userName || 'Anonymous') + '</span>' +
              '<span class="review-card-stars">' + renderStars(r.rating) + '</span>' +
            '</div>' +
            (r.comment ? '<p class="review-card-comment">' + escapeHtml(r.comment) + '</p>' : '') +
            '<span class="review-card-date">' + formatDate(r.createdAt) + '</span>' +
            '</div>';
        }).join('');
    selectedRating = 0;
    document.getElementById('reviewRating').value = '0';
    document.getElementById('reviewComment').value = '';
    document.querySelectorAll('#starRating .star').forEach(function(star) {
      star.classList.remove('selected');
      star.classList.toggle('selected', Number(star.getAttribute('data-rating')) <= selectedRating);
    });
    document.getElementById('reviewModal').classList.remove('hidden');
  }

  function renderBuyerFoods(foods) {
    var user = getCurrentUser();
    var grid = document.getElementById('foodGrid');
    var empty = document.getElementById('emptyState');
    if (!grid) return;
    grid.innerHTML = '';
    if (!foods || foods.length === 0) {
      grid.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    grid.classList.remove('hidden');
    foods.forEach(function(food) {
      var status = getSafetyStatus(food);
      var card = document.createElement('div');
      card.className = 'food-card';
      var imgUrl = food.imageUrl || (PRESET_FOOD_IMAGES[0] && PRESET_FOOD_IMAGES[0].url) || '';
      var expiryStr = formatDate(food.expiryDate) + (food.expiryTime ? ' at ' + food.expiryTime : '');
      var foodType = food.foodType || 'vegetarian';
      var avgRating = getAverageRating(food.id);
      var reviewCount = getReviews(food.id).length;
      var saved = isSaved(food.id);
      card.innerHTML =
        '<div class="food-card-image-wrap">' +
          '<img class="food-card-image" src="' + imgUrl + '" alt="" loading="lazy">' +
          '<span class="' + foodTypeClass(foodType) + '">' + foodTypeLabel(foodType) + '</span>' +
          '<button type="button" class="card-save-btn ' + (saved ? 'saved' : '') + '" data-save aria-label="Save">♥</button>' +
        '</div>' +
        '<div class="food-card-body">' +
          '<h3 class="food-card-title">' + (food.foodName || 'Food') + '</h3>' +
          '<div class="food-card-location">📍 ' + (food.location || '—') + '</div>' +
          '<p class="food-card-meta">Qty: ' + (food.quantity || '—') + '</p>' +
          '<p class="food-card-expiry">⏱ ' + expiryStr + '</p>' +
          '<div class="food-card-rating" data-reviews>' +
            '<span class="rating-stars">' + renderStars(avgRating) + '</span>' +
            '<span class="rating-count">' + reviewCount + ' reviews</span>' +
          '</div>' +
          '<span class="safety-badge ' + getSafetyClass(status) + '">' + getSafetyLabel(status) + '</span>' +
          '<div class="food-card-actions">' +
            '<button type="button" class="btn btn-secondary btn-block" data-open-chat data-food-id="' + food.id + '" data-buyer-contact="">Message donor</button>' +
            '<button type="button" class="btn btn-primary btn-block" data-interest>I\'m Interested</button>' +
          '</div>' +
        '</div>';
      card.querySelector('[data-interest]').addEventListener('click', function() {
        addInterest(food.id, user.name, user.contact);
        showToast('Interest sent to donor.');
      });
      card.querySelector('[data-save]').addEventListener('click', function(e) {
        e.stopPropagation();
        var nowSaved = toggleSavedFood(food.id);
        this.classList.toggle('saved', nowSaved);
        showToast(nowSaved ? 'Saved for later.' : 'Removed from saved.');
      });
      card.querySelector('[data-reviews]').addEventListener('click', function() {
        openReviewModal(food);
      });
      var msgBtn = card.querySelector('[data-open-chat]');
      if (msgBtn) {
        msgBtn.addEventListener('click', function(e) {
          e.preventDefault();
          // Ensure an interest exists so conversation shows for both buyer and donor
          addInterest(food.id, user.name, user.contact);
          openChat(food.id, user.contact);
        });
      }
      grid.appendChild(card);
    });
  }

  function filterFoods() {
    var query = (document.getElementById('searchBar').value || '').trim().toLowerCase();
    var foods = getActiveFoods();
    if (currentFilter === 'saved') {
      var savedIds = getSavedFoodIds();
      foods = foods.filter(function(f) { return savedIds.indexOf(f.id) !== -1; });
    } else if (currentFilter !== 'all') {
      foods = foods.filter(function(f) { return (f.foodType || 'vegetarian') === currentFilter; });
    }
    if (query) {
      foods = foods.filter(function(f) {
        var name = (f.foodName || '').toLowerCase();
        var loc = (f.location || '').toLowerCase();
        var qty = (f.quantity || '').toLowerCase();
        return name.indexOf(query) !== -1 || loc.indexOf(query) !== -1 || qty.indexOf(query) !== -1;
      });
    }
    if (currentSort === 'expiry') {
      foods = foods.slice().sort(function(a, b) {
        var ha = getRemainingHours(a), hb = getRemainingHours(b);
        if (ha == null) return 1;
        if (hb == null) return -1;
        return ha - hb;
      });
    } else if (currentSort === 'newest') {
      foods = foods.slice().sort(function(a, b) {
        return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0));
      });
    } else if (currentSort === 'location') {
      foods = foods.slice().sort(function(a, b) {
        return (a.location || '').localeCompare(b.location || '');
      });
    }
    renderBuyerFoods(foods);
  }

  window._buyerFilterFoods = filterFoods;

  var searchBar = document.getElementById('searchBar');
  if (searchBar) searchBar.addEventListener('input', filterFoods);
  var sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.addEventListener('change', function() {
    currentSort = this.value;
    filterFoods();
  });
  document.querySelectorAll('#filterTabs .filter-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('#filterTabs .filter-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      currentFilter = this.getAttribute('data-filter');
      filterFoods();
    });
  });

  document.getElementById('reviewModalClose').addEventListener('click', function() {
    document.getElementById('reviewModal').classList.add('hidden');
  });
  document.getElementById('reviewModal').addEventListener('click', function(e) {
    if (e.target === this) document.getElementById('reviewModal').classList.add('hidden');
  });
  document.getElementById('reviewForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var foodId = document.getElementById('reviewFoodId').value;
    var rating = Number(document.getElementById('reviewRating').value) || 0;
    if (rating < 1) {
      alert('Please select a rating.');
      return;
    }
    var comment = document.getElementById('reviewComment').value.trim();
    addReview(foodId, getCurrentUser().name, rating, comment);
    showToast('Review submitted.');
    var food = getFoodById(foodId);
    if (food) openReviewModal(food);
    setTimeout(function() {
      document.getElementById('reviewModal').classList.add('hidden');
    }, 1500);
  });
  document.querySelectorAll('#starRating .star').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selectedRating = Number(this.getAttribute('data-rating'));
      document.getElementById('reviewRating').value = selectedRating;
      document.querySelectorAll('#starRating .star').forEach(function(s) {
        s.classList.toggle('selected', Number(s.getAttribute('data-rating')) <= selectedRating);
      });
    });
  });

  // Chat view header (shown only when in chat view)
  var chatHeader = document.createElement('div');
  chatHeader.className = 'site-header chat-header';
  chatHeader.style.display = 'none';
  chatHeader.innerHTML = '<div class="header-inner">' +
    '<a href="#" class="btn-back" data-goto="chats">← Back</a>' +
    '<span class="chat-header-title">Chat</span>' +
  '</div>';
  document.body.insertBefore(chatHeader, document.body.firstChild);
  window._chatHeaderEl = chatHeader;

  // Initial view
  function init() {
    if (typeof loadFromServer === 'function') {
      loadFromServer(doInit);
    } else {
      doInit();
    }
  }
  function doInit() {
    var user = getCurrentUser();
    var role = getCurrentRole();
    if (user && role === 'donor') {
      showView('donor');
      return;
    }
    if (user && role === 'buyer') {
      showView('buyer');
      return;
    }
    showView('landing');
  }

  showView = function(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach(function(el) {
      el.style.display = (el.id === 'view-' + name) ? 'block' : 'none';
    });
    var main = document.getElementById('main');
    main.className = '';
    if (name === 'landing') {
      document.body.classList.add('landing');
      document.getElementById('siteHeader').style.display = '';
      if (window._chatHeaderEl) window._chatHeaderEl.style.display = 'none';
    } else if (name === 'chat') {
      document.body.classList.remove('landing');
      document.getElementById('siteHeader').style.display = 'none';
      if (window._chatHeaderEl) window._chatHeaderEl.style.display = '';
    } else {
      document.body.classList.remove('landing');
      document.getElementById('siteHeader').style.display = '';
      if (window._chatHeaderEl) window._chatHeaderEl.style.display = 'none';
    }
    var back = document.getElementById('headerBack');
    var chats = document.getElementById('headerChats');
    back.style.display = (name === 'login' || name === 'donor' || name === 'buyer' || name === 'chats') ? 'inline-block' : 'none';
    chats.style.display = (name === 'donor' || name === 'buyer') ? 'inline-block' : 'none';
    if (name === 'chats') back.setAttribute('data-goto', getCurrentRole() === 'donor' ? 'donor' : 'buyer');
    else if (name === 'donor' || name === 'buyer') back.setAttribute('data-goto', 'login');
    else if (name === 'login') back.setAttribute('data-goto', 'landing');

    if (name === 'landing') renderLanding();
    else if (name === 'login') renderLogin();
    else if (name === 'donor') renderDonor();
    else if (name === 'buyer') renderBuyer();
    else if (name === 'chats') renderChats();
    else if (name === 'chat') renderChat();
  };

  window.FoodCycle = { showView: showView, openChat: openChat };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
