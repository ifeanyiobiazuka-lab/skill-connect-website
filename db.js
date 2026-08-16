const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "database", "jobandskill.db");
const fs = require("fs");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    account_type TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    level TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  )`);

  await run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    programme TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(course_id) REFERENCES courses(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const courseCount = await get(`SELECT COUNT(*) AS count FROM courses`);
  if (!courseCount.count) {
    const courses = [
      ["web-development","Complete Web Development","Technology","Build modern websites and full-stack web applications.","Beginner to Advanced",50000],
      ["frontend-development","Frontend Development","Technology","Master HTML, CSS, JavaScript and modern frontend development.","Beginner to Advanced",45000],
      ["ui-ux-design","UI/UX Design","Creative","Learn user research, wireframing, prototyping and interface design.","Beginner to Advanced",45000],
      ["data-analysis","Data Analysis","Technology","Turn data into useful business insights with practical analysis skills.","Beginner to Advanced",55000],
      ["digital-marketing","Digital Marketing","Business","Learn strategy, content, social media and digital campaign fundamentals.","Beginner to Advanced",40000],
      ["cybersecurity","Cybersecurity Fundamentals","Technology","Understand security principles, threats, protection and safe computing.","Beginner to Intermediate",55000],
      ["graphic-design","Graphic Design","Creative","Develop practical visual communication and design skills.","Beginner to Advanced",40000],
      ["professional-software-engineering","Professional Software Engineering","Technology","A career-focused path covering software development practices and projects.","Intermediate to Advanced",75000]
    ];
    for (const c of courses) {
      await run(`INSERT INTO courses (slug,title,category,description,level,price) VALUES (?,?,?,?,?,?)`, c);
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@jobandskill.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const admin = await get(`SELECT id FROM users WHERE email = ?`, [adminEmail.toLowerCase()]);
  if (!admin) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await run(`INSERT INTO users
      (first_name,last_name,email,phone,account_type,password_hash,role)
      VALUES (?,?,?,?,?,?,?)`,
      ["Website","Administrator",adminEmail.toLowerCase(),"","Administrator",hash,"admin"]);
  }
}

module.exports = { db, run, get, all, initDb };
