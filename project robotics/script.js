/* =========================================================
   script.js - Trang profile "Bàn học"
   Gồm: đổi giao diện sáng/tối, thanh kỹ năng, gọi API quote,
   lọc dự án, Easter egg ly cà phê, kiểm tra form, đổi tiêu đề tab
   ========================================================= */

/* ---------- 1. CHẾ ĐỘ SÁNG / TỐI ---------- */
const themeToggleBtn = document.getElementById("theme-toggle-btn");

// Áp dụng giao diện và lưu lựa chọn vào localStorage
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("theme", theme);
}

// Đảo giao diện hiện tại
function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

themeToggleBtn.addEventListener("click", toggleDarkMode);

// Khi mở trang: dùng lựa chọn đã lưu (nếu có)
applyTheme(localStorage.getItem("theme") || "light");


/* ---------- 2. THANH KỸ NĂNG ---------- */
// Đặt độ rộng thanh theo thuộc tính data-level (kèm hiệu ứng chạy)
function animateSkillBars() {
  const skillFills = document.querySelectorAll(".skill-fill");
  skillFills.forEach(function (fill) {
    fill.style.width = fill.dataset.level + "%";
  });
}

// Chờ một chút để trình duyệt vẽ xong rồi mới chạy hiệu ứng
setTimeout(animateSkillBars, 300);


/* ---------- 3. GỌI API LẤY QUOTE ---------- */
const quoteText = document.getElementById("quote-text");
const quoteAuthor = document.getElementById("quote-author");
const newQuoteBtn = document.getElementById("new-quote-btn");

// Gọi API, nhận JSON, hiển thị lên trang
async function fetchDailyQuote() {
  quoteText.textContent = "Đang tải...";
  try {
    const response = await fetch("https://dummyjson.com/quotes/random");
    if (!response.ok) {
      throw new Error("API trả về lỗi: " + response.status);
    }
    const data = await response.json();
    quoteText.textContent = '"' + data.quote + '"';
    quoteAuthor.textContent = "- " + data.author;
  } catch (error) {
    // Lỗi mạng hoặc API hỏng: báo cho người xem, không làm đơ trang
    quoteText.textContent = "Không tải được quote, thử lại sau nhé!";
    quoteAuthor.textContent = "";
    console.error("Lỗi API quote:", error);
  }
}

newQuoteBtn.addEventListener("click", fetchDailyQuote);
fetchDailyQuote(); // tự gọi khi mở trang


/* ---------- 4. LỌC + TÌM KIẾM DỰ ÁN ---------- */
const filterButtons = document.querySelectorAll(".filter-btn");
const projectCards = document.querySelectorAll(".project-card");
const projectSearchInput = document.getElementById("project-search");
const noProjectMessage = document.getElementById("no-project-msg");

let currentCategory = "all"; // thể loại đang chọn

// Hiện/ẩn từng thẻ dự án theo thể loại và từ khóa tìm kiếm
function filterProjects() {
  const keyword = projectSearchInput.value.trim().toLowerCase();
  let visibleCount = 0;

  projectCards.forEach(function (card) {
    const matchCategory =
      currentCategory === "all" || card.dataset.category === currentCategory;
    const matchKeyword = card.textContent.toLowerCase().includes(keyword);

    if (matchCategory && matchKeyword) {
      card.classList.remove("hidden");
      visibleCount++;
    } else {
      card.classList.add("hidden");
    }
  });

  // Báo khi không có dự án nào khớp
  noProjectMessage.classList.toggle("hidden", visibleCount > 0);
}

filterButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    filterButtons.forEach(function (b) { b.classList.remove("active"); });
    button.classList.add("active");
    currentCategory = button.dataset.filter;
    filterProjects();
  });
});

projectSearchInput.addEventListener("input", filterProjects);


/* ---------- 5. EASTER EGG: LY CÀ PHÊ ---------- */
const coffeeBtn = document.getElementById("coffee-btn");
const funFact = document.getElementById("fun-fact");

// Danh sách fun fact (hãy thay bằng chuyện của riêng bạn)
const funFacts = [
  "Mình có thể code đến 2 giờ sáng nếu có cà phê sữa đá.",
  "Dòng code đầu tiên mình viết là console.log('Hello').",
  "Mình từng mất 3 tiếng để tìm ra lỗi... thiếu một dấu chấm phẩy."
];

function showRandomFunFact() {
  const randomIndex = Math.floor(Math.random() * funFacts.length);
  funFact.textContent = "☕ " + funFacts[randomIndex];
  funFact.classList.remove("hidden");
}

coffeeBtn.addEventListener("click", showRandomFunFact);


/* ---------- 6. KIỂM TRA FORM LIÊN HỆ ---------- */
const contactForm = document.getElementById("contact-form");
const nameInput = document.getElementById("name-input");
const emailInput = document.getElementById("email-input");
const messageInput = document.getElementById("message-input");
const formMessage = document.getElementById("form-message");

// Hiện thông báo (type: "error" hoặc "success")
function showFormMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = "form-message " + type;
}

contactForm.addEventListener("submit", function (event) {
  event.preventDefault(); // chặn tải lại trang

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (nameInput.value.trim() === "") {
    showFormMessage("Bạn chưa nhập tên.", "error");
  } else if (!emailPattern.test(emailInput.value.trim())) {
    showFormMessage("Email chưa đúng định dạng.", "error");
  } else if (messageInput.value.trim().length < 10) {
    showFormMessage("Lời nhắn cần ít nhất 10 ký tự.", "error");
  } else {
    // Bản demo: chưa gửi đi đâu, chỉ báo thành công
    showFormMessage("Cảm ơn " + nameInput.value.trim() + "! Mình đã nhận được lời nhắn.", "success");
    contactForm.reset();
  }
});


/* ---------- 7. ĐỔI TIÊU ĐỀ TAB KHI RỜI TRANG ---------- */
const originalTitle = document.title;

document.addEventListener("visibilitychange", function () {
  document.title = document.hidden ? "Quay lại nhé! ☕" : originalTitle;
});