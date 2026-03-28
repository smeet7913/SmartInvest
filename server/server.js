const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { exec } = require("child_process");
const path = require("path");
require("dotenv").config();
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/smart_invest")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection error:", err));

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  password: String,
});

const User = mongoose.model("User", UserSchema);

// ✅ Signup Route
app.post("/signup", async (req, res) => {
  const { name, phone, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, phone, email, password: hashedPassword });
    await newUser.save();

    res.json({ message: "Signup successful!" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Login Route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log("Login attempt:", email, password);
    const user = await User.findOne({ email });
    console.log("User found:", user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your_secret_key", { expiresIn: "1h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure:false,
      sameSite: "lax",
      path:"/",
      maxAge: 3600000
    });

    res.json({ message: "Login successful!", user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Auth Middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET || "your_secret_key", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// ✅ Protected Routes
app.get("/home", authenticateToken, (req, res) => {
  res.json({ message: "Welcome to Smart Invest!", user: req.user });
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

// ✅ Basket Generation Endpoint
app.post("/generate", authenticateToken, async (req, res) => {
  console.log("Generate route hit");
  const { investment, risk } = req.body;
  console.log("Request body:", req.body);

  if (!investment || isNaN(investment)) {
    return res.status(400).json({ error: "Valid investment amount required" });
  }

  if (!["low", "medium", "high"].includes(risk)) {
    return res.status(400).json({ error: "Invalid risk level" });
  }

  try {
    const pythonScriptPath = path.join(__dirname, "basket_generator.py");
    
    exec(`python ${pythonScriptPath} ${investment} ${risk}`, 
      { cwd: __dirname },
      (error, stdout, stderr) => {
        console.log("STDOUT:", stdout);
        console.log("STDERR:", stderr);
        if (error) {
          console.error("Generation failed:", stderr);
          return res.status(500).json({ error: "Basket generation failed" });
        }

        try {
          const baskets = require("./baskets.json");
          console.log("Generated baskets:", baskets.length);
          res.json(baskets);
        } catch (e) {
          console.error("JSON read error:", e);
          res.status(500).json({ error: "Failed to process results" });
        }
      }
    );
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error during generation" });
  }
});

// ✅ Stock Data Endpoint
const fetch = require("node-fetch");
const csv = require("csv-parser");
const { Readable } = require("stream");

app.get("/stocks", async (req, res) => {
  try {
    const response = await fetch("https://example.com/your-stocks.csv");
    if (!response.ok) throw new Error("Failed to fetch CSV");

    const results = [];
    const stream = Readable.from(await response.text())
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => res.json(results))
      .on("error", (err) => {
        throw err;
      });
  } catch (err) {
    console.error("Stock data error:", err);
    res.status(500).json({ message: "Error fetching stock data" });
  }
});

app.get("/baskets", (req, res) => {
  try {
    const filePath = path.join(__dirname, "baskets.json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Baskets file not found" });
    }

    const data = fs.readFileSync(filePath, "utf-8");
    const baskets = JSON.parse(data);

    res.json(baskets);
  } catch (error) {
    console.error("Error reading baskets:", error);
    res.status(500).json({ message: "Failed to load baskets" });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Docs: http://localhost:${PORT}/api-docs`);
});