// server.js
const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');

const app = express();
// 画像等の大きなペイロードも受け取れるようにする（10MBまで）
app.use(express.json({ limit: '10mb' }));

// MySQL 接続設定（適宜ご自身の環境に合わせて変更）
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  //password: 'root12345',
  password:'Harada?1221',
  database: 'taskun_data'
});

db.connect(err => {
  if (err) {
    console.error('MySQL 接続エラー:', err);
    process.exit(1);
  }
  console.log('MySQL に接続しました。');
});

// ----------------------
// 認証エンドポイント（/register, /login）
// ----------------------
app.post('/register', (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password || !displayName) {
    return res.status(400).json({ success: false, message: '全ての項目を入力してください。' });
  }
  const checkQuery = 'SELECT * FROM users WHERE username = ?';
  db.query(checkQuery, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length > 0) {
      return res.status(400).json({ success: false, message: '既に存在するユーザ名です。' });
    }
    const insertQuery = 'INSERT INTO users (username, password, display_name) VALUES (?, ?, ?)';
    db.query(insertQuery, [username, password, displayName], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'データベースエラー' });
      }
      const token = crypto.randomBytes(16).toString('hex');
      res.json({ success: true, token, userId: result.insertId });
    });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '全ての項目を入力してください。' });
  }
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'ユーザ名またはパスワードが正しくありません。' });
    }
    const token = crypto.randomBytes(16).toString('hex');
    res.json({ success: true, token, userId: results[0].id });
  });
});

// ----------------------
// タスク関連エンドポイント
// ----------------------

// GET /tasks - タスクリスト取得（ユーザー情報も結合）
app.get('/tasks', (req, res) => {
  const query = `
    SELECT tasks.id, tasks.title, tasks.description, tasks.created_at, 
           users.display_name, users.profile_image
    FROM tasks 
    JOIN users ON tasks.creator_id = users.id
    ORDER BY tasks.created_at DESC
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    const tasks = results.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      createdAt: task.created_at,
      creatorDisplayName: task.display_name,
      // バイナリを base64 文字列に変換
      creatorProfileImage: task.profile_image ? Buffer.from(task.profile_image).toString('base64') : null
    }));
    res.json({ success: true, tasks });
  });
});

// POST /tasks - タスク登録
app.post('/tasks', (req, res) => {
  const { userId, title, description } = req.body;
  if (!userId || !title || !description) {
    return res.status(400).json({ success: false, message: '全ての項目を入力してください。' });
  }
  const query = 'INSERT INTO tasks (title, description, creator_id) VALUES (?, ?, ?)';
  db.query(query, [title, description, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true, taskId: result.insertId });
  });
});

// POST /tasks/join - タスク参加（参加者情報を記録）
app.post('/tasks/join', (req, res) => {
  const { userId, taskId } = req.body;
  if (!userId || !taskId) {
    return res.status(400).json({ success: false, message: 'userIdとtaskIdは必須です。' });
  }
  const query = 'INSERT INTO task_participants (task_id, user_id) VALUES (?, ?)';
  db.query(query, [taskId, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true });
  });
});

// ----------------------
// プロフィール更新エンドポイント
// ----------------------
// profileImage はフロント側で base64 文字列として送信する想定
app.post('/profile', (req, res) => {
  const { userId, displayName, description, profileImageBase64 } = req.body;
  if (!userId || !displayName) {
    return res.status(400).json({ success: false, message: 'userIdとdisplayNameは必須です。' });
  }
  
  let imageBuffer = null;
  if (profileImageBase64) {
    try {
      imageBuffer = Buffer.from(profileImageBase64, 'base64');
    } catch (e) {
      console.error('Error converting profileImageBase64', e);
      return res.status(400).json({ success: false, message: 'Invalid profileImageBase64 format' });
    }
  }
  
  const query = 'UPDATE users SET display_name = ?, description = ?, profile_image = ? WHERE id = ?';
  db.query(query, [displayName, description || null, imageBuffer, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true });
  });
});



// サーバー起動：固定IP 192.168.179.10 でリッスン
const PORT = process.env.PORT || 3000;
//const HOST = '192.168.179.10';
//const HOST = '172.18.104.114';

const HOST = '192.168.46.10';

app.listen(PORT, HOST, () => {
  console.log(`サーバーは ${HOST}:${PORT} で起動中です。`);
});