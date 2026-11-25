const storageKeys = {
  tutors: 'study-with-dieu-er-tutors',
  students: 'study-with-dieu-er-students',
  chats: 'study-with-dieu-er-chat',
  user: 'study-with-dieu-er-user'
};

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeAccountId(value) {
  return String(value || '').trim();
}

function getAccountId(user) {
  if (!user) return '';
  return normalizeAccountId(user.userId || user.accountId || user.id || user.email || user.contactEmail || '');
}

const students = loadData(storageKeys.students, []);
let tutors = loadData(storageKeys.tutors, []);
let selectedTutor = tutors[0] || null;
let currentUser = loadData(storageKeys.user, null);
let selectedChatContact = null;

const roleSelect = document.getElementById('roleSelect');
const studentFields = document.getElementById('studentFields');
const tutorFields = document.getElementById('tutorFields');
const authForm = document.getElementById('authForm');
const loginForm = document.getElementById('loginForm');
const tutorListEl = document.getElementById('tutorList');
const studentListEl = document.getElementById('studentList');
const scheduleTableEl = document.getElementById('scheduleTable');
const chatContactsEl = document.getElementById('chatContacts');
const chatMessagesEl = document.getElementById('chatMessages');
const chatTitleEl = document.getElementById('chatTitle');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const subjectFilter = document.getElementById('subjectFilter');
const authStackEl = document.getElementById('authStack');
const userDashboardEl = document.getElementById('userDashboard');
const profileAvatarEl = document.getElementById('profileAvatar');
const profileNameEl = document.getElementById('profileName');
const profileRoleEl = document.getElementById('profileRole');
const profileEmailEl = document.getElementById('profileEmail');
const profileRoleDetailEl = document.getElementById('profileRoleDetail');
const profileSubjectEl = document.getElementById('profileSubject');
const profileStatusEl = document.getElementById('profileStatus');
const profileJoinedEl = document.getElementById('profileJoined');
const profileLevelEl = document.getElementById('profileLevel');
const profileDetailTitleEl = document.getElementById('profileDetailTitle');
const profileStatusPillEl = document.getElementById('profileStatusPill');
const profileDetailContentEl = document.getElementById('profileDetailContent');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const jumpToLoginBtn = document.getElementById('jumpToLogin');
const jumpToSignUpBtn = document.getElementById('jumpToSignUp');
const beTutorBtn = document.getElementById('beTutorBtn');
const dashboardWrapEl = document.querySelector('.dashboard-wrap');
const matchingSectionEl = document.getElementById('matching');
const reviewPanelEl = document.getElementById('reviewPanel');
const reviewTutorSelect = document.getElementById('reviewTutorSelect');
const ratingStarsEl = document.getElementById('ratingStars');
const reviewCommentEl = document.getElementById('reviewComment');
const submitReviewBtn = document.getElementById('submitReviewBtn');
const reviewListEl = document.getElementById('reviewList');
const reviewsStorageKey = 'study-with-dieu-er-reviews';
const rememberLoginStorageKey = 'study-with-dieu-er-remember-login';
const serverReviewsCache = {};
let selectedReviewRating = 5;

function clearAllAppData() {
  const keys = [
    storageKeys.tutors,
    storageKeys.students,
    storageKeys.chats,
    storageKeys.user,
    reviewsStorageKey,
    rememberLoginStorageKey
  ];

  keys.forEach((key) => localStorage.removeItem(key));

  students.length = 0;
  tutors = [];
  currentUser = null;
  selectedTutor = null;
  selectedChatContact = null;
}

function rememberLoginEnabled() {
  return localStorage.getItem(rememberLoginStorageKey) === 'true';
}

function setRememberLoginPreference(enabled) {
  localStorage.setItem(rememberLoginStorageKey, String(enabled));
}

async function fetchTutorReviewsFromServer(tutorEmail) {
  if (!tutorEmail) return [];

  try {
    const response = await fetch(`http://localhost:3001/api/reviews/${encodeURIComponent(tutorEmail)}`);
    const data = await response.json();

    if (response.ok && data.success && Array.isArray(data.reviews)) {
      serverReviewsCache[String(tutorEmail).toLowerCase()] = data.reviews;
      return data.reviews;
    }
  } catch (error) {
    console.warn('Could not load server reviews, falling back to local cache.', error);
  }

  const fallbackReviews = loadData(reviewsStorageKey, {});
  const localReviews = Array.isArray(fallbackReviews[tutorEmail]) ? fallbackReviews[tutorEmail] : [];
  serverReviewsCache[String(tutorEmail).toLowerCase()] = localReviews;
  return localReviews;
}

