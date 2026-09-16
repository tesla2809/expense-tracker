import jwt from "jsonwebtoken";
import { findUserByEmail, findUserById, createUser, verifyPassword } from "../models/userStore.js";

// Helper to generate JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const publicUser = (user) => ({
  _id: user.id,
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

// Register User
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing Details" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const newUser = await createUser({ name, email, password });
    const token = generateToken(newUser.id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: publicUser(newUser),
    });
  } catch (error) {
    console.error("❌ Signup Error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: "User does not exist" });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user.id);
    return res.json({ success: true, message: "Login successful", token, user: publicUser(user) });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// Get User Profile (protected)
const getUserProfile = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("❌ Profile fetch error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export { registerUser, loginUser, getUserProfile };
