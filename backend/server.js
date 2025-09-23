import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import AWS from "aws-sdk";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// ---- Environment / Config ----
const {
  AWS_REGION = "ap-south-1",
  JWT_SECRET,
  JWT_EXPIRES_IN = "1h",
  NODE_ENV = "development",
  ALLOWED_ORIGIN = "http://localhost:5173",
  PORT = 4000,
  S3_BUCKET_NAME,
  BUS_TABLE_NAME // if set, use DynamoDB for bus persistence
} = process.env;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET not set in environment");
  process.exit(1);
}

AWS.config.update({ region: AWS_REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const ddb = new AWS.DynamoDB();
const s3 = new AWS.S3();

const app = express();
app.use(express.json());
app.use(helmet());
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

const allowedOrigins = (ALLOWED_ORIGIN || "").split(/[,\s]+/).filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS: Origin not allowed: " + origin));
  },
  credentials: true
}));

// ---- In-memory bus storage for local development ----
let localBuses = [
  {
    licenseNo: 'NC-1234',
    busNumber: 'NC-1234',
    companyName: 'SuperLine Express',
    from: 'Colombo',
    to: 'Kandy',
    busType: 'semi',
    seatCount: 45,
    year: 2020,
    journeys: [
      { start: '06:00', end: '09:30' },
      { start: '14:00', end: '17:30' }
    ],
    journeyDuration: '3h 30m',
    adultFare: 1200,
    childFare: 600,
    stops: ['Kegalle', 'Mawanella'],
    contacts: {
      driver: '0771234567',
      conductor: '0771234568',
      booking: '0112345678'
    },
    verifiedVotes: 4,
    createdAt: new Date().toISOString(),
    id: 'bus_nc1234_001'
  },
  {
    licenseNo: 'NA-8899',
    busNumber: 'NA-8899',
    companyName: 'Eagle Travels',
    from: 'Kandy',
    to: 'Galle',
    busType: 'luxury',
    seatCount: 35,
    year: 2019,
    journeys: [
      { start: '07:00', end: '12:30' }
    ],
    journeyDuration: '5h 30m',
    adultFare: 1800,
    childFare: 900,
    stops: ['Peradeniya', 'Matale', 'Dambulla', 'Kurunegala', 'Ratnapura'],
    contacts: {
      driver: '0779876543',
      booking: '0118765432'
    },
    verifiedVotes: 2,
    createdAt: new Date().toISOString(),
    id: 'bus_na8899_001'
  }
];

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

