const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database/init');

// Ensure data directory exists
const dataDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Initialize DB
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/editions', require('./routes/editions'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/pdf',      require('./routes/pdf'));
app.use('/api/settings', require('./routes/settings'));

// SPA fallback: serve frontend for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`🗞️  Zoom. Schülerzeitung läuft auf http://localhost:${PORT}`);
  console.log(`📝 Admin-Bereich: http://localhost:${PORT}/admin`);
});
