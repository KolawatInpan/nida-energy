const fs = require('fs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NIDA API',
      version: '1.0.0',
      description: 'API documentation for NIDA project',
    },
    servers: [
      { url: 'http://localhost:8000/api', description: 'Local development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'username', example: 'admin' },
            password: { type: 'string', description: 'base64 encoded password', example: 'UEBzc3cwcmQ=' }
          },
          required: ['username','password']
        },
        UserResult: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'id', example: '0' },
            username: { type: 'string', example: 'admin' },
            role: { type: 'string', example: 'admin' },
            allows: { type: 'string', example: '*' },
            token: { type: 'string', description: 'JWT token example' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'OK' },
            result: { $ref: '#/components/schemas/UserResult' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ERROR' },
            message: { type: 'string', example: 'Invalid credentials' }
          }
        }
      ,
      WalletCreate: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Main Wallet' },
          ownerEmail: { type: 'string', example: 'owner@example.com' }
        },
        required: ['name','ownerEmail']
      },
      WalletBalance: {
        type: 'object',
        properties: {
          walletId: { type: 'string', example: 'w_123' },
          balance: { type: 'number', example: 123.45 }
        }
      },
      TopupRequest: {
        type: 'object',
        properties: {
          amount: { type: 'number', example: 50 }
        },
        required: ['amount']
      },
      OfferCreate: {
        type: 'object',
        properties: {
          sellerWalletId: { type: 'string', example: 'w_123' },
          kwh: { type: 'number', example: 10 },
          ratePerKwh: { type: 'number', example: 1.5 }
        },
        required: ['sellerWalletId','kwh','ratePerKwh']
      },
      OfferResponse: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          sellerWalletId: { type: 'string' },
          kwh: { type: 'number' },
          ratePerKwh: { type: 'number' }
        }
      },
      TransactionCreate: {
        type: 'object',
        properties: {
          fromWallet: { type: 'string' },
          toWallet: { type: 'string' },
          amount: { type: 'number' }
        },
        required: ['fromWallet','toWallet','amount']
      },
      RunningMeterEntry: {
        type: 'object',
        properties: {
          meterSnid: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          value: { type: 'number' }
        },
        required: ['meterSnid','timestamp','value']
      },
      MeterRegister: {
        type: 'object',
        properties: {
          buildingId: { type: 'string' },
          meterType: { type: 'string' },
          meterNumber: { type: 'string' },
          capacity: { type: 'number' }
        },
        required: ['buildingId','meterType','meterNumber']
      }
      }
    },
  },
  apis: [path.join(__dirname, '..', 'features', '**', '*.routes.js')],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

const outPath = path.resolve(__dirname, '..', '..', 'docs', 'swagger.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(swaggerSpec, null, 2), 'utf8');
console.log('Wrote', outPath);
