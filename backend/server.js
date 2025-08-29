const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const campRoutes = require('./routes/camps');
const inventoryRoutes = require('./routes/inventory');
const alertRoutes = require('./routes/alerts');
const typeRoutes = require('./routes/types');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/logisticmap';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/camps', campRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/types', typeRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  // One-time migration: ensure archived defaults to false where missing
  const Camp = require('./models/Camp');
  Camp.updateMany({ archived: { $exists: false } }, { $set: { archived: false } })
    .then((result) => {
      if (result && result.modifiedCount) {
        console.log(`Migration: set archived=false on ${result.modifiedCount} camps`);
      }
    })
    .catch((e) => console.warn('Migration error (archived default):', e));
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Performing graceful shutdown...');
  
  try {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  
  try {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Handle MongoDB connection events
mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
}); 