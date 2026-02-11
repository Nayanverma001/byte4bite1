/**
 * FoodCycle — Local server
 * Serves the website and stores data in data.json.
 * Run: npm install && npm start
 * Open: http://localhost:3000
 */
var express = require('express');
var path = require('path');
var fs = require('fs');

var app = express();
var PORT = process.env.PORT || 3000;
var DATA_FILE = path.join(__dirname, 'data.json');

// Middleware: parse JSON body
app.use(express.json({ limit: '1mb' }));

// Ensure data file exists
function ensureDataFile() {
  try {
    fs.accessSync(DATA_FILE);
  } catch (e) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      foods: [],
      interests: [],
      notifications: [],
      reviews: [],
      messages: []
    }, null, 2));
  }
}

// GET /api/store — return full store (for loading on page load)
app.get('/api/store', function (req, res) {
  ensureDataFile();
  try {
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    var data = JSON.parse(raw);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// POST /api/store — save full store (called after any change)
app.post('/api/store', function (req, res) {
  ensureDataFile();
  try {
    var data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid data' });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// Serve static files (HTML, CSS, JS) from current directory — after API routes
app.use(express.static(__dirname));

// SPA: serve index.html for any non-file route so refresh works
app.get('*', function (req, res, next) {
  var ext = path.extname(req.path);
  if (ext && ext.length > 0) return next(); // let static serve it
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  console.log('FoodCycle server running at http://localhost:' + PORT);
  console.log('Open this URL in your browser. Data is saved to data.json');
});
