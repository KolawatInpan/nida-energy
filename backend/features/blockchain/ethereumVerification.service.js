const { ethers } = require('ethers');

const VERIFICATION_REGISTRY_ABI = [
  'event TransactionVerified(string indexed appTxId, bytes32 indexed payloadHash, address indexed publisher, uint256 timestamp)',
  'function recordVerification(string appTxId, bytes32 payloadHash) external',
];

function getChainId() {
  const chainId = Number(process.env.ETH_CHAIN_ID || 11155111);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : 11155111;
}

function getExplorerBaseUrl() {
  const explicit = String(process.env.ETH_EXPLORER_BASE_URL || '').trim();
  if (explicit) return explicit;

  const chainId = getChainId();
  if (chainId === 11155111) return 'https://sepolia.etherscan.io/tx/';
  if (chainId === 1) return 'https://etherscan.io/tx/';
  return '';
}

function getRpcUrl() {
  return String(process.env.ETH_RPC_URL || '').trim();
}

function getPrivateKey() {
  return String(process.env.ETH_PRIVATE_KEY || '').trim();
}

/**
 * Derive a building-specific private key from Hardhat's default mnemonic.
 * Uses building name hash % 20 to pick one of 20 Hardhat accounts.
 * This gives each building a unique publisher address on-chain.
 */
function getPrivateKeyForBuilding(buildingName) {
  const customKey = getPrivateKey();
  // Derive building-specific key only on local Hardhat (chainId 31337)
  // On real networks, use the configured private key
  if (getChainId() === 31337 && buildingName) {
    const mnemonic = 'test test test test test test test test test test test junk';
    const index = Math.abs(String(buildingName).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 20;
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${index}`);
    return wallet.privateKey;
  }
  if (customKey) return customKey;
  // Fallback: derive from building name
  if (buildingName) {
    const mnemonic = 'test test test test test test test test test test test junk';
    const index = Math.abs(String(buildingName).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 20;
    return ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${index}`).privateKey;
  }
  return customKey;
}

function getVerificationContractAddress() {
  return String(process.env.ETH_VERIFICATION_CONTRACT_ADDRESS || '').trim();
}

function getVerificationMethod() {
  return getVerificationContractAddress() ? 'contract-event' : 'self-transaction';
}

function isVerificationEnabled() {
  return Boolean(getRpcUrl() && getPrivateKey());
}

function buildVerificationPayload(transaction, extra = {}) {
  return {
    version: 1,
    source: 'nida-dashboard-ui',
    txid: String(transaction.txid),
    walletId: String(transaction.walletId),
    buildingName: transaction.buildingName ? String(transaction.buildingName) : null,
    fromBuilding: extra.fromBuilding || transaction.fromBuilding || transaction.buildingName || null,
    toBuilding: extra.toBuilding || transaction.toBuilding || null,
    type: String(transaction.type || ''),
    tokenAmount: Number(transaction.tokenAmount || transaction.amount || 0),
    kwh: Number(extra.kwh ?? transaction.kwh ?? 0),
    status: String(transaction.status || ''),
    timestamp: (() => {
      if (transaction.timestamp instanceof Date) return transaction.timestamp.toISOString();
      const d = new Date(transaction.timestamp);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    })(),
  };
}

function parseStoredVerificationPayload(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch (error) {
    console.warn('parseStoredVerificationPayload error', error);
    return null;
  }
}

function hashVerificationPayload(payload) {
  return ethers.id(JSON.stringify(payload));
}

function buildExplorerUrl(txHash) {
  if (!txHash) return null;
  const baseUrl = getExplorerBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}${txHash}`;
}

function getVerificationPreview(transaction) {
  const storedPayload = parseStoredVerificationPayload(transaction?.verificationPayload);
  const payload = storedPayload || buildVerificationPayload(transaction);
  const payloadHash = transaction?.payloadHash || hashVerificationPayload(payload);

  return {
    enabled: isVerificationEnabled(),
    chainId: getChainId(),
    explorerBaseUrl: getExplorerBaseUrl() || null,
    verificationMethod: getVerificationMethod(),
    contractAddress: getVerificationContractAddress() || null,
    payload,
    payloadHash,
    payloadSource: storedPayload ? 'stored' : 'live',
  };
}

async function publishVerification(transaction) {
  const preview = getVerificationPreview(transaction);

  if (!isVerificationEnabled() && !(getRpcUrl())) {
    return {
      ...preview,
      published: false,
      reason: 'ETH_RPC_URL and ETH_PRIVATE_KEY must be configured to publish proofs on-chain.',
    };
  }

  const provider = new ethers.JsonRpcProvider(getRpcUrl() || 'http://blockchain:8545', getChainId() || 31337);
  const privateKey = getPrivateKeyForBuilding(transaction.buildingName);
  const signer = new ethers.Wallet(privateKey, provider);

  let response;
  if (preview.contractAddress) {
    const contract = new ethers.Contract(
      preview.contractAddress,
      VERIFICATION_REGISTRY_ABI,
      signer,
    );
    response = await contract.recordVerification(String(transaction.txid), preview.payloadHash);
  } else {
    response = await signer.sendTransaction({
      to: signer.address,
      value: 0n,
      data: preview.payloadHash,
    });
  }

  const receipt = await response.wait();
  const block = receipt?.blockNumber != null
    ? await provider.getBlock(receipt.blockNumber).catch(() => null)
    : null;
  const effectiveGasPrice = receipt
    ? receipt.gasPrice?.toString?.() || receipt.effectiveGasPrice?.toString?.() || null
    : null;

  return {
    ...preview,
    published: true,
    txHash: response.hash,
    explorerUrl: buildExplorerUrl(response.hash),
    publisherAddress: signer.address,
    contractAddress: preview.contractAddress,
    blockNumber: receipt ? Number(receipt.blockNumber) : null,
    blockHash: receipt?.blockHash || block?.hash || null,
    parentHash: block?.parentHash || null,
    blockTimestamp: block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
    blockSize: block?.length != null ? Number(block.length) : null,
    gasUsed: receipt ? receipt.gasUsed.toString() : null,
    effectiveGasPrice,
  };
}

module.exports = {
  buildExplorerUrl,
  buildVerificationPayload,
  getChainId,
  getExplorerBaseUrl,
  getVerificationPreview,
  getVerificationContractAddress,
  getVerificationMethod,
  getPrivateKey,
  getPrivateKeyForBuilding,
  parseStoredVerificationPayload,
  getRpcUrl,
  hashVerificationPayload,
  isVerificationEnabled,
  publishVerification,
};