async function syncUsersFromServer() {
  try {
    const response = await fetch('http://localhost:3001/api/users');
    const data = await response.json();

    if (!response.ok || !data.success || !Array.isArray(data.users)) {
      return false;
    }

    const serverUsers = data.users;
    students.length = 0;
    students.push(...serverUsers.filter((user) => user.role === 'student'));
    tutors = serverUsers.filter((user) => user.role === 'tutor');

    saveData(storageKeys.students, students);
    saveData(storageKeys.tutors, tutors);
    return true;
  } catch (error) {
    console.warn('Could not sync users from server. Falling back to local cache.', error);
    return false;
  }
}

async function refreshReviewsCache() {
  const tutorEmails = tutors
    .map((tutor) => String(tutor.email || '').trim())
    .filter(Boolean);

  for (const tutorEmail of tutorEmails) {
    await fetchTutorReviewsFromServer(tutorEmail);
  }
}

function toggleRoleForms() {
  const role = roleSelect.value;
  studentFields.classList.toggle('hidden', role !== 'student');
  tutorFields.classList.toggle('hidden', role !== 'tutor');
}

function syncRoleSpecificActions() {
  const isLoggedIn = !!currentUser;
  const shouldHideTutorSignup = !!currentUser && currentUser.role === 'tutor';

  if (jumpToLoginBtn) jumpToLoginBtn.style.display = isLoggedIn ? 'none' : '';
  if (jumpToSignUpBtn) jumpToSignUpBtn.style.display = isLoggedIn ? 'none' : '';

  if (beTutorBtn) {
    beTutorBtn.style.display = shouldHideTutorSignup ? 'none' : '';
  }

  if (dashboardWrapEl) {
    dashboardWrapEl.style.display = shouldHideTutorSignup ? 'none' : '';
  }

  if (matchingSectionEl) {
    matchingSectionEl.style.display = shouldHideTutorSignup ? 'none' : '';
  }

  if (reviewPanelEl) {
    const shouldShowReviewForStudent = !!currentUser && currentUser.role === 'student';
    reviewPanelEl.classList.toggle('hidden', !shouldShowReviewForStudent);
  }
}

async function saveVerifiedUserToServer(profile) {
  const response = await fetch('http://localhost:3001/api/confirm-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Không thể lưu trạng thái xác minh người dùng.');
  }

  return data;
}

function createProfileFromForm() {
  const name = document.getElementById('nameInput').value.trim();
  const userId = normalizeAccountId(document.getElementById('userIdInput').value);
  const password = document.getElementById('passwordInput').value.trim();
  const role = roleSelect.value;

  if (!name || !userId || !password) {
    alert('Vui lòng điền đầy đủ họ tên, ID tài khoản và mật khẩu.');
    return null;
  }

  const email = document.getElementById('tutorContactEmail')
    ? document.getElementById('tutorContactEmail').value.trim()
    : '';

  const baseProfile = {
    name,
    userId,
    id: userId,
    accountId: userId,
    email: email || '',
    password,
    role,
    createdAt: new Date().toISOString()
  };

  if (role === 'student') {
    const subject = document.getElementById('studentSubject').value;
    const level = document.getElementById('studentLevel').value;

    if (!subject || !level) {
      alert('Vui lòng chọn môn học và mức độ hỗ trợ của bạn.');
      return null;
    }

    return { ...baseProfile, subject, level };
  }

  const subject = document.getElementById('tutorSubject').value;
  const bio = document.getElementById('tutorBio').value.trim();
  const contactEmail = document.getElementById('tutorContactEmail').value.trim();
  const scheduleText = document.getElementById('tutorSchedule').value.trim();

  if (!subject) {
    alert('Vui lòng chọn môn học giảng dạy.');
    return null;
  }

  return {
    ...baseProfile,
    subject,
    bio: bio || 'Gia sư đang cập nhật mô tả cá nhân.',
    contactEmail: contactEmail || email,
    schedule: scheduleText ? { Lịch: scheduleText } : {}
  };
}

