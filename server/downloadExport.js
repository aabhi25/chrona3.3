const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Serve the database export file
app.get('/download/database-export', (req, res) => {
  const filePath = path.join(__dirname, '..', 'database_exports', 'chrona_database_export.tar.gz');
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Export file not found' });
  }

  // Set headers for download
  res.setHeader('Content-Disposition', 'attachment; filename=chrona_database_export.tar.gz');
  res.setHeader('Content-Type', 'application/gzip');

  // Send the file
  res.sendFile(filePath);
});

// Start server on a different port
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📥 Database export download server running on http://0.0.0.0:${PORT}`);
  console.log(`📥 Download link: http://0.0.0.0:${PORT}/download/database-export`);
});