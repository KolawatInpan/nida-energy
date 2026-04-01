const fs = require('fs');
const path = require('path');

async function main() {
  const Factory = await ethers.getContractFactory('VerificationRegistry');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const network = await ethers.provider.getNetwork();
  const deployment = {
    contractName: 'VerificationRegistry',
    address,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'localhost.json'),
    JSON.stringify(deployment, null, 2),
  );

  console.log('VerificationRegistry deployed to:', address);
  console.log('Deployment file:', path.join('deployments', 'localhost.json'));
  console.log(`Set ETH_VERIFICATION_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
