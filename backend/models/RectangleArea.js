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
  }
}, { _id: false });

// Schema for Rectangle Areas (now a top-level collection)
const rectangleAreaSchema = new mongoose.Schema({
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
  bounds: {
    southWest: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    northEast: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  rotation: {
    type: Number,
    default: 0
  },
  center: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  inventoryItems: [inventoryItemSchema]
}, {
  timestamps: true
});

// Indexes for better query performance
rectangleAreaSchema.index({ campId: 1 });
rectangleAreaSchema.index({ 'inventoryItems.name': 1 });

module.exports = mongoose.model('RectangleArea', rectangleAreaSchema); 