async function verifyCognitoToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing token" } });
  }

  try {
    const token = header.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new Error('Token expired');
    }

    req.cognitoUser = payload;
    next();
  } catch (e) {
    console.error('Cognito token verification failed:', e);
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid or expired Cognito token" } });
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

// ---- Protected ping endpoint ----
app.get("/protected/ping", verifyCognitoToken, (req, res) => {
  res.json({
    message: "Protected endpoint accessible",
    user: req.cognitoUser?.email || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// ---- Bus CRUD Operations ----

// Create bus
app.post("/buses", verifyCognitoToken, async (req, res) => {
  try {
    const { busNumber, companyName, from, to } = req.body || {};

    if (!busNumber || !companyName || !from || !to) {
      return res.status(400).json({
        error: 'Missing required fields: busNumber, companyName, from, to'
      });
    }

    const newBus = {
      licenseNo: String(busNumber),
      route: `${from} → ${to}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verifiedVotes: 0,
      id: `bus_${busNumber}_${Date.now()}`,
      ...req.body
    };

    // If BUS_TABLE_NAME is set, persist to DynamoDB; otherwise, use in-memory store
    if (BUS_TABLE_NAME) {
      try {
        await dynamoDB.put({
          TableName: BUS_TABLE_NAME,
          Item: newBus,
          ConditionExpression: "attribute_not_exists(licenseNo)"
        }).promise();
      } catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
          return res.status(409).json({ error: 'Bus with this license number already exists' });
        }
        console.error('DynamoDB put error:', err);
        return res.status(500).json({ error: 'Failed to save bus to database' });
      }
    } else {
      // fallback to in-memory for local dev without DB
      if (localBuses.find(b => b.licenseNo === newBus.licenseNo)) {
        return res.status(409).json({ error: 'Bus with this license number already exists' });
      }
      localBuses.push(newBus);
    }

    res.status(201).json({
      message: 'Bus created successfully',
      bus: newBus
    });

  } catch (error) {
    console.error('Create bus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List buses
app.get("/buses", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    let buses = [];
    if (BUS_TABLE_NAME) {
      // Scan with limit (sufficient for dev; consider pagination for prod)
      const result = await dynamoDB.scan({ TableName: BUS_TABLE_NAME, Limit: limit }).promise();
      buses = (result.Items || []).map(bus => ({
        ...bus,
        dailyDepartures: bus.journeys?.length || 0,
        verified: (bus.verifiedVotes || 0) >= 3
      }));
      return res.json({ buses, count: buses.length, lastKey: result.LastEvaluatedKey || null });
    }

    buses = localBuses.slice(0, limit).map(bus => ({
      ...bus,
      dailyDepartures: bus.journeys?.length || 0,
      verified: (bus.verifiedVotes || 0) >= 3
    }));

    res.json({ buses, count: buses.length, lastKey: null });

  } catch (error) {
    console.error('List buses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific bus
app.get("/buses/:licenseNo", async (req, res) => {
  try {
    const licenseNo = req.params.licenseNo;
    if (BUS_TABLE_NAME) {
      const result = await dynamoDB.get({ TableName: BUS_TABLE_NAME, Key: { licenseNo } }).promise();
      if (!result.Item) return res.status(404).json({ error: 'Bus not found' });
      return res.json(result.Item);
    }

    const bus = localBuses.find(b => b.licenseNo === licenseNo);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    res.json(bus);

  } catch (error) {
    console.error('Get bus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update bus
app.put("/buses/:licenseNo", verifyCognitoToken, async (req, res) => {
  try {
    const licenseNo = req.params.licenseNo;

    if (BUS_TABLE_NAME) {
      // Build update expression dynamically
      const now = new Date().toISOString();
      let UpdateExpression = 'SET #updatedAt = :updatedAt';
      const ExpressionAttributeNames = { '#updatedAt': 'updatedAt' };
      const ExpressionAttributeValues = { ':updatedAt': now };

      if (req.body && typeof req.body === 'object') {
        if (req.body.verifiedVotes === 'increment') {
          // Use ADD for atomic counter
          UpdateExpression += ' ADD #verifiedVotes :inc';
          ExpressionAttributeNames['#verifiedVotes'] = 'verifiedVotes';
          ExpressionAttributeValues[':inc'] = 1;
        } else {
          let idx = 0;
          for (const [k, v] of Object.entries(req.body)) {
            if (k === 'licenseNo') continue;
            const nameKey = `#k${idx}`;
            const valueKey = `:v${idx}`;
            ExpressionAttributeNames[nameKey] = k;
            ExpressionAttributeValues[valueKey] = v;
            UpdateExpression += `, ${nameKey} = ${valueKey}`;
            idx++;
          }
        }
      }

      try {
        const result = await dynamoDB.update({
          TableName: BUS_TABLE_NAME,
          Key: { licenseNo },
          UpdateExpression,
          ExpressionAttributeNames,
          ExpressionAttributeValues,
          ConditionExpression: 'attribute_exists(licenseNo)',
          ReturnValues: 'ALL_NEW'
        }).promise();
        return res.json({ message: 'Bus updated successfully', bus: result.Attributes });
      } catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
          return res.status(404).json({ error: 'Bus not found' });
        }
        console.error('DynamoDB update error:', err);
        return res.status(500).json({ error: 'Failed to update bus in database' });
      }
    }

    // Fallback: in-memory update
    const busIndex = localBuses.findIndex(b => b.licenseNo === licenseNo);
    if (busIndex === -1) return res.status(404).json({ error: 'Bus not found' });

    if (req.body.verifiedVotes === 'increment') {
      localBuses[busIndex] = {
        ...localBuses[busIndex],
        verifiedVotes: (localBuses[busIndex].verifiedVotes || 0) + 1,
        updatedAt: new Date().toISOString()
      };
    } else {
      localBuses[busIndex] = {
        ...localBuses[busIndex],
        ...req.body,
        updatedAt: new Date().toISOString()
      };
    }

    res.json({ message: 'Bus updated successfully', bus: localBuses[busIndex] });

  } catch (error) {
    console.error('Update bus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search buses
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q || '';
    const busType = req.query.type;
    const verifiedOnly = req.query.verified === 'true';

    let list = [];
    if (BUS_TABLE_NAME) {
      // For dev simplicity, scan then filter in memory
      const result = await dynamoDB.scan({ TableName: BUS_TABLE_NAME }).promise();
      list = result.Items || [];
    } else {
      list = [...localBuses];
    }

    let filteredBuses = list;

    if (query) {
      const searchTerms = query.toLowerCase();
      filteredBuses = filteredBuses.filter(bus => {
        const searchableText = [
          bus.busNumber || '',
          bus.licenseNo || '',
          bus.companyName || '',
          bus.from || '',
          bus.to || '',
          bus.route || '',
          (bus.stops || []).join(' ')
        ].join(' ').toLowerCase();

        return searchableText.includes(searchTerms);
      });
    }

    if (busType && busType !== 'all') {
      filteredBuses = filteredBuses.filter(bus => bus.busType === busType);
    }

    if (verifiedOnly) {
      filteredBuses = filteredBuses.filter(bus => (bus.verifiedVotes || 0) >= 3);
    }

    // Transform for frontend compatibility
    const buses = filteredBuses.map(bus => ({
      ...bus,
      id: bus.id || bus.licenseNo,
      dailyDepartures: bus.journeys?.length || bus.dailyDepartures || 0,
      verified: (bus.verifiedVotes || 0) >= 3,
      code: bus.busNumber || bus.licenseNo,
      name: `${bus.from} → ${bus.to}`,
      type: bus.busType || 'normal'
    }));

    res.json({
      buses,
      count: buses.length,
      query: query,
      filters: { type: busType, verifiedOnly }
    });

  } catch (error) {
    console.error('Search buses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Legacy routes compatibility ----
app.get("/routes", (req, res) => {
  try {
    // Transform buses to routes format
    const routes = localBuses.map(bus => ({
      id: bus.id || bus.licenseNo,
      code: bus.busNumber || bus.licenseNo,
      name: `${bus.from} → ${bus.to}`,
      from: bus.from,
      to: bus.to,
      type: bus.busType || 'normal',
      verified: (bus.verifiedVotes || 0) >= 3,
      popular: (bus.verifiedVotes || 0) >= 2,
      headwayMins: 15
    }));

    res.json({ routes });
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/next", (req, res) => {
  res.json({
    route: req.query.route || 'Unknown',
    nextBuses: [
      { time: '14:30', type: 'Normal', fare: 120 },
      { time: '15:00', type: 'Semi Luxury', fare: 150 }
    ],
    updated: new Date().toISOString()
  });
});

// ---- Presigned upload URL for avatars ----
app.post("/uploads/avatar-url", verifyCognitoToken, async (req, res) => {
  try {
    if (!S3_BUCKET_NAME) {
      return res.status(500).json({ error: { code: "NO_BUCKET", message: "S3_BUCKET_NAME not set in environment" } });
    }

    const { fileName, contentType } = req.body || {};
    if (!fileName || !contentType) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "fileName and contentType required" } });
    }

    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Only image files are allowed" } });
    }

    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const userEmail = req.cognitoUser?.email || 'anonymous';
    const userPrefix = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const key = `avatars/${userPrefix}/${crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex")}-${safeName}`;

    const params = {
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Expires: 300,
      ContentType: contentType,
    };

    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
    const objectUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    console.log(`Generated presigned URL for user ${userEmail}: ${key}`);

    return res.json({ uploadUrl, objectUrl, key, bucket: S3_BUCKET_NAME });
  } catch (err) {
    console.error("Presign error:", err);
    return res.status(500).json({ error: { code: "PRESIGN_FAILED", message: err.message || "Failed to create upload URL" } });
  }
});

// ---- User Authentication (existing) ----
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

// ---- 404 Fallback ----
app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

// ---- Central Error Handler ----
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: "SERVER_ERROR", message: "Unexpected error" } });
});

// Ensure DynamoDB table exists in dev/local when BUS_TABLE_NAME is configured
async function ensureBusTableExists() {
  if (!BUS_TABLE_NAME) return;
  try {
    await ddb.describeTable({ TableName: BUS_TABLE_NAME }).promise();
  } catch (err) {
    if (err.code === 'ResourceNotFoundException') {
      console.log(`DynamoDB table ${BUS_TABLE_NAME} not found. Creating...`);
      await ddb.createTable({
        TableName: BUS_TABLE_NAME,
        AttributeDefinitions: [
          { AttributeName: 'licenseNo', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'licenseNo', KeyType: 'HASH' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      }).promise();
      await ddb.waitFor('tableExists', { TableName: BUS_TABLE_NAME }).promise();
      console.log(`DynamoDB table ${BUS_TABLE_NAME} created.`);
    } else {
      throw err;
    }
  }
}

async function boot() {
  try {
    await ensureBusTableExists();
  } catch (err) {
    console.error('DynamoDB table check/creation failed:', err.message || err);
  }
  app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
}

boot();