const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["pothole", "garbage", "water", "streetlight", "other"]
  },
  description: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 200
  },
  photo_url: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true,
    maxlength: 200
  },
  lat: {
    type: Number,
    default: null
  },
  lng: {
    type: Number,
    default: null
  },
  upvotes: {
    type: Number,
    default: 0
  },
  resolved: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Issue", issueSchema);
