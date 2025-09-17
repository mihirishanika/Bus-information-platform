import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import AWS from "aws-sdk";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// ---- Environment / Config ----
const {
  AWS_REGION = "ap-south-1",
  JWT_SECRET,
  JWT_EXPIRES_IN = "1h",
  NODE_ENV = "development",
  ALLOWED_ORIGIN = "http://localhost:5173",
  PORT = 4000
} = process.env;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET not set in environment");
  process.exit(1);
}

AWS.config.update({ region: AWS_REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const app = express();
app.use(express.json());
app.use(helmet());
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

// ---- Utility Functions ----
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing token" } });
  }
  try {
    const token = header.substring(7);
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } });
  }
}

function validateSignup(body) {
  const { name, email, password, birthday, phoneNo } = body || {};
  if (!name || !email || !password) return "name, email, password required";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "invalid email";
  if (password.length < 8) return "password too short";
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return "birthday must be YYYY-MM-DD";
  if (phoneNo && !/^\+?\d{7,15}$/.test(phoneNo)) return "invalid phoneNo";
  return null;
}

// ---- Health ----
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---- Signup ----
app.post("/signup", async (req, res) => {
  const error = validateSignup(req.body);
  if (error) return res.status(400).json({ error: { code: "BAD_REQUEST", message: error } });

  const { name, email, password, birthday, phoneNo } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const params = {
      TableName: "user",
      Item: { email, name, passwordHash, birthday, phoneNo, createdAt: new Date().toISOString() },
      ConditionExpression: "attribute_not_exists(email)"
    };
    await dynamoDB.put(params).promise();
    res.status(201).json({ message: "User created", email });
  } catch (err) {
    if (err.code === "ConditionalCheckFailedException") {
      return res.status(409).json({ error: { code: "USER_EXISTS", message: "Email already registered" } });
    }
    console.error("Signup error:", err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "Could not create user" } });
  }
});

// ---- Login ----
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "email & password required" } });
  }
  try {
    const result = await dynamoDB.get({ TableName: "user", Key: { email } }).promise();
    const user = result.Item;
    if (!user) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
    }
    const token = createToken({ email: user.email });
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "Login failed" } });
  }
});

// ---- Profile ----
app.get("/me", auth, async (req, res) => {
  try {
    const result = await dynamoDB.get({ TableName: "user", Key: { email: req.user.email } }).promise();
    if (!result.Item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User missing" } });
    const { passwordHash, ...publicUser } = result.Item;
    res.json(publicUser);
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "Could not fetch profile" } });
  }
});

// ---- Add Bus (protected) ----
app.post("/buses", auth, async (req, res) => {
  const { licenseNo } = req.body || {};
  if (!licenseNo) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "licenseNo required" } });
  const busItem = { ...req.body, licenseNo, createdAt: new Date().toISOString() };
  const params = {
    TableName: "buses",
    Item: busItem,
    ConditionExpression: "attribute_not_exists(licenseNo)"
  };
  try {
    await dynamoDB.put(params).promise();
    res.status(201).json({ message: "Bus added", licenseNo });
  } catch (err) {
    if (err.code === "ConditionalCheckFailedException") {
      return res.status(409).json({ error: { code: "BUS_EXISTS", message: "Bus already exists" } });
    }
    console.error("Add bus error:", err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "Could not add bus" } });
  }
});

// ---- List Buses (basic pagination) ----
app.get("/buses", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const params = {
    TableName: "buses",
    Limit: limit,
    ExclusiveStartKey: req.query.cursor ? { licenseNo: req.query.cursor } : undefined
  };
  try {
    const result = await dynamoDB.scan(params).promise();
    res.json({ items: result.Items, nextCursor: result.LastEvaluatedKey?.licenseNo || null });
  } catch (err) {
    console.error("List buses error:", err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "Could not list buses" } });
  }
});

// ---- 404 Fallback ----
app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

// ---- Central Error Handler ----
// (Express 5 will pass async errors automatically, but keep for safety)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: "SERVER_ERROR", message: "Unexpected error" } });
});

app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
