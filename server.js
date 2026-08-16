require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { run, get, all, initDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-this-secret";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "You must be logged in." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  next();
}

app.get("/api/health", (req,res) => res.json({ ok:true, service:"Job and Skill API" }));

app.post("/api/auth/register", async (req,res) => {
  try {
    const { firstName, lastName, email, phone, accountType, password } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ error:"Please complete all required fields." });
    if (password.length < 8) return res.status(400).json({ error:"Password must be at least 8 characters." });
    const normalized = email.trim().toLowerCase();
    if (await get("SELECT id FROM users WHERE email=?", [normalized])) return res.status(409).json({ error:"An account with this email already exists." });
    const hash = await bcrypt.hash(password, 12);
    const result = await run(`INSERT INTO users
      (first_name,last_name,email,phone,account_type,password_hash,role)
      VALUES (?,?,?,?,?,?,?)`, [firstName.trim(),lastName.trim(),normalized,phone || "",accountType || "",hash,"user"]);
    const user = await get("SELECT id,first_name,last_name,email,phone,account_type,role,created_at FROM users WHERE id=?", [result.id]);
    res.status(201).json({ message:"Account created successfully.", token:tokenFor(user), user });
  } catch (e) { console.error(e); res.status(500).json({ error:"Unable to create account." }); }
});

app.post("/api/auth/login", async (req,res) => {
  try {
    const { email, password } = req.body;
    const user = await get("SELECT * FROM users WHERE email=?", [(email || "").trim().toLowerCase()]);
    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) return res.status(401).json({ error:"Invalid email or password." });
    const safe = { id:user.id, first_name:user.first_name, last_name:user.last_name, email:user.email, phone:user.phone, account_type:user.account_type, role:user.role, created_at:user.created_at };
    res.json({ message:"Login successful.", token:tokenFor(safe), user:safe });
  } catch (e) { console.error(e); res.status(500).json({ error:"Unable to log in." }); }
});

app.get("/api/auth/me", auth, async (req,res) => {
  const user = await get("SELECT id,first_name,last_name,email,phone,account_type,role,created_at FROM users WHERE id=?", [req.user.id]);
  if (!user) return res.status(404).json({ error:"Account not found." });
  res.json({ user });
});

app.get("/api/courses", async (req,res) => {
  const courses = await all("SELECT * FROM courses WHERE active=1 ORDER BY id");
  res.json({ courses });
});

app.get("/api/courses/:slug", async (req,res) => {
  const course = await get("SELECT * FROM courses WHERE slug=? AND active=1", [req.params.slug]);
  if (!course) return res.status(404).json({ error:"Course not found." });
  res.json({ course });
});

app.post("/api/applications", auth, async (req,res) => {
  try {
    const { courseSlug, programme, phone, message } = req.body;
    if (!courseSlug || !programme || !message) return res.status(400).json({ error:"Course, programme and application message are required." });
    const course = await get("SELECT * FROM courses WHERE slug=? AND active=1", [courseSlug]);
    if (!course) return res.status(404).json({ error:"Course not found." });
    const existing = await get(`SELECT id FROM applications WHERE user_id=? AND course_id=? AND status='pending'`, [req.user.id,course.id]);
    if (existing) return res.status(409).json({ error:"You already have a pending application for this course." });
    const result = await run(`INSERT INTO applications
      (user_id,course_id,programme,phone,message,status) VALUES (?,?,?,?,?,'pending')`,
      [req.user.id,course.id,programme,phone || "",message.trim()]);
    const application = await get(`SELECT a.*,c.title AS course_title,c.slug AS course_slug
      FROM applications a JOIN courses c ON c.id=a.course_id WHERE a.id=?`, [result.id]);
    res.status(201).json({ message:"Application submitted for administrator review.", application });
  } catch(e) { console.error(e); res.status(500).json({ error:"Unable to submit application." }); }
});

