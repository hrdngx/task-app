const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  //password: 'root12345',
  password: 'Harada?1221',
  database: 'taskun_data'
});


// 全てのレスポンスに Content-Type ヘッダーを付与（charset=utf-8 を明示）
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});



db.connect(err => {
  if (err) {
    console.error('MySQL 接続エラー:', err);
    process.exit(1);
  }
  console.log('MySQL に接続しました。');
});


function validateString(input, fieldName, minLen = 1, maxLen = 100) {
  if (!input || typeof input !== 'string' || input.trim().length < minLen) {
    return `${fieldName}は必須です。`;
  }
  if (input.length > maxLen) {
    return `${fieldName}は${maxLen}文字以内で入力してください。`;
  }
  if (/[*<>]/.test(input)) {
    return `${fieldName}に不正な文字が含まれています。`;
  }
  return null;
}


// ----------------------
// 認証エンドポイント
/*
app.post('/register', (req, res) => {
  const { username, password, displayName } = req.body;
  let error = validateString(username, "ユーザーネーム", 1, 50) ||
              validateString(password, "パスワード", 6, 255) ||
              validateString(displayName, "表示名", 1, 100);
  if (error) {
    return res.status(400).json({ success: false, message: error });
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
    const insertQuery = 'INSERT INTO users (username, password, display_name, status) VALUES (?, ?, ?, "進行中")';
    db.query(insertQuery, [username, password, displayName], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'データベースエラー' });
      }
      const token = crypto.randomBytes(16).toString('hex');
      res.json({ success: true, token, userId: result.insertId });
    });
  });
});*/
app.post('/register', (req, res) => {
  console.log("POST /register called with body:", req.body);
  const { username, password, displayName } = req.body;
  let error = validateString(username, "ユーザーネーム", 1, 50) ||
              validateString(password, "パスワード", 6, 255) ||
              validateString(displayName, "表示名", 1, 100);
  if (error) {
    console.log("Validation error in /register:", error);
    return res.status(400).json({ success: false, message: error });
  }
  const checkQuery = 'SELECT * FROM users WHERE username = ?';
  db.query(checkQuery, [username], (err, results) => {
    if (err) {
      console.error("Database error in /register:", err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length > 0) {
      console.log("Username already exists:", username);
      return res.status(400).json({ success: false, message: '既に存在するユーザ名です。' });
    }
    const insertQuery = 'INSERT INTO users (username, password, display_name, status) VALUES (?, ?, ?, "進行中")';
    db.query(insertQuery, [username, password, displayName], (err, result) => {
      if (err) {
        console.error("Database error during INSERT in /register:", err);
        return res.status(500).json({ success: false, message: 'データベースエラー' });
      }
      const token = crypto.randomBytes(16).toString('hex');
      console.log("User registered successfully with id:", result.insertId);
      res.json({ success: true, token, userId: result.insertId });
    });
  });
});


/*
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  let error = validateString(username, "ユーザーネーム", 1, 50) || validateString(password, "パスワード", 6, 255);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    
    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'ユーザーネームまたはパスワードが間違っています！' });
    }
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    const token = crypto.randomBytes(16).toString('hex');
    res.json({ success: true, token, userId: results[0].id });
  });
});*/
app.post('/login', (req, res) => {
  console.log("POST /login called with body:", req.body);
  const { username, password } = req.body;
  let error = validateString(username, "ユーザーネーム", 1, 50) || validateString(password, "パスワード", 6, 255);
  if (error) {
    console.log("Validation error in /login:", error);
    return res.status(400).json({ success: false, message: error });
  }
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error("Database error in /login:", err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length === 0) {
      console.log("Login failed: Invalid credentials for username:", username);
      return res.status(400).json({ success: false, message: 'ユーザーネームまたはパスワードが間違っています！' });
    }
    const token = crypto.randomBytes(16).toString('hex');
    console.log("Login successful for username:", username, "UserID:", results[0].id);
    res.json({ success: true, token, userId: results[0].id });
  });
});


