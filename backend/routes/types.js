const express = require('express');
const router = express.Router();
const AreaType = require('../models/AreaType');
const { v4: uuidv4 } = require('uuid');

// Get all area types
router.get('/', async (req, res) => {
  try {
    const types = await AreaType.find().sort({ name: 1 });
    res.json(types);
  } catch (error) {
    console.error('Error fetching area types:', error);
    res.status(500).json({ error: 'Failed to fetch area types' });
  }
});

// Create new area type
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Type name is required' });
    }
    const type = new AreaType({ id: uuidv4(), name: name.trim() });
    const saved = await type.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error creating area type:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'An area type with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create area type' });
    }
  }
});

module.exports = router;

