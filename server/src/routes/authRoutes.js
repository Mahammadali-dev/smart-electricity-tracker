import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { UsageProfile } from "../models/UsageProfile.js";
import { authenticateToken } from "../middleware/auth.js";
import { createBlankProfile, defaultSettingsForPlace, normalizePlaceType } from "../utils/placeAutoConfig.js";

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      placeType: user.placeType || "home",
    },
    process.env.JWT_SECRET || "development-secret",
    { expiresIn: "7d" }
  );
}

function deriveNameFromEmail(email) {
  const localPart = String(email || "user")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();

  if (!localPart) {
    return "Smart User";
  }

  return localPart
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sanitizeName(name, fallback = "Smart User") {
  const trimmed = String(name || "")
    .replace(/\s+/g, " ")
    .trim();

  return trimmed || fallback;
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    placeType: user.placeType || "home",
    createdAt: user.createdAt,
  };
}

function profileSettings(profile, placeType = "home") {
  return profile?.settings || defaultSettingsForPlace(placeType);
}

function profileSetupState(profile) {
  return Boolean(profile?.setupCompleted);
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, placeType } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Username is required." });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const cleanName = sanitizeName(name, deriveNameFromEmail(email));
    if (cleanName.length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters long." });
    }

    const normalizedPlaceType = normalizePlaceType(placeType);
    if (!placeType) {
      return res.status(400).json({ message: "Select your place type to continue." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: cleanName,
      email: normalizedEmail,
      password: passwordHash,
      placeType: normalizedPlaceType,
    });
    const profile = await UsageProfile.create({ user: user._id, ...createBlankProfile(normalizedPlaceType) });
    const token = createToken(user);

    return res.status(201).json({
      token,
      user: serializeUser(user),
      settings: profileSettings(profile, normalizedPlaceType),
      setupCompleted: false,
    });
  } catch (error) {
    console.error("Signup error", error);
    return res.status(500).json({ message: "Unable to create account right now." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const profile = await UsageProfile.findOne({ user: user._id });
    const token = createToken(user);

    return res.json({
      token,
      user: serializeUser(user),
      settings: profileSettings(profile, user.placeType),
      setupCompleted: profileSetupState(profile),
    });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({ message: "Unable to login right now." });
  }
});

router.get("/user-data", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const profile = await UsageProfile.findOne({ user: req.user.id });
    return res.json({
      user: serializeUser(user),
      settings: profileSettings(profile, user.placeType),
      setupCompleted: profileSetupState(profile),
    });
  } catch (error) {
    console.error("User data error", error);
    return res.status(500).json({ message: "Unable to load user data." });
  }
});

router.patch("/user-profile", authenticateToken, async (req, res) => {
  try {
    const cleanName = sanitizeName(req.body?.name, "");

    if (cleanName.length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters long." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.name = cleanName;
    await user.save();

    return res.json({
      user: serializeUser(user),
      token: createToken(user),
    });
  } catch (error) {
    console.error("Profile update error", error);
    return res.status(500).json({ message: "Unable to update profile right now." });
  }
});

export default router;


