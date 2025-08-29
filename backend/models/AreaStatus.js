const mongoose = require('mongoose');

const areaStatusSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('AreaStatus', areaStatusSchema);


