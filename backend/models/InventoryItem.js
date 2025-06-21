const mongoose = require('mongoose');

// Global inventory item catalog schema
const inventoryItemCatalogSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventoryItemCatalog', inventoryItemCatalogSchema); 