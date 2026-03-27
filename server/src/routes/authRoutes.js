import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { UsageProfile } from "../models/UsageProfile.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    },
    process.env.JWT_SECRET || "development-secret",
    { expiresIn: "7d" }
  );
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: passwordHash,
    });

    await UsageProfile.create({ user: user._id });

    const token = createToken(user);
    return res.status(201).json({ token, user: serializeUser(user) });
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

    const token = createToken(user);
    return res.json({ token, user: serializeUser(user) });
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
    return res.json({ user: serializeUser(user), settings: profile?.settings || { dailyLimit: 28, darkMode: true } });
  } catch (error) {
    console.error("User data error", error);
    return res.status(500).json({ message: "Unable to load user data." });
  }
});

export default router;
