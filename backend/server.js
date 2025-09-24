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
  BUS_TABLE_NAME, // if set, use DynamoDB for bus persistence
  DYNAMODB_ENDPOINT // optional: http://localhost:8000 for DynamoDB Local
} = process.env;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET not set in environment");
  process.exit(1);
}

AWS.config.update({ region: AWS_REGION });

function hasAwsCredentials() {
  try {
    const creds = AWS.config.credentials;
    if (!creds) return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    if (typeof creds.expired === 'boolean') return true; // provider present
    return true;
  } catch { return false; }
}

const dynamoOptions = {};
if (DYNAMODB_ENDPOINT) {
  dynamoOptions.endpoint = DYNAMODB_ENDPOINT;
  // For DynamoDB Local, dummy credentials are fine
  if (!hasAwsCredentials()) {
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy'
    });
  }
}

const dynamoDB = new AWS.DynamoDB.DocumentClient(dynamoOptions);
const ddb = new AWS.DynamoDB(dynamoOptions);
const s3 = new AWS.S3();

const canUseDynamo = Boolean(BUS_TABLE_NAME && (hasAwsCredentials() || DYNAMODB_ENDPOINT));

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
// This should be empty in production and populated from DynamoDB
let localBuses = [
  // Sample data for testing directional search functionality
  {
    licenseNo: 'NC-1234',
    busNumber: 'NC-1234',
    companyName: 'SuperLine Express',
    from: 'Colombo',
    to: 'Jaffna',
    route: 'Colombo → Jaffna',
    busType: 'luxury',
    seatCount: 45,
    year: 2020,
    journeys: [
      { start: '06:00', end: '12:30' },
      { start: '14:00', end: '20:30' },
      { start: '22:00', end: '04:30' }
    ],
    returnJourneys: [
      { start: '07:00', end: '13:30' },
      { start: '15:30', end: '22:00' },
      { start: '23:00', end: '05:30' }
    ],
    journeyDuration: '6h 30m',
    adultFare: 1200,
    childFare: 600,
    contacts: {
      driver: '0771234567',
      conductor: '0779876543',
      booking: '0112345678'
    },
    stops: ['Kurunegala', 'Anuradhapura', 'Vavuniya'],
    verifiedVotes: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    id: 'bus_NC-1234_1632465600000'
  },
  {
    licenseNo: 'NA-5678',
    busNumber: 'NA-5678',
    companyName: 'Ceylon Transport',
    from: 'Kandy',
    to: 'Galle',
    route: 'Kandy → Galle',
    busType: 'semi',
    seatCount: 50,
    year: 2019,
    journeys: [
      { start: '05:30', end: '10:00' },
      { start: '11:00', end: '15:30' },
      { start: '16:30', end: '21:00' }
    ],
    returnJourneys: [
      { start: '06:30', end: '11:00' },
      { start: '12:00', end: '16:30' },
      { start: '17:30', end: '22:00' }
    ],
    journeyDuration: '4h 30m',
    adultFare: 800,
    childFare: 400,
    contacts: {
      driver: '0771234568',
      conductor: '0779876544',
      booking: '0112345679'
    },
    stops: ['Kegalle', 'Ratnapura', 'Matara'],
    verifiedVotes: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    id: 'bus_NA-5678_1632465600001'
  },
  {
    licenseNo: 'NB-9876',
    busNumber: 'NB-9876',
    companyName: 'Island Express',
    from: 'Colombo',
    to: 'Kandy',
    route: 'Colombo → Kandy',
    busType: 'normal',
    seatCount: 55,
    year: 2018,
    journeys: [
      { start: '06:30', end: '09:30' },
      { start: '10:00', end: '13:00' },
      { start: '14:00', end: '17:00' },
      { start: '18:00', end: '21:00' }
    ],
    returnJourneys: [
      { start: '07:00', end: '10:00' },
      { start: '11:00', end: '14:00' },
      { start: '15:00', end: '18:00' },
      { start: '19:00', end: '22:00' }
    ],
    journeyDuration: '3h',
    adultFare: 400,
    childFare: 200,
    contacts: {
      driver: '0771234569',
      booking: '0112345680'
    },
    stops: ['Kegalle', 'Mawanella'],
    verifiedVotes: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    id: 'bus_NB-9876_1632465600002'
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
    const base64UrlToBase64 = (s) => {
      // Convert base64url -> base64
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      // Pad with '='
      const pad = s.length % 4;
      if (pad) s += '='.repeat(4 - pad);
      return s;
    };

    let payload;
    try {
      payload = JSON.parse(Buffer.from(base64UrlToBase64(parts[1]), 'base64').toString('utf8'));
    } catch (e) {
      throw new Error('Invalid token payload');
    }
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
  res.json({ status: "ok", time: new Date().toISOString(), dynamo: { enabled: Boolean(BUS_TABLE_NAME), canUse: canUseDynamo, table: BUS_TABLE_NAME || null, endpoint: DYNAMODB_ENDPOINT || null } });
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

// Verify bus endpoint
app.post("/buses/:licenseNo/verify", verifyCognitoToken, async (req, res) => {
  try {
    const licenseNo = req.params.licenseNo;
    const userEmail = req.cognitoUser?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'User email not found' });
    }

    // Check if user has already voted for this bus
    const voteKey = `${licenseNo}_${userEmail}`;

    if (canUseDynamo) {
      // Check existing vote
      const voteResult = await dynamoDB.get({
        TableName: 'bus_votes',
        Key: { voteKey }
      }).promise();

      const existingVote = voteResult.Item;
      let verifyDelta = 0;
      let reportDelta = 0;

      if (existingVote) {
        if (existingVote.voteType === 'verify') {
          // User is removing their verify vote
          await dynamoDB.delete({
            TableName: 'bus_votes',
            Key: { voteKey }
          }).promise();
          verifyDelta = -1;
        } else if (existingVote.voteType === 'report') {
          // User is changing from report to verify
          await dynamoDB.put({
            TableName: 'bus_votes',
            Item: {
              voteKey,
              licenseNo,
              userEmail,
              voteType: 'verify',
              createdAt: new Date().toISOString()
            }
          }).promise();
          verifyDelta = 1;
          reportDelta = -1;
        }
      } else {
        // User is adding a new verify vote
        await dynamoDB.put({
          TableName: 'bus_votes',
          Item: {
            voteKey,
            licenseNo,
            userEmail,
            voteType: 'verify',
            createdAt: new Date().toISOString()
          }
        }).promise();
        verifyDelta = 1;
      }

      // Update bus counts
      const updateExpression = 'ADD verifyCount :verifyDelta, reportCount :reportDelta SET updatedAt = :updatedAt';
      await dynamoDB.update({
        TableName: BUS_TABLE_NAME,
        Key: { licenseNo },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
          ':verifyDelta': verifyDelta,
          ':reportDelta': reportDelta,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();

      res.json({ message: 'Vote updated successfully', verifyDelta, reportDelta });
    } else {
      // In-memory fallback
      res.status(501).json({ error: 'Voting requires database connection' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Report bus endpoint
app.post("/buses/:licenseNo/report", verifyCognitoToken, async (req, res) => {
  try {
    const licenseNo = req.params.licenseNo;
    const userEmail = req.cognitoUser?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'User email not found' });
    }

    const voteKey = `${licenseNo}_${userEmail}`;

    if (canUseDynamo) {
      // Check existing vote
      const voteResult = await dynamoDB.get({
        TableName: 'bus_votes',
        Key: { voteKey }
      }).promise();

      const existingVote = voteResult.Item;
      let verifyDelta = 0;
      let reportDelta = 0;

      if (existingVote) {
        if (existingVote.voteType === 'report') {
          // User is removing their report vote
          await dynamoDB.delete({
            TableName: 'bus_votes',
            Key: { voteKey }
          }).promise();
          reportDelta = -1;
        } else if (existingVote.voteType === 'verify') {
          // User is changing from verify to report
          await dynamoDB.put({
            TableName: 'bus_votes',
            Item: {
              voteKey,
              licenseNo,
              userEmail,
              voteType: 'report',
              createdAt: new Date().toISOString()
            }
          }).promise();
          reportDelta = 1;
          verifyDelta = -1;
        }
      } else {
        // User is adding a new report vote
        await dynamoDB.put({
          TableName: 'bus_votes',
          Item: {
            voteKey,
            licenseNo,
            userEmail,
            voteType: 'report',
            createdAt: new Date().toISOString()
          }
        }).promise();
        reportDelta = 1;
      }

      // Update bus counts
      const updateExpression = 'ADD verifyCount :verifyDelta, reportCount :reportDelta SET updatedAt = :updatedAt';
      await dynamoDB.update({
        TableName: BUS_TABLE_NAME,
        Key: { licenseNo },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
          ':verifyDelta': verifyDelta,
          ':reportDelta': reportDelta,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();

      res.json({ message: 'Vote updated successfully', verifyDelta, reportDelta });
    } else {
      // In-memory fallback
      res.status(501).json({ error: 'Voting requires database connection' });
    }
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's vote for a specific bus
app.get("/buses/:licenseNo/my-vote", verifyCognitoToken, async (req, res) => {
  try {
    const licenseNo = req.params.licenseNo;
    const userEmail = req.cognitoUser?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'User email not found' });
    }

    const voteKey = `${licenseNo}_${userEmail}`;

    if (canUseDynamo) {
      const voteResult = await dynamoDB.get({
        TableName: 'bus_votes',
        Key: { voteKey }
      }).promise();

      const vote = voteResult.Item;
      res.json({
        hasVoted: !!vote,
        voteType: vote ? vote.voteType : null
      });
    } else {
      res.json({ hasVoted: false, voteType: null });
    }
  } catch (error) {
    console.error('Get vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create bus
app.post("/buses", verifyCognitoToken, async (req, res) => {
  try {
    const { busNumber, licenseNo, companyName, from, to } = req.body || {};

    // Use licenseNo if provided, otherwise fall back to busNumber
    const finalLicenseNo = licenseNo || busNumber;

    if (!finalLicenseNo || !companyName || !from || !to) {
      return res.status(400).json({
        error: 'Missing required fields: licenseNo (or busNumber), companyName, from, to'
      });
    }

    const newBus = {
      licenseNo: String(finalLicenseNo).trim(),
      busNumber: String(finalLicenseNo).trim(), // Ensure busNumber is also set
      route: `${from.trim()} → ${to.trim()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verifiedVotes: 0,
      id: `bus_${finalLicenseNo.trim()}_${Date.now()}`,
      ...req.body,
      // Override with clean values
      licenseNo: String(finalLicenseNo).trim(),
      busNumber: String(finalLicenseNo).trim(),
      companyName: String(companyName).trim(),
      from: String(from).trim(),
      to: String(to).trim()
    };

    // Remove any null, undefined, or empty string values
    Object.keys(newBus).forEach(key => {
      if (newBus[key] === null || newBus[key] === undefined || newBus[key] === '') {
        delete newBus[key];
      }
    });

    // If DynamoDB is usable, persist to DynamoDB; otherwise, use in-memory store
    if (canUseDynamo) {
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
        const msg = String(err?.message || 'Unknown error');
        console.error('DynamoDB put error:', err);
        if (/Missing credentials/i.test(msg) || err.code === 'CredentialsError') {
          return res.status(500).json({ error: 'Server has no AWS credentials configured for DynamoDB. Set AWS credentials or use a local DynamoDB endpoint.' });
        }
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
    if (canUseDynamo) {
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
      dailyDepartures: (bus.journeys?.length || 0) + (bus.returnJourneys?.length || 0),
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
    if (canUseDynamo) {
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

    if (canUseDynamo) {
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
    const directional = req.query.directional === 'true';
    const from = req.query.from?.trim() || '';
    const to = req.query.to?.trim() || '';

    let list = [];
    if (canUseDynamo) {
      // Scan DynamoDB for all buses
      try {
        const result = await dynamoDB.scan({ TableName: BUS_TABLE_NAME, Limit: 100 }).promise();
        list = result.Items || [];
      } catch (err) {
        console.error('DynamoDB scan error in search:', err);
        // Fallback to local buses
        list = localBuses;
      }
    } else {
      list = localBuses;
    }

    let filteredBuses = list;

    // Handle directional search
    if (directional && from && to) {
      filteredBuses = filteredBuses.filter(bus => {
        const busFrom = (bus.from || '').toLowerCase().trim();
        const busTo = (bus.to || '').toLowerCase().trim();
        const searchFrom = from.toLowerCase().trim();
        const searchTo = to.toLowerCase().trim();

        // More flexible matching - check if search terms are contained in bus locations
        // Also handle common location variations
        const normalizeLocation = (loc) => {
          return loc.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/fort|central|main|bus\s*stand|station/g, '');
        };

        const normalizedBusFrom = normalizeLocation(busFrom);
        const normalizedBusTo = normalizeLocation(busTo);
        const normalizedSearchFrom = normalizeLocation(searchFrom);
        const normalizedSearchTo = normalizeLocation(searchTo);

        // Check both forward and return directions with flexible matching
        const isForwardMatch =
          (normalizedBusFrom.includes(normalizedSearchFrom) || normalizedSearchFrom.includes(normalizedBusFrom)) &&
          (normalizedBusTo.includes(normalizedSearchTo) || normalizedSearchTo.includes(normalizedBusTo));

        const isReturnMatch =
          (normalizedBusFrom.includes(normalizedSearchTo) || normalizedSearchTo.includes(normalizedBusFrom)) &&
          (normalizedBusTo.includes(normalizedSearchFrom) || normalizedSearchFrom.includes(normalizedBusTo));

        return isForwardMatch || isReturnMatch;
      });      // Transform buses with directional journey information
      const directionalBuses = filteredBuses.map(bus => {
        const busFrom = (bus.from || '').toLowerCase().trim();
        const busTo = (bus.to || '').toLowerCase().trim();
        const searchFrom = from.toLowerCase().trim();
        const searchTo = to.toLowerCase().trim();

        // Use the same flexible matching logic for direction determination
        const normalizeLocation = (loc) => {
          return loc.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/fort|central|main|bus\s*stand|station/g, '');
        };

        const normalizedBusFrom = normalizeLocation(busFrom);
        const normalizedBusTo = normalizeLocation(busTo);
        const normalizedSearchFrom = normalizeLocation(searchFrom);
        const normalizedSearchTo = normalizeLocation(searchTo);

        // Determine if this is a forward or return journey match
        const isForwardMatch =
          (normalizedBusFrom.includes(normalizedSearchFrom) || normalizedSearchFrom.includes(normalizedBusFrom)) &&
          (normalizedBusTo.includes(normalizedSearchTo) || normalizedSearchTo.includes(normalizedBusTo));

        const isReturnMatch =
          (normalizedBusFrom.includes(normalizedSearchTo) || normalizedSearchTo.includes(normalizedBusFrom)) &&
          (normalizedBusTo.includes(normalizedSearchFrom) || normalizedSearchFrom.includes(normalizedBusTo));

        let relevantJourneys = [];
        let direction = '';
        let routeName = '';

        if (isForwardMatch) {
          relevantJourneys = bus.journeys || [];
          direction = 'forward';
          routeName = `${bus.from} → ${bus.to}`;
        } else if (isReturnMatch) {
          relevantJourneys = bus.returnJourneys || [];
          direction = 'return';
          routeName = `${bus.to} → ${bus.from}`;
        }

        return {
          ...bus,
          id: bus.id || bus.licenseNo,
          relevantJourneys,
          direction,
          dailyDepartures: relevantJourneys.length,
          verified: (bus.verifiedVotes || 0) >= 3,
          code: bus.busNumber || bus.licenseNo,
          name: routeName,
          type: bus.busType || 'normal',
          searchDirection: `${from} → ${to}`
        };
      });

      res.json({
        buses: directionalBuses,
        count: directionalBuses.length,
        directional: true,
        searchRoute: `${from} → ${to}`,
        filters: { type: busType, verifiedOnly, from, to }
      });
      return;
    }

    // Regular search logic
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
          (bus.stops || []).join(' '),
          bus.busType || ''
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
      dailyDepartures: (bus.journeys?.length || 0) + (bus.returnJourneys?.length || 0) || bus.dailyDepartures || 0,
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

// ---- Presigned upload URL for images (avatars and bus photos) ----
app.post("/uploads/avatar-url", verifyCognitoToken, async (req, res) => {
  try {
    if (!S3_BUCKET_NAME) {
      return res.status(500).json({ error: { code: "NO_BUCKET", message: "S3_BUCKET_NAME not set in environment" } });
    }

    const { fileName, contentType, type = 'avatar' } = req.body || {};
    if (!fileName || !contentType) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "fileName and contentType required" } });
    }

    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Only image files are allowed" } });
    }

    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const userEmail = req.cognitoUser?.email || 'anonymous';
    const userPrefix = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

    // Choose folder based on type (avatar or bus_photo)
    const folder = type === 'bus_photo' ? 'buses' : 'avatars';
    const key = `${folder}/${userPrefix}/${crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex")}-${safeName}`;

    const params = {
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Expires: 300,
      ContentType: contentType,
    };

    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
    const objectUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    console.log(`Generated presigned URL for user ${userEmail}: ${key} (type: ${type})`);

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
  if (!canUseDynamo) return;
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

// Ensure simple user table exists for local authentication flows
async function ensureUserTableExists() {
  const table = 'user';
  if (!canUseDynamo) return;
  try {
    await ddb.describeTable({ TableName: table }).promise();
  } catch (err) {
    if (err.code === 'ResourceNotFoundException') {
      console.log(`DynamoDB table ${table} not found. Creating...`);
      await ddb.createTable({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: 'email', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      }).promise();
      await ddb.waitFor('tableExists', { TableName: table }).promise();
      console.log(`DynamoDB table ${table} created.`);
    } else {
      console.warn('User table check failed:', err.message || err);
    }
  }
}

// Ensure votes table exists for tracking user votes
async function ensureVotesTableExists() {
  const table = 'bus_votes';
  if (!canUseDynamo) return;
  try {
    await ddb.describeTable({ TableName: table }).promise();
  } catch (err) {
    if (err.code === 'ResourceNotFoundException') {
      console.log(`DynamoDB table ${table} not found. Creating...`);
      await ddb.createTable({
        TableName: table,
        KeySchema: [{ AttributeName: 'voteKey', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'voteKey', AttributeType: 'S' },
          { AttributeName: 'licenseNo', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [{
          IndexName: 'LicenseNoIndex',
          KeySchema: [{ AttributeName: 'licenseNo', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' }
        }],
        BillingMode: 'PAY_PER_REQUEST'
      }).promise();
      await ddb.waitFor('tableExists', { TableName: table }).promise();
      console.log(`DynamoDB table ${table} created.`);
    } else {
      console.warn('Votes table check failed:', err.message || err);
    }
  }
}

async function boot() {
  try {
    await ensureBusTableExists();
    await ensureUserTableExists();
    await ensureVotesTableExists();
  } catch (err) {
    console.error('DynamoDB table check/creation failed:', err.message || err);
  }
  app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
}

boot();