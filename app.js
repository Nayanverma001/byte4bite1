/**
 * FoodCycle — Shared application logic
 * Uses localStorage; when run on local server, syncs to server (data.json).
 */

// Storage keys
var STORAGE_KEYS = {
  role: 'foodcycle_role',
  user: 'foodcycle_user',
  foods: 'foodcycle_foods',
  interests: 'foodcycle_interests',
  notifications: 'foodcycle_notifications',
  reviews: 'foodcycle_reviews',
  messages: 'foodcycle_messages',
  draft: 'foodcycle_draft',
  saved: 'foodcycle_saved'
};

/**
 * Pre-uploaded food images (Unsplash) — commercially common categories
 */
var PRESET_FOOD_IMAGES = [
  { label: 'Rice & grains', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop' },
  { label: 'Bread & bakery', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop' },
  { label: 'Vegetables', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop' },
  { label: 'Fruits', url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=300&fit=crop' },
  { label: 'Dairy & eggs', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=300&fit=crop' },
  { label: 'Dal & curry', url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop' },
  { label: 'Cooked meal', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
  { label: 'Packaged food', url: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=300&fit=crop' }
];

/**
 * Quick-fill items for donors (common surplus items)
 */
var QUICK_FILL_ITEMS = [
  { name: 'Rice', quantity: '2–5 kg', imageIndex: 0 },
  { name: 'Bread', quantity: '5–10 packets', imageIndex: 1 },
  { name: 'Vegetables', quantity: '1–3 kg', imageIndex: 2 },
  { name: 'Fruits', quantity: '1–2 kg', imageIndex: 3 },
  { name: 'Dal', quantity: '1–2 kg', imageIndex: 5 },
  { name: 'Cooked meal', quantity: '2–4 servings', imageIndex: 6 },
  { name: 'Dairy', quantity: 'As per pack', imageIndex: 4 },
  { name: 'Packaged snacks', quantity: 'Multiple packets', imageIndex: 7 }
];

/**
 * Get current user from localStorage
 */
function getCurrentUser() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get current role (donor | buyer)
 */
function getCurrentRole() {
  return localStorage.getItem(STORAGE_KEYS.role) || '';
}

/**
 * Get all food listings
 */
function getAllFoods() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.foods);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save food listings array to localStorage
 */
function saveFoods(foods) {
  localStorage.setItem(STORAGE_KEYS.foods, JSON.stringify(foods));
  syncToServer();
}

/**
 * Add a new food listing (donor)
 */
function addFood(food) {
  var foods = getAllFoods();
  food.id = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  food.createdAt = new Date().toISOString();
  foods.push(food);
  saveFoods(foods);
  return food.id;
}

/**
 * Get a single food by id
 */
function getFoodById(id) {
  var foods = getAllFoods();
  return foods.find(function(f) { return f.id === id; }) || null;
}

/**
 * Parse expiry date and time into a single Date
 */
function getExpiryDate(food) {
  if (!food.expiryDate) return null;
  var dateStr = food.expiryDate;
  var timeStr = food.expiryTime || '23:59';
  var combined = dateStr + 'T' + timeStr + ':00';
  var d = new Date(combined);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Get remaining hours until expiry (can be negative if expired)
 */
function getRemainingHours(food) {
  var expiry = getExpiryDate(food);
  if (!expiry) return null;
  var now = new Date();
  return (expiry - now) / (1000 * 60 * 60);
}

/**
 * Safety status: 'safe' | 'soon' | 'expired'
 * - safe: > 24 hours
 * - soon: 0–24 hours
 * - expired: < 0 (should be hidden in buyer view)
 */
function getSafetyStatus(food) {
  var hours = getRemainingHours(food);
  if (hours === null) return 'safe';
  if (hours < 0) return 'expired';
  if (hours <= 24) return 'soon';
  return 'safe';
}

/**
 * Filter out expired foods for buyer marketplace
 */
function getActiveFoods() {
  return getAllFoods().filter(function(f) {
    return getSafetyStatus(f) !== 'expired';
  });
}

/**
 * Get all interests (buyer → food)
 */
function getAllInterests() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.interests);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save interests array
 */
function saveInterests(interests) {
  localStorage.setItem(STORAGE_KEYS.interests, JSON.stringify(interests));
}

/**
 * Add interest from buyer; notify donor
 */
function addInterest(foodId, buyerName, buyerContact) {
  var interests = getAllInterests();
  // Avoid duplicate interests for same buyer + food
  var already = interests.some(function(i) {
    return i.foodId === foodId && i.buyerContact === buyerContact;
  });
  if (!already) {
    var interest = {
      id: 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      foodId: foodId,
      buyerName: buyerName,
      buyerContact: buyerContact,
      createdAt: new Date().toISOString()
    };
    interests.push(interest);
  }

  var notifications = getNotifications();
  var food = getFoodById(foodId);
  notifications.push({
    id: 'n_' + Date.now(),
    type: 'interest',
    foodId: foodId,
    foodName: food ? food.foodName : 'Unknown',
    buyerName: buyerName,
    buyerContact: buyerContact,
    read: false,
    createdAt: new Date().toISOString()
  });
  saveInterests(interests);
  saveNotifications(notifications);
  syncToServer();
}

/**
 * Get interests for a specific food (for donor's chat list)
 */
function getInterestsForFood(foodId) {
  return getAllInterests().filter(function(i) { return i.foodId === foodId; });
}

/**
 * Get donor notifications
 */
function getNotifications() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.notifications);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveNotifications(notifications) {
  localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
  syncToServer();
}

/**
 * Mark notifications as read (optional, for UI)
 */
function markNotificationsRead() {
  var notifications = getNotifications();
  notifications.forEach(function(n) { n.read = true; });
  saveNotifications(notifications);
}

/**
 * Format date for display (e.g. "Feb 7, 2025")
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  var d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Validate donor form: expiry date and time required, must be in future
 */
function validateDonorForm(data) {
  var errors = [];
  if (!data.expiryDate || !data.expiryTime) {
    errors.push('Expiry date and time are required.');
  } else {
    var expiry = getExpiryDate(data);
    if (!expiry) {
      errors.push('Invalid expiry date or time.');
    } else if (expiry <= new Date()) {
      errors.push('Expiry must be in the future.');
    }
  }
  if (!(data.foodName && data.foodName.trim())) errors.push('Food name is required.');
  if (!(data.quantity && data.quantity.trim())) errors.push('Quantity is required.');
  if (!(data.location && data.location.trim())) errors.push('Location is required.');
  if (!(data.foodType && data.foodType.trim())) errors.push('Please select food type (Vegetarian or Non-vegetarian).');
  return errors;
}

/* ========== Reviews (Zomato/OLX style) ========== */
function getAllReviews() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.reviews);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveReviews(reviews) {
  localStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviews));
  syncToServer();
}

function getReviews(foodId) {
  return getAllReviews().filter(function(r) { return r.foodId === foodId; });
}

function addReview(foodId, userName, rating, comment) {
  var reviews = getAllReviews();
  reviews.push({
    id: 'r_' + Date.now(),
    foodId: foodId,
    userName: userName,
    rating: Math.min(5, Math.max(1, Number(rating) || 0)),
    comment: (comment || '').trim(),
    createdAt: new Date().toISOString()
  });
  saveReviews(reviews);
}

function getAverageRating(foodId) {
  var reviews = getReviews(foodId);
  if (reviews.length === 0) return null;
  var sum = reviews.reduce(function(a, r) { return a + r.rating; }, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

/* ========== Chat (donor–buyer) ========== */
function getConversationId(foodId, buyerContact) {
  var safe = (buyerContact || '').replace(/[^a-zA-Z0-9]/g, '_');
  return foodId + '_' + safe;
}

function getAllMessages() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.messages);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveMessages(messages) {
  localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  syncToServer();
}

function getMessages(conversationId) {
  return getAllMessages().filter(function(m) { return m.conversationId === conversationId; });
}

function addMessage(conversationId, fromRole, senderName, text) {
  var messages = getAllMessages();
  messages.push({
    conversationId: conversationId,
    from: fromRole,
    senderName: senderName,
    text: (text || '').trim(),
    createdAt: new Date().toISOString()
  });
  saveMessages(messages);
}

/** Donor: list of conversations (one per interested buyer per my food) */
function getConversationsForDonor(donorContact) {
  var foods = getAllFoods().filter(function(f) { return f.donorContact === donorContact; });
  var list = [];
  foods.forEach(function(food) {
    var interests = getInterestsForFood(food.id);
    interests.forEach(function(i) {
      list.push({
        foodId: food.id,
        foodName: food.foodName,
        buyerName: i.buyerName,
        buyerContact: i.buyerContact,
        conversationId: getConversationId(food.id, i.buyerContact)
      });
    });
  });
  return list;
}

/** Buyer: list of conversations (one per food they showed interest in) */
function getConversationsForBuyer(buyerContact) {
  var interests = getAllInterests().filter(function(i) { return i.buyerContact === buyerContact; });
  var list = [];
  interests.forEach(function(i) {
    var food = getFoodById(i.foodId);
    if (food) {
      list.push({
        foodId: food.id,
        foodName: food.foodName,
        donorName: food.donorName,
        donorContact: food.donorContact,
        conversationId: getConversationId(food.id, buyerContact)
      });
    }
  });
  return list;
}

/* ========== Draft listing (donor) — save form data ========== */
function getDraftListing() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.draft);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDraftListing(draft) {
  try {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
  } catch (e) {}
}

function clearDraftListing() {
  try {
    localStorage.removeItem(STORAGE_KEYS.draft);
  } catch (e) {}
}

/* ========== Saved / favorite items (buyer) ========== */
function getSavedFoodIds() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYS.saved);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveSavedFoodIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify(ids));
  } catch (e) {}
}

