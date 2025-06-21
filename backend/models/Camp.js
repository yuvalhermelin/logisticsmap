const mongoose = require('mongoose');

// Schema for Camps
const campSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  positions: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Camp', campSchema); 