const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../../docs/swagger.json');

const typeHints = {
  offerId: 'integer',
  invoiceId: 'integer',
  receiptId: 'integer',
  walletId: 'string',
  buyerWalletId: 'string',
  sellerWalletId: 'string',
  amount: 'number',
  kwh: 'number',
  ratePerKwh: 'number',
  month: 'integer',
  year: 'integer',
  buildingId: 'integer',
  targetBuildingId: 'integer',
  id: 'integer',
  snid: 'string',
  email: 'string',
  txHash: 'string',
  enable: 'boolean'
};

function inferTypeFromExample(example) {
  if (example === null || typeof example === 'undefined') return null;
  const t = typeof example;
  if (t === 'number') return Number.isInteger(example) ? 'integer' : 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return Array.isArray(example) ? 'array' : 'object';
  return 'string';
}

const descHints = {
  kwh: 'Energy in kWh',
  ratePerKwh: 'Rate per kWh (token)',
  offerId: 'ID of the marketplace offer to purchase',
  buyerWalletId: 'Wallet id of the buyer',
  sellerWalletId: 'Wallet id of the seller',
  amount: 'Amount (numeric)',
  balance: 'Current wallet token balance (numeric amount)',
  walletId: 'Wallet identifier',
  invoiceId: 'Invoice identifier',
  receiptId: 'Receipt identifier',
  buildingId: 'Building identifier',
  buildingName: 'Building name',
  targetBuildingId: 'Building id to receive the purchased energy',
  id: 'Identifier',
  snid: 'Meter SNID (serial number)',
  email: 'Email address',
  txHash: 'Blockchain transaction hash',
  enable: 'Enabled flag (true/false)',
  status: 'Status string',
  username: 'Username',
  password: 'Password',
  token: 'JWT token',
  allows: 'Module Permission',
  role: 'Role Template [admin,...]',
  message: 'Error or status message',
  name: 'Name',
  mapURL: 'Map URL',
  address: 'Address',
  province: 'Province',
  postalCode: 'Postal code',
  meterType: 'Type of meter',
  meterNumber: 'Meter number',
  capacity: 'Capacity',
  value: 'Value',
  timestamp: 'Timestamp (ISO 8601 date-time)',
  preview: 'Preview data',
};

function ensureProp(propName, schema, example) {
  if (!schema) schema = {};
  if (!schema.type) {
    if (typeHints[propName]) schema.type = typeHints[propName];
    else {
      const inferred = inferTypeFromExample(example);
      schema.type = inferred || 'string';
    }
  }
  if (!schema.description || schema.description === 'Parameter') {
    schema.description = descHints[propName] || (propName in typeHints ? typeHints[propName] : 'Parameter');
  }
}

function main() {
  if (!fs.existsSync(file)) {
    console.error('swagger.json not found at', file);
    process.exit(1);
  }
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Paths: parameters, requestBody, responses
  for (const [, ops] of Object.entries(doc.paths || {})) {
    for (const [, op] of Object.entries(ops || {})) {
      if (!op) continue;
      // parameters
      if (Array.isArray(op.parameters)) {
        for (const param of op.parameters) {
          const name = param.name;
          if (!param.schema) param.schema = {};
          if (!param.schema.type) {
            if (typeHints[name]) param.schema.type = typeHints[name];
            else param.schema.type = param.schema.format === 'date-time' ? 'string' : 'string';
          }
          if (!param.description) param.description = param.schema.description || 'Parameter';
          if (!param.schema.description) param.schema.description = param.description;
        }
      }

      // requestBody
      if (op.requestBody && op.requestBody.content) {
        for (const media of Object.values(op.requestBody.content)) {
          const schema = media.schema;
          if (schema && schema.properties) {
            for (const [pname, pschema] of Object.entries(schema.properties)) {
              const example = (media.example && media.example[pname]) || (schema.example && schema.example[pname]);
              ensureProp(pname, pschema, example);
            }
          }
        }
      }

      // responses
      if (op.responses) {
        for (const resp of Object.values(op.responses)) {
          if (!resp || !resp.content) continue;
          for (const media of Object.values(resp.content)) {
            const schema = media.schema;
            if (schema && schema.properties) {
              for (const [pname, pschema] of Object.entries(schema.properties)) {
                const example = (media.example && media.example[pname]) || (schema.example && schema.example[pname]);
                ensureProp(pname, pschema, example);
              }
            }
            // arrays with items
            if (schema && schema.type === 'array' && schema.items && schema.items.properties) {
              for (const [pname, pschema] of Object.entries(schema.items.properties)) {
                ensureProp(pname, pschema, null);
              }
            }
          }
        }
      }
    }
  }

  // components.schemas
  if (doc.components && doc.components.schemas) {
    for (const [sname, schema] of Object.entries(doc.components.schemas)) {
      if (schema && schema.properties) {
        for (const [pname, pschema] of Object.entries(schema.properties)) {
          const example = (schema.example && schema.example[pname]) || null;
          ensureProp(pname, pschema, example);
        }
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  console.log('Ensured types in', file);
}

main();
