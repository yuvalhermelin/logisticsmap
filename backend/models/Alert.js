const mongoose = require('mongoose');

// Schema for Alert
const alertSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  alertType: {
    type: String,
    required: true,
    enum: ['area', 'global']
  },
  threshold: {
    type: Number,
    required: true,
    min: 0
  },
  campId: {
    type: String,
    required: function() { return this.alertType === 'area'; }
  },
  campName: {
    type: String,
    required: function() { return this.alertType === 'area'; }
  },
  areaId: {
    type: String,
    required: function() { return this.alertType === 'area'; }
  },
  areaName: {
    type: String,
    required: function() { return this.alertType === 'area'; }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTriggered: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for better query performance
alertSchema.index({ alertType: 1, isActive: 1 });
alertSchema.index({ itemName: 1, alertType: 1 });

module.exports = mongoose.model('Alert', alertSchema); 