const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const PolygonArea = require('../models/PolygonArea');
const Camp = require('../models/Camp');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now - can be restricted later if needed
    cb(null, true);
  }
});

// Upload file to a polygon area
router.post('/:campId/polygons/:polygonId/upload', upload.single('file'), async (req, res) => {
  try {
    const { campId, polygonId } = req.params;
    const { customName } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!customName || !customName.trim()) {
      return res.status(400).json({ error: 'Custom name is required' });
    }
    
    // Verify camp and polygon exist
    const camp = await Camp.findOne({ id: campId });
    if (!camp) {
      // Clean up uploaded file if camp doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    const polygonArea = await PolygonArea.findOne({ id: polygonId, campId: campId });
    if (!polygonArea) {
      // Clean up uploaded file if polygon doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Polygon area not found' });
    }
    
    // Create file metadata
    const fileMetadata = {
      id: uuidv4(),
      customName: customName.trim(),
      originalName: req.file.originalname,
      fileName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date()
    };
    
    // Add file to polygon area
    polygonArea.files.push(fileMetadata);
    await polygonArea.save();
    
    // Return the camp with all its polygon areas for consistency with other endpoints
    const polygonAreas = await PolygonArea.find({ campId: campId });
    
    res.status(201).json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Download file from polygon area
router.get('/:campId/polygons/:polygonId/files/:fileId/download', async (req, res) => {
  try {
    const { campId, polygonId, fileId } = req.params;
    
    // Verify polygon exists and get file metadata
    const polygonArea = await PolygonArea.findOne({ id: polygonId, campId: campId });
    if (!polygonArea) {
      return res.status(404).json({ error: 'Polygon area not found' });
    }
    
    const fileMetadata = polygonArea.files.find(file => file.id === fileId);
    if (!fileMetadata) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = path.join(uploadsDir, fileMetadata.fileName);
    
    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.originalName}"`);
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Length', fileMetadata.fileSize);
    
    // Stream the file to the client
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete file from polygon area
router.delete('/:campId/polygons/:polygonId/files/:fileId', async (req, res) => {
  try {
    const { campId, polygonId, fileId } = req.params;
    
    // Verify camp exists
    const camp = await Camp.findOne({ id: campId });
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }
    
    // Find polygon and file
    const polygonArea = await PolygonArea.findOne({ id: polygonId, campId: campId });
    if (!polygonArea) {
      return res.status(404).json({ error: 'Polygon area not found' });
    }
    
    const fileIndex = polygonArea.files.findIndex(file => file.id === fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileMetadata = polygonArea.files[fileIndex];
    
    // Remove file from database
    polygonArea.files.splice(fileIndex, 1);
    await polygonArea.save();
    
    // Remove file from disk
    const filePath = path.join(uploadsDir, fileMetadata.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Return the camp with all its polygon areas
    const polygonAreas = await PolygonArea.find({ campId: campId });
    
    res.json({
      ...camp.toObject(),
      polygonAreas
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Get files list for a polygon area
router.get('/:campId/polygons/:polygonId/files', async (req, res) => {
  try {
    const { campId, polygonId } = req.params;
    
    const polygonArea = await PolygonArea.findOne({ id: polygonId, campId: campId });
    if (!polygonArea) {
      return res.status(404).json({ error: 'Polygon area not found' });
    }
    
    res.json(polygonArea.files || []);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

module.exports = router; 