function saveVerifiedProfile(profile) {
  if (profile.role === 'student') {
    students.push(profile);
    saveData(storageKeys.students, students);
  }

  if (profile.role === 'tutor') {
    tutors.push(profile);
    saveData(storageKeys.tutors, tutors);
    selectedTutor = profile;
  }

  currentUser = profile;
  saveData(storageKeys.user, profile);
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

function getContactKey(person) {
  if (!person) return '';
  return normalizeIdentity(getAccountId(person) || person.email || person.contactEmail || person.name);
}

function getConversationKey(person) {
  if (!currentUser || !person) return '';

  const me = getContactKey(currentUser);
  const them = getContactKey(person);

  if (!me || !them) {
    return normalizeIdentity(person.name || 'general-chat');
  }

  return [me, them].sort().join('::');
}

function getChatTargetList() {
  if (!currentUser) return [];

  const pool = currentUser.role === 'student' ? tutors : students;
  const currentKey = getContactKey(currentUser);

  return pool.filter((person) => {
    const personKey = getContactKey(person);
    return Boolean(personKey) && personKey !== currentKey;
  });
}

function getChatTargetName() {
  if (!selectedChatContact) return '';
  return selectedChatContact.name || '';
}

function renderUserDashboard() {
  syncRoleSpecificActions();

  if (!currentUser) {
    authStackEl.classList.remove('hidden');
    userDashboardEl.classList.add('hidden');
    renderTutorCards(subjectFilter.value || 'Tất cả');
    renderStudentList();
    renderSchedule();
    renderChatContacts();
    renderChat();
    return;
  }

  const roleText = currentUser.role === 'student' ? 'Học sinh' : 'Gia sư';
  const initials = (currentUser.name || 'U')
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  profileAvatarEl.textContent = initials;
  profileNameEl.textContent = currentUser.name;
  profileRoleEl.textContent = `${roleText} • Đã xác minh tài khoản`;
  profileEmailEl.textContent = getAccountId(currentUser) || currentUser.email || '—';
  profileRoleDetailEl.textContent = roleText;
  profileSubjectEl.textContent = currentUser.subject || 'Chưa cập nhật';
  profileStatusEl.textContent = 'Đang hoạt động';
  profileJoinedEl.textContent = currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('vi-VN') : 'Mới';
  profileLevelEl.textContent = currentUser.role === 'student' ? (currentUser.level || 'Mục tiêu học tập') : 'Hồ sơ gia sư';

  profileDetailTitleEl.textContent = currentUser.role === 'student' ? 'Hồ sơ học sinh' : 'Hồ sơ gia sư';
  profileStatusPillEl.textContent = 'Đang hoạt động';

  const profileContent = currentUser.role === 'student'
    ? `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Môn học</span>
          <strong>${currentUser.subject || 'Chưa cập nhật'}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Mục tiêu</span>
          <strong>${currentUser.level || 'Chưa cập nhật'}</strong>
        </div>
        <div class="detail-item wide">
          <span class="detail-label">Kế hoạch học</span>
          <strong>${currentUser.level ? `Hỗ trợ theo mục tiêu ${currentUser.level.toLowerCase()}` : 'Chưa cập nhật mục tiêu học tập'}</strong>
        </div>
      </div>
    `
    : `
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Môn giảng dạy</span>
          <strong>${currentUser.subject || 'Chưa cập nhật'}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Liên hệ</span>
          <strong>${currentUser.contactEmail || currentUser.email}</strong>
        </div>
        <div class="detail-item wide">
          <span class="detail-label">Mô tả</span>
          <strong>${currentUser.bio || 'Gia sư đang cập nhật mô tả cá nhân.'}</strong>
        </div>
      </div>
    `;

  profileDetailContentEl.innerHTML = profileContent;

  renderTutorCards(subjectFilter.value || 'Tất cả');
  renderStudentList();
  renderSchedule();
  renderChatContacts();
  renderChat();
  authStackEl.classList.add('hidden');
  userDashboardEl.classList.remove('hidden');
}

function handleLogout() {
  currentUser = null;
  selectedChatContact = null;
  localStorage.removeItem(storageKeys.user);
  localStorage.removeItem(rememberLoginStorageKey);
  authForm.reset();
  loginForm.reset();
  syncRoleSpecificActions();
  renderUserDashboard();
  renderTutorCards(subjectFilter.value || 'Tất cả');
  renderStudentList();
  renderSchedule();
  renderChatContacts();
  renderChat();
}

async function handleDeleteAccount() {
  if (!currentUser) return;

  const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa tài khoản này khỏi hệ thống? Hành động này không thể hoàn tác.');
  if (!confirmDelete) return;

  const password = window.prompt('Nhập mật khẩu để xác nhận xóa tài khoản:');
  if (!password) {
    alert('Vui lòng nhập mật khẩu để xác nhận xóa tài khoản.');
    return;
  }

  try {
    const response = await fetch('http://localhost:3001/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: getAccountId(currentUser),
        password
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Không thể xóa tài khoản.');
    }

    currentUser = null;
    selectedChatContact = null;
    saveData(storageKeys.user, null);
    authForm.reset();
    loginForm.reset();
    alert('Tài khoản đã được xóa thành công.');
    renderUserDashboard();
    renderTutorCards(subjectFilter.value || 'Tất cả');
  } catch (error) {
    alert(error.message || 'Không thể xóa tài khoản.');
  }
}

function renderTutorCards(filter = 'Tất cả') {
  const items = filter === 'Tất cả' ? tutors : tutors.filter((tutor) => tutor.subject === filter);

  if (!items.length) {
    tutorListEl.innerHTML = `
      <div class="empty-state">
        <strong>Chưa có gia sư nào được đăng ký.</strong><br>
        Hãy đăng ký trở thành gia sư và cập nhật thông tin thật của bạn để học sinh có thể tìm thấy.
      </div>
    `;
    return;
  }

  tutorListEl.innerHTML = items
    .map(
      (tutor) => `
        <article class="tutor-card">
          <div class="tutor-top">
            <div class="avatar">${tutor.name.split(' ').at(-1).slice(0, 2).toUpperCase()}</div>
            <div class="tutor-meta">
              <h3>${tutor.name}</h3>
              <span class="subject-pill">${tutor.subject}</span>
            </div>
          </div>
          <p>${tutor.bio || 'Gia sư đang cập nhật mô tả cá nhân.'}</p>
          <div class="rating-row">
            <span class="stars">★★★★★</span>
            <span>Chưa có đánh giá</span>
          </div>
          <div class="tutor-actions">
            <button class="schedule-button" data-action="schedule" data-name="${tutor.name}">Xem lịch</button>
            <button class="primary-button" data-action="chat" data-name="${tutor.name}">Nhắn tin</button>
          </div>
        </article>
      `
    )
    .join('');

  tutorListEl.querySelectorAll('[data-action="schedule"]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedTutor = tutors.find((tutor) => tutor.name === button.dataset.name) || tutors[0] || null;
      renderSchedule();
      window.scrollTo({ top: document.getElementById('matching').offsetTop - 100, behavior: 'smooth' });
    });
  });

  tutorListEl.querySelectorAll('[data-action="chat"]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedTutor = tutors.find((tutor) => tutor.name === button.dataset.name) || tutors[0] || null;
      selectedChatContact = selectedTutor;
      renderChatContacts();
      renderChat();
      document.getElementById('chat').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderStudentList() {
  if (!students.length) {
    studentListEl.innerHTML = `
      <div class="empty-state">
        <strong>Chưa có học sinh nào đăng ký.</strong><br>
        Sau khi học sinh tạo tài khoản, thông tin môn học và mục tiêu học tập sẽ hiển thị ở đây.
      </div>
    `;
    return;
  }

  studentListEl.innerHTML = students
    .map(
      (student) => `
        <article class="review-item">
          <strong>${student.name}</strong>
          <div class="stars">★</div>
          <p>Môn học: ${student.subject || 'Chưa cập nhật'} • Mục tiêu: ${student.level || 'Chưa cập nhật'}</p>
          <small>ID: ${getAccountId(student) || student.email || '—'}</small>
        </article>
      `
    )
    .join('');
}

function renderSchedule() {
  if (!!currentUser && currentUser.role === 'tutor') {
    scheduleTableEl.innerHTML = `
      <div class="empty-state">
        Bạn đang ở vai trò gia sư, nên phần lịch học dành cho học sinh được ẩn khỏi tài khoản này.
      </div>
    `;
    return;
  }

  if (!tutors.length) {
    scheduleTableEl.innerHTML = `
      <div class="empty-state">
        Chưa có lịch học nào để hiển thị.
      </div>
    `;
    return;
  }

  scheduleTableEl.innerHTML = tutors
    .map((tutor) => {
      const schedule = tutor.schedule || {};
      const entries = Object.entries(schedule);
      const isSelected = selectedTutor && tutor.email === selectedTutor.email;

      const scheduleItems = entries.length
        ? entries
            .map(
              ([day, time]) => `
                <div class="schedule-row">
                  <div class="day">${day}</div>
                  <div>${time}</div>
                </div>
              `
            )
            .join('')
        : `
          <div class="schedule-row empty-row">
            <div class="day">—</div>
            <div>Chưa cập nhật lịch học</div>
          </div>
        `;

      return `
        <div class="schedule-group ${isSelected ? 'active' : ''}">
          <button class="schedule-tutor-header" data-tutor-name="${tutor.name}">
            <span>${tutor.name}</span>
            <span class="subject-pill small">${tutor.subject || 'Chưa cập nhật'}</span>
          </button>
          ${scheduleItems}
        </div>
      `;
    })
    .join('');

  scheduleTableEl.querySelectorAll('.schedule-tutor-header').forEach((button) => {
    button.addEventListener('click', () => {
      const tutor = tutors.find((item) => item.name === button.dataset.tutorName) || tutors[0] || null;
      selectedTutor = tutor;
      renderSchedule();
    });
  });
}

function getReviewsForTutor(tutor) {
  if (!tutor) return [];
  const emailKey = String(tutor.email || '').trim().toLowerCase();
  const savedReviews = loadData(reviewsStorageKey, {});
  return Array.isArray(serverReviewsCache[emailKey])
    ? serverReviewsCache[emailKey]
    : (Array.isArray(savedReviews[emailKey]) ? savedReviews[emailKey] : []);
}

function renderSessionReviews() {
  if (!reviewListEl) return;

  const selectedTutor = reviewTutorSelect && reviewTutorSelect.value
    ? tutors.find((tutor) => tutor.email === reviewTutorSelect.value)
    : tutors[0] || null;

  const reviews = getReviewsForTutor(selectedTutor);
  if (!selectedTutor) {
    reviewListEl.innerHTML = `
      <div class="empty-state">
        Chưa có gia sư nào để đánh giá.
      </div>
    `;
    return;
  }

  if (!reviews.length) {
    reviewListEl.innerHTML = `
      <div class="empty-state">
        Chưa có đánh giá nào cho ${selectedTutor.name}. Hãy là người đầu tiên để lại nhận xét.
      </div>
    `;
    return;
  }

  reviewListEl.innerHTML = reviews
    .map(
      (review) => `
        <div class="review-item">
          <strong>${review.name}</strong>
          <div class="stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
          <p>${review.comment}</p>
        </div>
      `
    )
    .join('');
}

function populateReviewTutorSelect() {
  if (!reviewTutorSelect) return;

  reviewTutorSelect.innerHTML = tutors.length
    ? tutors
        .map(
          (tutor) => `<option value="${tutor.email}">${tutor.name} (${tutor.subject || 'Chưa cập nhật'})</option>`
        )
        .join('')
    : '<option value="">Chưa có gia sư</option>';

  const firstTutor = tutors[0];
  if (firstTutor) {
    reviewTutorSelect.value = firstTutor.email;
  }

  renderSessionReviews();
}

function updateStarButtons() {
  if (!ratingStarsEl) return;

  const buttons = ratingStarsEl.querySelectorAll('.star-btn');
  buttons.forEach((button) => {
    const isActive = Number(button.dataset.value) <= selectedReviewRating;
    button.classList.toggle('active', isActive);
  });
}

async function submitTutorReview() {
  if (!currentUser || currentUser.role !== 'student') {
    alert('Chỉ học sinh mới có quyền đánh giá gia sư.');
    return;
  }

  if (!reviewTutorSelect || !reviewTutorSelect.value) {
    alert('Vui lòng chọn gia sư để đánh giá.');
    return;
  }

  const comment = (reviewCommentEl ? reviewCommentEl.value.trim() : '').replace(/\s+/g, ' ');
  if (!comment) {
    alert('Vui lòng nhập bình luận cho gia sư.');
    return;
  }

  const tutorEmail = reviewTutorSelect.value;

  try {
    const response = await fetch('http://localhost:3001/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutorEmail,
        name: currentUser.name,
        rating: selectedReviewRating,
        comment
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Không thể lưu đánh giá.');
    }

    const savedReviews = loadData(reviewsStorageKey, {});
    savedReviews[tutorEmail] = Array.isArray(data.reviews) ? data.reviews : [];
    saveData(reviewsStorageKey, savedReviews);
    serverReviewsCache[String(tutorEmail).toLowerCase()] = savedReviews[tutorEmail];

    if (reviewCommentEl) reviewCommentEl.value = '';
    selectedReviewRating = 5;
    updateStarButtons();
    renderSessionReviews();
    alert('Cảm ơn bạn đã gửi đánh giá cho gia sư.');
  } catch (error) {
    alert(error.message || 'Không thể gửi đánh giá cho gia sư.');
  }
}

function getStoredMessages() {
  return loadData(storageKeys.chats, {});
}

function saveMessages(messages) {
  saveData(storageKeys.chats, messages);
}

function renderChatContacts() {
  const contacts = getChatTargetList();

  if (!contacts.length) {
    const emptyMessage = currentUser && currentUser.role === 'tutor'
      ? 'Chưa có học sinh nào đăng ký để trò chuyện.'
      : 'Chưa có gia sư nào. Bạn có thể đăng ký làm gia sư để bắt đầu nhận học sinh.';

    chatContactsEl.innerHTML = `
      <div class="empty-state">
        ${emptyMessage}
      </div>
    `;
    selectedChatContact = null;
    return;
  }

  const selectedKey = getContactKey(selectedChatContact);
  if (!selectedKey || !contacts.some((person) => getContactKey(person) === selectedKey)) {
    selectedChatContact = contacts[0];
  }

  chatContactsEl.innerHTML = contacts
    .map((person) => {
      const key = getContactKey(person);
      const isActive = getContactKey(selectedChatContact) === key;
      return `
        <button class="contact-card ${isActive ? 'active' : ''}" data-contact="${key}">
          <div class="contact-name">
            <span class="avatar small">${person.name.split(' ').at(-1).slice(0, 2).toUpperCase()}</span>
            <span>${person.name}</span>
          </div>
          <span class="contact-dot"></span>
        </button>
      `;
    })
    .join('');

  chatContactsEl.querySelectorAll('.contact-card').forEach((button) => {
    button.addEventListener('click', () => {
      const contactKey = button.dataset.contact;
      const contact = contacts.find((person) => getContactKey(person) === contactKey) || contacts[0] || null;
      selectedChatContact = contact;
      renderChat();
      renderChatContacts();
    });
  });
}

function renderChat() {
  if (!currentUser) {
    chatTitleEl.textContent = 'Chat với gia sư';
    chatMessagesEl.innerHTML = `
      <div class="empty-state">
        Vui lòng đăng nhập để bắt đầu trò chuyện.
      </div>
    `;
    return;
  }

  const contacts = getChatTargetList();
  const selectedKey = getContactKey(selectedChatContact);

  if (!selectedKey || !contacts.some((person) => getContactKey(person) === selectedKey)) {
    selectedChatContact = contacts[0] || null;
  }

  if (!selectedChatContact) {
    const emptyMessage = currentUser.role === 'tutor'
      ? 'Chưa có học sinh để trò chuyện.'
      : 'Chưa có người để trò chuyện.';

    chatTitleEl.textContent = currentUser.role === 'tutor' ? 'Chat với học sinh' : 'Chat với gia sư';
    chatMessagesEl.innerHTML = `
      <div class="empty-state">
        ${emptyMessage}
      </div>
    `;
    return;
  }

  const messages = getStoredMessages();
  const conversationKey = getConversationKey(selectedChatContact);
  const conversation = messages[conversationKey] || [];
  chatTitleEl.textContent = `Chat với ${selectedChatContact.name}`;

  chatMessagesEl.innerHTML = conversation
    .map(
      (msg) => `
        <div class="message ${getAccountId(currentUser) === (msg.senderId || msg.senderEmail || msg.sender || '') ? 'outgoing' : 'incoming'}">
          <strong>${msg.senderName || msg.sender || 'Người dùng'}:</strong> ${msg.text}
        </div>
      `
    )
    .join('');

  if (!conversation.length) {
    chatMessagesEl.innerHTML = `
      <div class="empty-state">
        Chưa có tin nhắn nào. Hãy gửi lời chào để bắt đầu cuộc trò chuyện.
      </div>
    `;
  }

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

sendMessageBtn.addEventListener('click', () => {
  if (!currentUser) {
    alert('Vui lòng đăng nhập trước khi nhắn tin.');
    return;
  }

  if (!selectedChatContact) {
    alert('Vui lòng chọn người để trò chuyện.');
    return;
  }

  const text = messageInput.value.trim();
  if (!text) return;

  const messages = getStoredMessages();
  const conversationKey = getConversationKey(selectedChatContact);
  const conversation = messages[conversationKey] || [];

  conversation.push({
    senderName: currentUser.name,
    senderId: getAccountId(currentUser),
    senderEmail: currentUser.email,
    text
  });

  messages[conversationKey] = conversation;
  saveMessages(messages);
  renderChat();
  messageInput.value = '';
});

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendMessageBtn.click();
  }
});

