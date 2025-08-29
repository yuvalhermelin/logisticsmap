const express = require('express');
const router = express.Router();
const AreaStatus = require('../models/AreaStatus');
const { v4: uuidv4 } = require('uuid');

// Get all area statuses
router.get('/', async (req, res) => {
  try {
    const statuses = await AreaStatus.find().sort({ name: 1 });
    res.json(statuses);
  } catch (error) {
    console.error('Error fetching area statuses:', error);
    res.status(500).json({ error: 'Failed to fetch area statuses' });
  }
});

// Create new area status
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Status name is required' });
    }
    const status = new AreaStatus({ id: uuidv4(), name: name.trim() });
    const saved = await status.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error creating area status:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'An area status with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create area status' });
    }
  }
});

module.exports = router;


