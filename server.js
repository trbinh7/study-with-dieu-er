const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const reviewsFile = path.join(dataDir, 'reviews.json');
const otpStore = new Map();

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2), 'utf8');
}

if (!fs.existsSync(reviewsFile)) {
  fs.writeFileSync(reviewsFile, JSON.stringify({}, null, 2), 'utf8');
}

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'study-with-dieu-er')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Study With Dieu-er backend is running' });
});

app.get('/api/users', (req, res) => {
  try {
    const users = readUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('get users error:', error);
    res.status(500).json({ success: false, message: 'Không thể tải danh sách tài khoản.' });
  }
});

app.get('/api/reviews/:tutorEmail', (req, res) => {
  try {
    const tutorEmail = String(req.params.tutorEmail || '').trim().toLowerCase();
    const reviews = readReviews();
    const tutorReviews = Array.isArray(reviews[tutorEmail]) ? reviews[tutorEmail] : [];

    res.json({ success: true, reviews: tutorReviews });
  } catch (error) {
    console.error('get reviews error:', error);
    res.status(500).json({ success: false, message: 'Không thể tải đánh giá gia sư.' });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const tutorEmail = String(req.body.tutorEmail || '').trim().toLowerCase();
    const name = String(req.body.name || 'Người dùng').trim() || 'Người dùng';
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim().replace(/\s+/g, ' ');

    if (!tutorEmail) {
      return res.status(400).json({ success: false, message: 'Thiếu email gia sư để lưu đánh giá.' });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Số sao đánh giá phải từ 1 đến 5.' });
    }

    if (!comment) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập bình luận cho gia sư.' });
    }

    const reviews = readReviews();
    const tutorReviews = Array.isArray(reviews[tutorEmail]) ? reviews[tutorEmail] : [];

    tutorReviews.push({
      name,
      rating,
      comment,
      createdAt: new Date().toISOString()
    });

    reviews[tutorEmail] = tutorReviews;
    writeReviews(reviews);

    res.json({
      success: true,
      reviews: tutorReviews,
      message: 'Đánh giá đã được lưu thành công trên hệ thống.'
    });
  } catch (error) {
    console.error('submit review error:', error);
    res.status(500).json({ success: false, message: 'Không thể lưu đánh giá gia sư.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'study-with-dieu-er', 'index.html'));
});

function readUsers() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch (error) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify({ users }, null, 2), 'utf8');
}

function readReviews() {
  try {
    const raw = fs.readFileSync(reviewsFile, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeReviews(reviews) {
  fs.writeFileSync(reviewsFile, JSON.stringify(reviews, null, 2), 'utf8');
}

function normalizeAccountId(value) {
  return String(value || '').trim();
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const allowMockOtp = String(process.env.ALLOW_MOCK_OTP || '').toLowerCase() === 'true';

  const missingConfig = !gmailUser || !gmailPassword || gmailUser.includes('your_email') || gmailPassword.includes('your_16_character');

  if (missingConfig && allowMockOtp) {
    return null;
  }

  if (missingConfig) {
    throw new Error('Gmail chưa được cấu hình đúng. Vui lòng điền email Gmail thật và App Password 16 ký tự trong file .env.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword
    }
  });
}

app.post('/api/send-otp', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { otp, expiresAt });

    const transporter = getTransporter();

    if (!transporter) {
      console.log(`[MOCK OTP] Email ${email} received OTP ${otp} (demo mode enabled)`);
      return res.json({
        success: true,
        demo: true,
        otp,
        message: 'Chế độ demo đang bật: mã OTP đã được tạo thành công. Sử dụng để kiểm tra luồng đăng ký trong môi trường local.'
      });
    }

    await transporter.sendMail({
      from: `Study With Dieu-er <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Mã OTP xác nhận tài khoản Study With Dieu-er',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #dfeeff;border-radius:16px;background:#f7fbff;">
          <h2 style="color:#164c8b;margin-bottom:12px;">Xác nhận tài khoản</h2>
          <p style="color:#334155;line-height:1.6;">Bạn đã đăng ký tài khoản trên Study With Dieu-er.</p>
          <p style="color:#334155;line-height:1.6;">Mã OTP của bạn là:</p>
          <div style="background:#eaf4ff;border:1px solid #cfe1ff;border-radius:12px;padding:20px;text-align:center;font-size:32px;font-weight:700;letter-spacing:6px;color:#0e447d;">${otp}</div>
          <p style="color:#4d6780;line-height:1.6; margin-top:16px;">Mã này có hiệu lực trong 5 phút. Vui lòng không chia sẻ cho bất kỳ ai.</p>
        </div>
      `
    });

    console.log(`OTP sent to ${email}: ${otp}`);
    res.json({
      success: true,
      message: 'Mã OTP đã được gửi tới email của bạn.'
    });
  } catch (error) {
    console.error('send-otp error:', error);

    let message = error.message || 'Không thể gửi mã OTP. Kiểm tra cấu hình Gmail.';

    if (error.code === 'EAUTH' || /Invalid login|535|Bad credentials/i.test(String(error.message || ''))) {
      message = 'Gmail từ chối đăng nhập SMTP. Hãy chắc chắn bạn đang dùng App Password Gmail (không phải mật khẩu Gmail thường), bật 2-Step Verification, và nhập đúng email + App Password trong file .env.';
    }

    res.status(500).json({
      success: false,
      message
    });
  }
});

