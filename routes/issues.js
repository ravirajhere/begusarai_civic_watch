const express = require("express");
const router = express.Router();
const Issue = require("../models/Issue");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer — memory storage (photo ko Cloudinary pe bhejne ke liye)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"), false);
    }
  }
});

// ============================================
// GET /api/issues — saare issues
// ============================================
router.get("/", async (req, res, next) => {
  try {
    const { type, resolved } = req.query;

    let filter = {};
    if (type && type !== "all") filter.type = type;
    if (resolved === "true") filter.resolved = true;
    if (resolved === "false") filter.resolved = false;

    const issues = await Issue.find(filter).sort({ timestamp: -1 });

    res.json({
      success: true,
      count: issues.length,
      data: issues
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// GET /api/issues/:id — ek issue
// ============================================
router.get("/:id", async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }
    res.json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
});

// ============================================
// POST /api/issues — naya issue (photo ke saath)
// ============================================
router.post("/", upload.single("photo"), async (req, res, next) => {
  try {
    const { type, description, location, lat, lng } = req.body;

    // Validation
    if (!type || !description || !location) {
      return res.status(400).json({
        success: false,
        message: "type, description, location required"
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Photo required" });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "begusarai-civic-watch",
          resource_type: "image",
          transformation: [{ width: 800, quality: "auto" }]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Create issue
    const issue = await Issue.create({
      type,
      description,
      photo_url: result.secure_url,
      location,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null
    });

    res.status(201).json({
      success: true,
      message: "Issue reported successfully",
      data: issue
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// PUT /api/issues/:id/upvote — upvote
// ============================================
router.put("/:id/upvote", async (req, res, next) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { $inc: { upvotes: 1 } },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    res.json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
});

// ============================================
// PUT /api/issues/:id/resolve — toggle resolved
// ============================================
router.put("/:id/resolve", async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    issue.resolved = !issue.resolved;
    await issue.save();

    res.json({ success: true, data: issue });
  } catch (err) {
    next(err);
  }
});

// ============================================
// DELETE /api/issues/:id
// ============================================
router.delete("/:id", async (req, res, next) => {
  try {
    const issue = await Issue.findByIdAndDelete(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }
    res.json({ success: true, message: "Issue deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