// ----------------------
// タスク関連エンドポイント
app.get('/tasks', (req, res) => {
  const query = `
    SELECT tasks.id, tasks.title, tasks.description, tasks.created_at, tasks.status, 
           users.display_name, users.profile_image, users.id as creatorId
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
      created_at: task.created_at,
      status: task.status,
      creatorDisplayName: task.display_name,
      creatorProfileImage: task.profile_image ? Buffer.from(task.profile_image).toString('base64') : null,
      creatorId: task.creatorId
    }));
    res.json({ success: true, tasks });
  });
});


app.post('/tasks', (req, res) => {
  const { userId, title, description } = req.body;
  let error = validateString(title, "タスクタイトル", 1, 50) || validateString(description, "タスク説明", 1, 200);
  if (!userId || error) {
    return res.status(400).json({ success: false, message: error || 'userIdは必須です。' });
  }
  const query = 'INSERT INTO tasks (title, description, creator_id, status) VALUES (?, ?, ?, "進行中")';
  db.query(query, [title, description, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true, taskId: result.insertId });
  });
});


app.post('/tasks/edit', (req, res) => {
  const { taskId, title, description } = req.body;
  let error = validateString(title, "タスクタイトル", 1, 50) || validateString(description, "タスク説明", 1, 200);
  if (!taskId || error) {
    return res.status(400).json({ success: false, message: error || '全ての項目が必要です。' });
  }
  const query = 'UPDATE tasks SET title = ?, description = ? WHERE id = ?';
  db.query(query, [title, description, taskId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true });
  });
});


app.post('/tasks/complete', (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return res.status(400).json({ success: false, message: 'taskId は必須です。' });
  }
  const query = 'UPDATE tasks SET status = "完了済み" WHERE id = ?';
  db.query(query, [taskId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true });
  });
});


// ★ 新規追加：タスク削除エンドポイント
app.post('/tasks/delete', (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return res.status(400).json({ success: false, message: 'taskId は必須です。' });
  }
  const query = 'DELETE FROM tasks WHERE id = ?';
  db.query(query, [taskId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true });
  });
});


app.post('/tasks/join', (req, res) => {
  const { userId, taskId } = req.body;
  if (!userId || !taskId) {
    return res.status(400).json({ success: false, message: 'userId と taskId は必須です。' });
  }
  const checkQuery = 'SELECT * FROM task_participants WHERE task_id = ? AND user_id = ?';
  db.query(checkQuery, [taskId, userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length > 0) {
      return res.json({ success: true, message: '既に参加済みです。' });
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
});


// ----------------------
// プロフィール取得／更新
/*
app.get('/profile/:userId', (req, res) => {
  const userId = req.params.userId;
  const query = 'SELECT display_name, description, profile_image FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }
    const user = results[0];
    res.json({
      success: true,
      displayName: user.display_name,
      description: user.description,
      profileImageBase64: user.profile_image ? Buffer.from(user.profile_image).toString('base64') : null
    });
  });
});*/


// ユーザープロフィール取得／更新
/*
app.get('/profile/:userId', (req, res) => {
  const userId = req.params.userId;
  const query = 'SELECT display_name, description, profile_image, secret_question FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }
    const user = results[0];
    res.json({
      success: true,
      displayName: user.display_name,
      description: user.description,
      profileImageBase64: user.profile_image ? Buffer.from(user.profile_image).toString('base64') : null,
      secretQuestion: user.secret_question || null
    });
  });
});*/

// プロフィール取得エンドポイント
app.get('/profile/:userId', (req, res) => {
  console.log("GET /profile called with params:", req.params);
  const userId = req.params.userId;
  const query = 'SELECT display_name, description, profile_image, secret_question FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Database error in /profile:", err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length === 0) {
      console.log("No user found with id:", userId);
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }
    const user = results[0];
    console.log("Profile fetched for user id:", userId);
    res.json({
      success: true,
      displayName: user.display_name,
      description: user.description,
      profileImageBase64: user.profile_image ? Buffer.from(user.profile_image).toString('base64') : null,
      secretQuestion: user.secret_question || null
    });
  });
});

/*
app.post('/profile', (req, res) => {
  const { userId, displayName, description, profileImageBase64 } = req.body;
  let error = validateString(displayName, "表示名", 1, 100);
  if (!userId || error) {
    return res.status(400).json({ success: false, message: error || 'userId と displayName は必須です。' });
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
});*/


// プロフィール更新エンドポイント
app.post('/profile', (req, res) => {
  console.log("POST /profile called with body:", req.body);
  const { userId, displayName, description, profileImageBase64, secretQuestion, secretAnswer } = req.body;
  let error = validateString(displayName, "表示名", 1, 100);
  if (!userId || error) {
    console.log("Validation error in /profile update:", error || 'userId が不足しています。');
    return res.status(400).json({ success: false, message: error || 'userId と displayName は必須です。' });
  }
  let imageBuffer = null;
  if (profileImageBase64) {
    try {
      imageBuffer = Buffer.from(profileImageBase64, 'base64');
    } catch (e) {
      console.error("Error converting profileImageBase64 in /profile:", e);
      return res.status(400).json({ success: false, message: 'Invalid profileImageBase64 format' });
    }
  }
  const query = 'UPDATE users SET display_name = ?, description = ?, profile_image = ?, secret_question = ?, secret_answer = ? WHERE id = ?';
  db.query(query, [displayName, description || null, imageBuffer, secretQuestion || null, secretAnswer || null, userId], (err, result) => {
    if (err) {
      console.error("Database error in /profile update:", err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    console.log("Profile updated for user id:", userId);
    res.json({ success: true });
  });
});




// ----------------------
// タスクスケジュール取得／追加／編集／削除
app.get('/tasks/schedule/:taskId', (req, res) => {
  const { taskId } = req.params;
  const query = `
    SELECT ts.id, ts.scheduled_date, ts.schedule_description, ts.finalized,
           u.display_name AS registeredUserName,
           u.profile_image AS registeredUserProfileImage
    FROM task_schedules ts
    JOIN users u ON ts.registered_user_id = u.id
    WHERE ts.task_id = ?
    ORDER BY ts.scheduled_date ASC
  `;


  db.query(query, [taskId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    const schedules = results.map(item => ({
      id: item.id,
      scheduled_date: item.scheduled_date,
      schedule_description: item.schedule_description,
      finalized: item.finalized === 1,
      registeredUserName: item.registeredUserName,
      registeredUserProfileImage: item.registeredUserProfileImage ? Buffer.from(item.registeredUserProfileImage).toString('base64') : null
    }));
    res.json({ success: true, schedules });
  });
});


app.post('/tasks/schedule', (req, res) => {
  const { taskId, scheduledDate, schedule, userId } = req.body;
  let error = validateString(scheduledDate, "日時", 1, 50) || validateString(schedule, "スケジュール内容", 1, 200);
  if (!taskId || !userId || error) {
    return res.status(400).json({ success: false, message: error || 'taskId, scheduledDate, schedule, userId は必須です。' });
  }
  const insertQuery = `
    INSERT INTO task_schedules (task_id, scheduled_date, schedule_description, registered_user_id, finalized)
    VALUES (?, ?, ?, ?, false)
  `;
  db.query(insertQuery, [taskId, scheduledDate, schedule, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true, scheduleId: result.insertId });
  });
});


app.post('/tasks/schedule/edit', (req, res) => {
  const { scheduleId, scheduledDate, schedule } = req.body;
  let error = validateString(scheduledDate, "日時", 1, 50) || validateString(schedule, "スケジュール内容", 1, 200);
  if (!scheduleId || error) {
    return res.status(400).json({ success: false, message: error || '全ての項目が必要です。' });
  }
  const query = 'UPDATE task_schedules SET scheduled_date = ?, schedule_description = ? WHERE id = ?';
  db.query(query, [scheduledDate, schedule, scheduleId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true });
  });
});


app.post('/tasks/schedule/delete', (req, res) => {
  const { scheduleId } = req.body;
  if (!scheduleId) {
    return res.status(400).json({ success: false, message: 'scheduleId は必須です。' });
  }
  const query = 'DELETE FROM task_schedules WHERE id = ?';
  db.query(query, [scheduleId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    res.json({ success: true });
  });
});


app.get('/tasks/schedule/votes/:scheduleId', (req, res) => {
  const { scheduleId } = req.params;
  const query = 'SELECT COUNT(*) AS voteCount FROM schedule_votes WHERE schedule_id = ?';
  db.query(query, [scheduleId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true, voteCount: results[0].voteCount });
  });
});


app.post('/tasks/schedule/vote', (req, res) => {
  const { scheduleId, userId } = req.body;
  if (!scheduleId || !userId) {
    return res.status(400).json({ success: false, message: 'scheduleId と userId は必須です。' });
  }
  const checkQuery = 'SELECT * FROM schedule_votes WHERE schedule_id = ? AND user_id = ?';
  db.query(checkQuery, [scheduleId, userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    if (results.length > 0) {
      return res.status(400).json({ success: false, message: '既に投票済みです。' });
    }
    const insertQuery = 'INSERT INTO schedule_votes (schedule_id, user_id, vote) VALUES (?, ?, 1)';
    db.query(insertQuery, [scheduleId, userId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false });
      }
      const countQuery = 'SELECT COUNT(*) AS voteCount FROM schedule_votes WHERE schedule_id = ?';
      db.query(countQuery, [scheduleId], (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ success: false });
        }
        res.json({ success: true, voteCount: results[0].voteCount });
      });
    });
  });
});



app.get('/tasks/schedule/voteDetails/:scheduleId', (req, res) => {
  const { scheduleId } = req.params;
  const query = `
    SELECT u.id as userId, u.display_name, u.profile_image 
    FROM schedule_votes sv 
    JOIN users u ON sv.user_id = u.id 
    WHERE sv.schedule_id = ?
  `;
  db.query(query, [scheduleId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    const details = results.map(row => ({
      userId: row.userId,
      displayName: row.display_name,
      profileImageBase64: row.profile_image ? Buffer.from(row.profile_image).toString('base64') : null
    }));
    res.json({ success: true, details });
  });
});


app.get('/tasks/participants/:taskId', (req, res) => {
  const { taskId } = req.params;
  const query = `
    SELECT u.id as userId, u.display_name, u.profile_image 
    FROM task_participants tp 
    JOIN users u ON tp.user_id = u.id 
    WHERE tp.task_id = ?
  `;
  db.query(query, [taskId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    const participants = results.map(row => ({
      userId: row.userId,
      displayName: row.display_name,
      profileImageBase64: row.profile_image ? Buffer.from(row.profile_image).toString('base64') : null
    }));
    res.json({ success: true, participants });
  });
});


app.post('/tasks/schedule/finalize', (req, res) => {
  const { taskId, scheduleId } = req.body;
  if (!taskId || !scheduleId) {
    return res.status(400).json({ success: false, message: 'taskId と scheduleId は必須です。' });
  }
  const updateQuery = 'UPDATE task_schedules SET finalized = true WHERE id = ? AND task_id = ?';
  db.query(updateQuery, [scheduleId, taskId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true });
  });
});




// ----------------------
// GET /secretQuestion エンドポイント
app.get('/secretQuestion', (req, res) => {
  console.log("GET /secretQuestion called with query:", req.query);
  const username = req.query.username;
  if (!username) {
    console.log("username not provided in /secretQuestion");
    return res.status(400).json({ success: false, message: 'username は必須です。' });
  }
  const query = 'SELECT secret_question FROM users WHERE username = ?';
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Database error in /secretQuestion:", err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length === 0) {
      console.log("No user found with username in /secretQuestion:", username);
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }
    const secretQuestion = results[0].secret_question;
    console.log("Fetched secret question for user", username, ":", secretQuestion);
    if (!secretQuestion) {
      console.log("Secret question not set for user", username);
      return res.status(400).json({ success: false, message: '秘密の質問が登録されていません。新規登録してください。' });
    }
    res.json({ success: true, secretQuestion });
  });
});




// ----------------------
// POST /resetPassword エンドポイント
app.post('/resetPassword', (req, res) => {
  console.log("POST /resetPassword called with body:", req.body);
  const { username, secretAnswer, newPassword } = req.body;
  let error = validateString(username, "ユーザーネーム", 1, 50) || validateString(newPassword, "パスワード", 6, 255);
  if (error || !secretAnswer) {
    console.log("Validation error in /resetPassword:", error || 'secretAnswer は不足しています。');
    return res.status(400).json({ success: false, message: error || 'secretAnswer は必須です。' });
  }
  const query = 'SELECT secret_answer FROM users WHERE username = ?';
  db.query(query, [username], (err, results) => {
    if (err) {
      console.error("Database error in /resetPassword (select):", err);
      return res.status(500).json({ success: false, message: 'データベースエラー' });
    }
    if (results.length === 0) {
      console.log("User not found in /resetPassword:", username);
      return res.status(404).json({ success: false, message: 'ユーザーが見つかりません' });
    }
    const storedSecretAnswer = results[0].secret_answer;
    console.log("Stored secret answer for user", username, ":", storedSecretAnswer);
    if (!storedSecretAnswer) {
      console.log("Secret question not registered for user", username);
      return res.status(400).json({ success: false, message: '秘密の質問が登録されていません。新規登録してください。' });
    }
    if (storedSecretAnswer !== secretAnswer) {
      console.log("Secret answer mismatch for user", username);
      return res.status(400).json({ success: false, message: '秘密の質問の答えが正しくありません。' });
    }
    const updateQuery = 'UPDATE users SET password = ? WHERE username = ?';
    db.query(updateQuery, [newPassword, username], (err, result) => {
      if (err) {
        console.error("Error updating password for user", username, ":", err);
        return res.status(500).json({ success: false, message: 'データベースエラー' });
      }
      console.log("Password updated successfully for user", username);
      res.json({ success: true, message: 'パスワードがリセットされました。' });
    });
  });
});



const PORT = process.env.PORT || 3000;
//const HOST = '172.18.104.114';
//const HOST = '172.18.88.46';
//const HOST = '192.168.179.10';
//const HOST ='172.18.104.114';
const HOST = '172.18.88.46';


app.listen(PORT, HOST, () => {
  console.log(`サーバーは ${HOST}:${PORT} で起動中です。`);
});