app.post('/api/verify-otp', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Thiếu email hoặc mã OTP.' });
    }

    const record = otpStore.get(email);
    if (!record) {
      return res.status(400).json({ success: false, message: 'Mã OTP không tồn tại hoặc đã hết hạn.' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, message: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Mã OTP không đúng.' });
    }

    otpStore.delete(email);
    return res.json({ success: true, message: 'OTP hợp lệ. Tài khoản đã được xác thực.' });
  } catch (error) {
    console.error('verify-otp error:', error);
    res.status(500).json({ success: false, message: 'Xác minh OTP thất bại.' });
  }
});

app.post('/api/confirm-user', (req, res) => {
  try {
    const userPayload = req.body || {};
    const userId = normalizeAccountId(userPayload.userId || userPayload.id || userPayload.accountId);
    const email = String(userPayload.email || '').trim().toLowerCase();

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Thiếu ID tài khoản để lưu hồ sơ.' });
    }

    const users = readUsers();
    const existingUser = users.find((user) => {
      const storedId = normalizeAccountId(user.userId || user.id || user.accountId);
      const matchById = Boolean(userId) && Boolean(storedId) && storedId === userId;
      const matchByEmail = Boolean(email) && Boolean(user.email) && String(user.email || '').trim().toLowerCase() === email;
      return matchById || matchByEmail;
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'ID tài khoản này đã được đăng ký cho một tài khoản khác. Mỗi ID chỉ được dùng cho 1 tài khoản.'
      });
    }

    const normalizedUser = {
      id: userPayload.id || userId,
      userId,
      accountId: userId,
      name: userPayload.name || 'Người dùng',
      email: email || '',
      password: userPayload.password || '',
      role: userPayload.role || 'student',
      subject: userPayload.subject || '',
      level: userPayload.level || '',
      bio: userPayload.bio || '',
      contactEmail: userPayload.contactEmail || email,
      schedule: userPayload.schedule || {},
      createdAt: userPayload.createdAt || new Date().toISOString(),
      verified: true,
      updatedAt: new Date().toISOString()
    };

    users.push(normalizedUser);
    writeUsers(users);

    res.json({ success: true, user: normalizedUser, message: 'Tài khoản đã được xác minh và lưu thành công.' });
  } catch (error) {
    console.error('confirm-user error:', error);
    res.status(500).json({ success: false, message: 'Không thể lưu hồ sơ người dùng.' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const userId = normalizeAccountId(req.body.userId || req.body.id || req.body.accountId || req.body.email);
    const password = String(req.body.password || '').trim();

    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'ID tài khoản và mật khẩu là bắt buộc.' });
    }

    const users = readUsers();
    const matchedUser = users.find((item) => {
      const storedId = normalizeAccountId(item.userId || item.id || item.accountId);
      return storedId === userId || String(item.email || '').toLowerCase() === userId.toLowerCase();
    });

    if (!matchedUser) {
      return res.status(401).json({ success: false, message: 'ID tài khoản hoặc mật khẩu không đúng.' });
    }

    if (String(matchedUser.password || '') !== password) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không đúng. Vui lòng nhập đúng mật khẩu tài khoản.' });
    }

    const user = matchedUser;

    if (!user.verified) {
      return res.status(403).json({ success: false, message: 'Tài khoản chưa được kích hoạt trên hệ thống.' });
    }

    res.json({ success: true, user: { ...user, password: undefined } });
  } catch (error) {
    console.error('login error:', error);
    res.status(500).json({ success: false, message: 'Đăng nhập thất bại.' });
  }
});

app.post('/api/delete-account', (req, res) => {
  try {
    const userId = normalizeAccountId(req.body.userId || req.body.id || req.body.accountId);
    const password = String(req.body.password || '').trim();

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Thiếu ID tài khoản để xóa.' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu để xác nhận xóa tài khoản.' });
    }

    const users = readUsers();
    const userIndex = users.findIndex((item) => normalizeAccountId(item.userId || item.id || item.accountId) === userId);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để xóa.' });
    }

    if (String(users[userIndex].password || '') !== password) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không đúng. Không thể xóa tài khoản.' });
    }

    users.splice(userIndex, 1);
    writeUsers(users);

    res.json({ success: true, message: 'Tài khoản đã được xóa thành công.' });
  } catch (error) {
    console.error('delete-account error:', error);
    res.status(500).json({ success: false, message: 'Không thể xóa tài khoản.' });
  }
});

app.listen(PORT, () => {
  console.log(`Study With Dieu-er backend is running on http://localhost:${PORT}`);
});
