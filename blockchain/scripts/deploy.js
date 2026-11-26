const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const ProductWarrantyNFT = await hre.ethers.getContractFactory("ProductWarrantyNFT");
  const warrantyNFT = await ProductWarrantyNFT.deploy(deployer.address);

  await warrantyNFT.waitForDeployment();
  const contractAddress = await warrantyNFT.getAddress();

  console.log("ProductWarrantyNFT deployed to:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
