const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const bcryptSalt = bcrypt.genSaltSync(10);
const cors = require("cors");
const app = express();
const User = require("./model/User");
require("dotenv").config();
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
const CookieParser = require("cookie-parser");
const jwtSecret = process.env.JWT_SECRET;
const jwt = require("jsonwebtoken");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const corsOptions = {
  origin: process.env.SITE_URL,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(CookieParser());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
  });

// OpenAI Completions Route
app.post("/completions", async (req, res) => {
  const api_key = process.env.OPENAI_API_KEY;
  if (!api_key) {
    console.error("OPENAI_API_KEY is not defined in environment variables");
    return res.status(500).json({ error: "Server configuration error: API key not found" });
  }

  const startTime = Date.now();
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: req.body.message }],
      max_tokens: 100,
    }),
  };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", options);
    const data = await response.json();
    const endTime = Date.now();
    console.log(`OpenAI API response time: ${endTime - startTime}ms`);
    res.send(data);
  } catch (err) {
    console.error("OpenAI API Error:", err);
    res.status(500).json({ error: "Failed to get completion" });
  }
});

// Register
app.post("/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  // Validation
  if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9]+$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3-20 characters long and alphanumeric" });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }
  if (!password || password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  try {
    const hashPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({
      username,
      email,
      password: hashPassword,
    });

    jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
      if (err) {
        console.error("Failed to create JWT token:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.cookie("token", token).status(201).json({ id: createdUser._id, message: "Registration successful! Please log in." });
      }
    });
  } catch (err) {
    console.error("Failed to register user:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const foundUser = await User.findOne({ username });
  if (foundUser) {
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
        if (err) {
          console.error("Failed to create JWT token:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
        res.cookie("token", token).json({ id: foundUser._id, message: "Login successful!" });
      });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

// Logout
app.post("/logout", (req, res) => {
  res.cookie("token", "", { sameSite: "none", secure: true }).json({ message: "Logout successful" });
});

// Profile
app.get("/profile", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) {
        console.error("JWT Verification Error:", err.message);
        return res.status(401).json({ error: "Invalid token" });
      }
      res.json(userData);
    });
  } else {
    res.status(401).json({ error: "No token" });
  }
});

app.listen(4050, () => {
  console.log("Server started on port 4050");
});