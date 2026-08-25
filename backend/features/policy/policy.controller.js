const fs = require('fs');
const path = require('path');

const POLICY_FILE = path.join(__dirname, '..', '..', 'tmp', 'policy.json');
const DEFAULT_POLICY = {
  termsOfService: `1. Acceptance of Terms\nBy accessing and using the NIDA Energy Trading Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.\n\n2. Eligibility\nYou must be at least 18 years of age and authorized to represent the building or organization you are registering. Each building must have a valid physical address and metering infrastructure.\n\n3. Energy Trading\nAll energy trades conducted through this platform are final and binding. The platform facilitates peer-to-peer energy trading within the Nida Dashboard platform. Users are responsible for ensuring their meters are operational and accurately report energy data.\n\n4. Pricing\nDay-Ahead market orders are placed one day in advance. IntraDay market operates in real-time with higher pricing. All prices are denominated in Token/kWh. A 5% platform fee applies to all matched trades.\n\n5. Privacy & Data\nYour personal and building data is collected solely for energy trading operations. We do not share your data with third parties without explicit consent. Energy consumption data may be used anonymously for research and grid optimization.\n\n6. System Notifications\nBy using the platform, you agree to receive system notifications related to energy trading, market updates, meter readings, and account activity via email and in-app notifications.\n\n7. Limitation of Liability\nThe platform is provided "as is" without warranties. We are not liable for energy losses due to meter malfunctions, network issues, or force majeure events.\n\n8. Modifications\nWe reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.`,
  lastUpdated: new Date().toISOString(),
};

function ensureDir() {
  const dir = path.dirname(POLICY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readPolicy() {
  ensureDir();
  try {
    if (fs.existsSync(POLICY_FILE)) {
      const raw = fs.readFileSync(POLICY_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read policy file, using defaults', e.message);
  }
  // Write defaults
  writePolicy(DEFAULT_POLICY);
  return { ...DEFAULT_POLICY };
}

function writePolicy(data) {
  ensureDir();
  fs.writeFileSync(POLICY_FILE, JSON.stringify({ ...DEFAULT_POLICY, ...data, lastUpdated: new Date().toISOString() }, null, 2), 'utf8');
}

async function getPolicy(req, res) {
  try {
    res.json(readPolicy());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updatePolicy(req, res) {
  try {
    const { termsOfService } = req.body || {};
    const current = readPolicy();
    writePolicy({ termsOfService: termsOfService || current.termsOfService });
    res.json(readPolicy());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getPolicy, updatePolicy };