function isSaved(foodId) {
  return getSavedFoodIds().indexOf(foodId) !== -1;
}

function toggleSavedFood(foodId) {
  var ids = getSavedFoodIds();
  var i = ids.indexOf(foodId);
  if (i === -1) ids.push(foodId);
  else ids.splice(i, 1);
  saveSavedFoodIds(ids);
  return ids.indexOf(foodId) !== -1;
}

/* ========== Donor: my listings ========== */
function getMyListings(donorContact) {
  return getAllFoods().filter(function(f) { return f.donorContact === donorContact; });
}

/* ========== Server sync (when running on local server) ========== */
function getStoreForServer() {
  return {
    foods: getAllFoods(),
    interests: getAllInterests(),
    notifications: getNotifications(),
    reviews: getAllReviews(),
    messages: getAllMessages()
  };
}

function setStoreFromServer(obj) {
  if (obj.foods != null) localStorage.setItem(STORAGE_KEYS.foods, JSON.stringify(obj.foods));
  if (obj.interests != null) localStorage.setItem(STORAGE_KEYS.interests, JSON.stringify(obj.interests));
  if (obj.notifications != null) localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(obj.notifications));
  if (obj.reviews != null) localStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(obj.reviews));
  if (obj.messages != null) localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(obj.messages));
}

var _syncTimeout;
function syncToServer() {
  if (typeof fetch === 'undefined') return;
  clearTimeout(_syncTimeout);
  _syncTimeout = setTimeout(function() {
    fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getStoreForServer())
    }).catch(function() {});
  }, 300);
}

function loadFromServer(callback) {
  if (typeof fetch === 'undefined') {
    if (callback) callback();
    return;
  }
  fetch('/api/store')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data && typeof data === 'object') setStoreFromServer(data);
      if (callback) callback();
    })
    .catch(function() {
      if (callback) callback();
    });
}
