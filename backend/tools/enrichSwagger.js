const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../../docs/swagger.json');
const mapping = {
  id: 'Identifier',
  invoiceId: 'Invoice identifier',
  receiptId: 'Receipt identifier',
  walletId: 'Wallet identifier',
  buyerWalletId: 'Buyer wallet identifier',
  sellerWalletId: 'Seller wallet identifier',
  offerId: 'Offer identifier',
  amount: 'Amount (numeric)',
  kwh: 'Energy in kWh',
  ratePerKwh: 'Rate per kWh (token)',
  month: 'Month (1-12)',
  year: 'Year (YYYY)',
  buildingId: 'Building identifier',
  buildingName: 'Building name',
  targetBuildingId: 'Target building id',
  txHash: 'Blockchain transaction hash',
  enable: 'Enabled flag (true/false)'
};

function guessDescription(name) {
  if (!name) return 'Parameter';
  if (mapping[name]) return mapping[name];
  // heuristics
  if (name.toLowerCase().includes('id')) return 'Identifier';
  if (name.toLowerCase().includes('amount')) return 'Amount';
  if (name.toLowerCase().includes('kwh')) return 'Energy in kWh';
  return 'Parameter';
}

function enrichProperties(obj) {
  if (!obj || !obj.properties) return;
  for (const [prop, schema] of Object.entries(obj.properties)) {
    if (!schema.description) {
      schema.description = guessDescription(prop);
    }
  }
}

function main() {
  if (!fs.existsSync(file)) {
    console.error('swagger.json not found at', file);
    process.exit(1);
  }

  const raw = fs.readFileSync(file, 'utf8');
  const doc = JSON.parse(raw);

  // Enrich components.schemas
  if (doc.components && doc.components.schemas) {
    for (const [name, schema] of Object.entries(doc.components.schemas)) {
      enrichProperties(schema);
    }
  }

  // Enrich paths -> parameters and request bodies
  if (doc.paths) {
    for (const [p, ops] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        if (op.parameters) {
          for (const param of op.parameters) {
            if (!param.description) param.description = guessDescription(param.name);
            if (param.schema && !param.schema.description) param.schema.description = guessDescription(param.name);
          }
        }

        if (op.requestBody && op.requestBody.content) {
          for (const [ct, media] of Object.entries(op.requestBody.content)) {
            if (media.schema && media.schema.properties) {
              enrichProperties(media.schema);
            }
          }
        }

        if (op.responses) {
          for (const [status, resp] of Object.entries(op.responses)) {
            if (resp && resp.content) {
              for (const media of Object.values(resp.content)) {
                if (media.schema && media.schema.properties) enrichProperties(media.schema);
              }
            }
          }
        }
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  console.log('Enriched', file);
}

main();