subjectFilter.addEventListener('change', (event) => {
  renderTutorCards(event.target.value);
});

roleSelect.addEventListener('change', toggleRoleForms);

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const profile = createProfileFromForm();
  if (!profile) return;

  try {
    await saveVerifiedUserToServer(profile);
    saveVerifiedProfile(profile);

    authForm.reset();
    toggleRoleForms();
    await syncUsersFromServer();
    renderTutorCards(subjectFilter.value || 'Tất cả');
    renderStudentList();
    renderChatContacts();
    renderChat();
    renderSchedule();

    const successMessage = profile.role === 'student'
      ? `Tài khoản học sinh ${profile.name} đã được tạo thành công. Bạn đang tìm môn ${profile.subject}.`
      : `Tài khoản gia sư ${profile.name} đã được tạo thành công. Email nhận đơn dạy: ${profile.contactEmail}`;

    alert(successMessage);
  } catch (error) {
    alert(error.message || 'Không thể tạo tài khoản.');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const userId = normalizeAccountId(document.getElementById('loginUserId').value);
  const password = document.getElementById('loginPassword').value.trim();
  const rememberLogin = document.getElementById('rememberLoginCheckbox')?.checked ?? true;

  if (!userId || !password) {
    alert('Vui lòng nhập ID tài khoản và mật khẩu để đăng nhập.');
    return;
  }

  try {
    const response = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Đăng nhập không thành công.');
    }

    const matchedUser = data.user;
    currentUser = matchedUser;
    setRememberLoginPreference(rememberLogin);

    if (rememberLogin) {
      saveData(storageKeys.user, matchedUser);
    } else {
      localStorage.removeItem(storageKeys.user);
    }

    await syncUsersFromServer();
    loginForm.reset();
    renderUserDashboard();
    renderTutorCards(subjectFilter.value || 'Tất cả');
    renderStudentList();
    renderChatContacts();
    renderChat();
    alert(`Đăng nhập thành công! Xin chào ${matchedUser.name}.`);
  } catch (error) {
    alert(error.message || 'ID tài khoản hoặc mật khẩu không chính xác.');
  }
});

