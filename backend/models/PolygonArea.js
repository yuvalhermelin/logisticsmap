const mongoose = require('mongoose');

// Schema for Inventory Items
const inventoryItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  // Optional expiry date for the entire quantity in this batch
  expiryDate: {
    type: Date,
    required: false,
    default: null
  },
  // Timestamp when this batch was added
  addedAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { _id: false });

// Schema for uploaded files
const fileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  customName: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true  // The actual file name stored on disk
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Schema for Polygon Areas (now a top-level collection)
const polygonAreaSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  campId: {
    type: String,
    required: true,
    index: true // Index for efficient queries by camp
  },
  positions: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  }],
  inventoryItems: [inventoryItemSchema],
  files: [fileSchema]
}, {
  timestamps: true
});

// Indexes for better query performance
polygonAreaSchema.index({ campId: 1 });
polygonAreaSchema.index({ 'inventoryItems.name': 1 });
polygonAreaSchema.index({ 'inventoryItems.expiryDate': 1 });

module.exports = mongoose.model('PolygonArea', polygonAreaSchema); 