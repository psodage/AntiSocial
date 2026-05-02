import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import multer from "multer";
import { getAppConfig } from "../config/social.config.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, "../public/uploads");

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const mimeToExt = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const fromMime = mimeToExt[file.mimetype] || "";
    const ext = path.extname(file.originalname || "") || fromMime;
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const mime = (file.mimetype || "").toLowerCase();
  const ok = mime.startsWith("image/") || mime.startsWith("video/");
  if (!ok) {
    return cb(new Error("Only image and video files are allowed."));
  }
  return cb(null, true);
}

export const socialPublicUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter,
});

export function handleSocialPublicUpload(req, res, next) {
  socialPublicUpload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return errorResponse(res, "File exceeds maximum size (100MB).", 400, "file_too_large");
      }
      return errorResponse(res, err.message || "Upload rejected.", 400, "upload_rejected");
    }
    return next();
  });
}

export async function uploadPublicSocialMedia(req, res) {
  try {
    if (!req.file) {
      return errorResponse(res, "No file uploaded.", 400, "no_file");
    }
    const base = getAppConfig().appBaseUrl;
    const url = `${base}/uploads/${req.file.filename}`;
    return successResponse(res, { url }, "File uploaded.");
  } catch (error) {
    console.error("[upload:social-public:error]", { message: error?.message });
    return errorResponse(res, error.message || "Upload failed.", 500, error.code || "upload_error");
  }
}