app.get("/api/applications/my", auth, async (req,res) => {
  const applications = await all(`SELECT a.*,c.title AS course_title,c.slug AS course_slug,c.category,c.price
    FROM applications a JOIN courses c ON c.id=a.course_id WHERE a.user_id=? ORDER BY a.created_at DESC`, [req.user.id]);
  res.json({ applications });
});

app.get("/api/admin/stats", auth, adminOnly, async (req,res) => {
  const users = await get("SELECT COUNT(*) count FROM users WHERE role='user'");
  const pending = await get("SELECT COUNT(*) count FROM applications WHERE status='pending'");
  const approved = await get("SELECT COUNT(*) count FROM applications WHERE status='approved'");
  const rejected = await get("SELECT COUNT(*) count FROM applications WHERE status='rejected'");
  const unread = await get("SELECT COUNT(*) count FROM contact_messages WHERE status='unread'");
  res.json({ users:users.count,pending:pending.count,approved:approved.count,rejected:rejected.count,unreadMessages:unread.count });
});

app.get("/api/admin/users", auth, adminOnly, async (req,res) => {
  const users = await all(`SELECT u.id,u.first_name,u.last_name,u.email,u.phone,u.account_type,u.created_at,
    COUNT(a.id) AS application_count
    FROM users u LEFT JOIN applications a ON a.user_id=u.id
    WHERE u.role='user' GROUP BY u.id ORDER BY u.created_at DESC`);
  res.json({ users });
});

app.get("/api/admin/applications", auth, adminOnly, async (req,res) => {
  const applications = await all(`SELECT a.*, 
    u.first_name,u.last_name,u.email,u.phone AS user_phone,
    c.title AS course_title,c.slug AS course_slug,c.price
    FROM applications a
    JOIN users u ON u.id=a.user_id
    JOIN courses c ON c.id=a.course_id
    ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC`);
  res.json({ applications });
});

app.put("/api/admin/applications/:id/decision", auth, adminOnly, async (req,res) => {
  const { status, adminNote } = req.body;
  if (!["approved","rejected"].includes(status)) return res.status(400).json({ error:"Decision must be approved or rejected." });
  const appRow = await get("SELECT id FROM applications WHERE id=?", [req.params.id]);
  if (!appRow) return res.status(404).json({ error:"Application not found." });
  await run("UPDATE applications SET status=?,admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    [status,adminNote || "",req.params.id]);
  const updated = await get(`SELECT a.*,u.first_name,u.last_name,u.email,c.title AS course_title
    FROM applications a JOIN users u ON u.id=a.user_id JOIN courses c ON c.id=a.course_id WHERE a.id=?`, [req.params.id]);
  res.json({ message:`Application ${status}.`, application:updated });
});

app.post("/api/contact", async (req,res) => {
  const { name,email,message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error:"Please complete all fields." });
  await run("INSERT INTO contact_messages(name,email,message) VALUES(?,?,?)", [name.trim(),email.trim().toLowerCase(),message.trim()]);
  res.status(201).json({ message:"Your message has been received. Thank you." });
});

app.get("/api/admin/messages", auth, adminOnly, async (req,res) => {
  const messages = await all("SELECT * FROM contact_messages ORDER BY created_at DESC");
  res.json({ messages });
});

app.put("/api/admin/messages/:id/read", auth, adminOnly, async (req,res) => {
  await run("UPDATE contact_messages SET status='read' WHERE id=?", [req.params.id]);
  res.json({ message:"Message marked as read." });
});

app.get("/admin", (req,res) => res.sendFile(path.join(__dirname,"admin","dashboard.html")));
app.get("/dashboard", (req,res) => res.sendFile(path.join(__dirname,"user","dashboard.html")));

initDb().then(() => {
  app.listen(PORT, () => console.log(`Job and Skill Website running at http://localhost:${PORT}`));
}).catch(err => { console.error("Database startup failed:",err); process.exit(1); });