logoutBtn.addEventListener('click', handleLogout);
deleteAccountBtn?.addEventListener('click', handleDeleteAccount);

async function init() {
  const shouldRestorePreviousSession = rememberLoginEnabled();

  if (!shouldRestorePreviousSession) {
    clearAllAppData();
  } else {
    currentUser = loadData(storageKeys.user, null);
    if (!currentUser) {
      clearAllAppData();
    }
  }

  await syncUsersFromServer();
  toggleRoleForms();
  renderTutorCards();
  renderStudentList();
  renderSchedule();
  renderChatContacts();
  renderChat();
  await refreshReviewsCache();
  populateReviewTutorSelect();

  if (ratingStarsEl) {
    ratingStarsEl.querySelectorAll('.star-btn').forEach((button) => {
      button.addEventListener('click', () => {
        selectedReviewRating = Number(button.dataset.value);
        updateStarButtons();
      });
    });
  }

  if (reviewTutorSelect) {
    reviewTutorSelect.addEventListener('change', renderSessionReviews);
  }

  if (submitReviewBtn) {
    submitReviewBtn.addEventListener('click', submitTutorReview);
  }

  if (currentUser) {
    document.getElementById('nameInput').value = currentUser.name || '';
    document.getElementById('userIdInput').value = getAccountId(currentUser) || '';
  }

  renderUserDashboard();

  document.getElementById('jumpToLogin').addEventListener('click', () => {
    document.getElementById('loginSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('jumpToSignUp').addEventListener('click', () => {
    document.getElementById('signUpSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('findTutorBtn').addEventListener('click', () => {
    document.getElementById('matching').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('beTutorBtn').addEventListener('click', () => {
    roleSelect.value = 'tutor';
    toggleRoleForms();
    document.getElementById('signUpSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

init();
