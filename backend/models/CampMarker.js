const mongoose = require('mongoose');

// Schema for a camp-level marker item
const campMarkerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  campId: {
    type: String,
    required: true,
    index: true
  },
  // Geographic location of the marker
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  // Display color chosen from a preset palette
  color: { type: String, required: true, default: '#3388ff' },
  // Inventory-like data attached to the marker
  itemId: { type: String, required: true },
  itemName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  expiryDate: { type: Date, required: false, default: null },
  addedAt: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

campMarkerSchema.index({ campId: 1 });
campMarkerSchema.index({ expiryDate: 1 });
campMarkerSchema.index({ itemName: 1 });

module.exports = mongoose.model('CampMarker', campMarkerSchema);


