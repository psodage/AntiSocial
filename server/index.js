import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createSocialRoutes } from "./routes/social.routes.js";
import { getProviderEnvStatus, getRequiredEnvStatus } from "./config/social.config.js";

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "antisocial";
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiry = "7d";

if (!mongoUri) {
  throw new Error("MONGODB_URI is required. Add it to your .env file.");
}
if (!jwtSecret) {
  throw new Error("JWT_SECRET is required. Add it to your .env file.");
}

console.info("[startup:env]", {
  required: getRequiredEnvStatus(),
  providers: getProviderEnvStatus(),
});

const client = new MongoClient(mongoUri);
await client.connect();
await mongoose.connect(mongoUri, { dbName });

const db = client.db(dbName);
const usersCollection = db.collection("users");

await usersCollection.createIndex({ email: 1 }, { unique: true });

app.use(cors());
app.use(express.json());

function verifyInstagramWebhookToken(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error("[instagram:webhook:verify:error] Missing INSTAGRAM_WEBHOOK_VERIFY_TOKEN.");
    return res.status(500).send("Webhook verify token is not configured.");
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    console.info("[instagram:webhook:verify:success]");
    return res.status(200).send(challenge);
  }

  console.warn("[instagram:webhook:verify:failed]", {
    mode: mode || "missing",
    hasToken: Boolean(token),
  });
  return res.sendStatus(403);
}

function receiveInstagramWebhook(req, res) {
  console.info("[instagram:webhook:event]", {
    body: req.body,
  });
  return res.sendStatus(200);
}

function parseUserId(userId) {
  if (!ObjectId.isValid(userId)) {
    return null;
  }
  return new ObjectId(userId);
}

function createAuthResponse(user) {
  const token = jwt.sign({ userId: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: jwtExpiry });
  return {
    token,
    user: {
      email: user.email,
      name: user.name,
      onboardingCompleted: Boolean(user.onboardingCompleted),
      onboardingSkippedPlatforms: Array.isArray(user.onboardingSkippedPlatforms) ? user.onboardingSkippedPlatforms : [],
    },
  };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    req.auth = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid authentication token." });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ error: "Name, email, and password (min. 6 chars) are required." });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      email,
      name,
      passwordHash,
      onboardingCompleted: false,
      onboardingSkippedPlatforms: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const insertResult = await usersCollection.insertOne(user);
    user._id = insertResult.insertedId;

    return res.status(201).json(createAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ error: "Failed to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (!user.passwordHash) {
      return res.status(401).json({ error: "Account must reset password before sign in." });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    return res.json(createAuthResponse(user));
  } catch {
    return res.status(500).json({ error: "Failed to sign in." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const userId = parseUserId(req.auth.userId);
    if (!userId) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }
    return res.json({
      user: {
        email: user.email,
        name: user.name,
        onboardingCompleted: Boolean(user.onboardingCompleted),
        onboardingSkippedPlatforms: Array.isArray(user.onboardingSkippedPlatforms) ? user.onboardingSkippedPlatforms : [],
      },
    });
  } catch {
    return res.status(401).json({ error: "Invalid authentication token." });
  }
});

app.put("/api/users/me", requireAuth, async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const updates = { name, email, updatedAt: new Date() };
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    const userId = parseUserId(req.auth.userId);
    if (!userId) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }
    const result = await usersCollection.findOneAndUpdate({ _id: userId }, { $set: updates }, { returnDocument: "after" });

    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      user: {
        email: result.email,
        name: result.name,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: "Email is already used by another account." });
    }
    return res.status(500).json({ error: "Failed to save user profile." });
  }
});

app.put("/api/users/me/onboarding", requireAuth, async (req, res) => {
  try {
    const userId = parseUserId(req.auth.userId);
    if (!userId) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }

    const onboardingCompleted = Boolean(req.body?.onboardingCompleted);
    const onboardingSkippedPlatforms = Array.isArray(req.body?.onboardingSkippedPlatforms)
      ? req.body.onboardingSkippedPlatforms.filter((item) => typeof item === "string")
      : [];

    const result = await usersCollection.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          onboardingCompleted,
          onboardingSkippedPlatforms,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      onboardingCompleted: Boolean(result.onboardingCompleted),
      onboardingSkippedPlatforms: Array.isArray(result.onboardingSkippedPlatforms) ? result.onboardingSkippedPlatforms : [],
    });
  } catch {
    return res.status(500).json({ error: "Unable to update onboarding state." });
  }
});

app.get("/api/webhooks/instagram", verifyInstagramWebhookToken);
app.post("/api/webhooks/instagram", receiveInstagramWebhook);

app.use("/api/social", createSocialRoutes(requireAuth));

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
