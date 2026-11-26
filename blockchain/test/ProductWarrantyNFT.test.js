const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductWarrantyNFT Full Specification Suite", function () {
  let warrantyNFT;
  let admin, brand, retailer, customer, buyer, serviceCenter, stranger;

  let BRAND_ROLE, RETAILER_ROLE, SERVICE_CENTER_ROLE, DEFAULT_ADMIN_ROLE;

  const sampleSerial = "SN-S24U-JIIT-99214";
  const sampleSerialHash = ethers.keccak256(ethers.toUtf8Bytes(sampleSerial));
  const sampleUri = "ipfs://QmZtmD2qtQgLzzpkNdFiPbnCj83p8xExample";
  const sampleWarrantyDays = 365; // 1 year

  beforeEach(async function () {
    [admin, brand, retailer, customer, buyer, serviceCenter, stranger] = await ethers.getSigners();

    const ProductWarrantyNFT = await ethers.getContractFactory("ProductWarrantyNFT");
    warrantyNFT = await ProductWarrantyNFT.deploy(admin.address);
    await warrantyNFT.waitForDeployment();

    DEFAULT_ADMIN_ROLE = await warrantyNFT.DEFAULT_ADMIN_ROLE();
    BRAND_ROLE = await warrantyNFT.BRAND_ROLE();
    RETAILER_ROLE = await warrantyNFT.RETAILER_ROLE();
    SERVICE_CENTER_ROLE = await warrantyNFT.SERVICE_CENTER_ROLE();

    // Grant roles from admin
    await warrantyNFT.connect(admin).grantRole(BRAND_ROLE, brand.address);
    await warrantyNFT.connect(admin).grantRole(RETAILER_ROLE, retailer.address);
    await warrantyNFT.connect(admin).grantRole(SERVICE_CENTER_ROLE, serviceCenter.address);
  });

  describe("1. Deployment & Access Control Matrix", function () {
    it("Should properly assign DEFAULT_ADMIN_ROLE to deployer", async function () {
      expect(await warrantyNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await warrantyNFT.hasRole(BRAND_ROLE, brand.address)).to.be.true;
      expect(await warrantyNFT.hasRole(RETAILER_ROLE, retailer.address)).to.be.true;
      expect(await warrantyNFT.hasRole(SERVICE_CENTER_ROLE, serviceCenter.address)).to.be.true;
    });

    it("Should prevent non-admin from granting roles", async function () {
      await expect(
        warrantyNFT.connect(stranger).grantRole(BRAND_ROLE, stranger.address)
      ).to.be.revertedWithCustomError(warrantyNFT, "AccessControlUnauthorizedAccount");
    });

    it("Should correctly report ERC721 and AccessControl interfaces", async function () {
      // ERC721 interface ID: 0x80ac58cd, AccessControl: 0x7965db0b
      expect(await warrantyNFT.supportsInterface("0x80ac58cd")).to.be.true;
      expect(await warrantyNFT.supportsInterface("0x7965db0b")).to.be.true;
    });
  });

  describe("2. Single & Batch Minting into Retailer Custody", function () {
    it("Should allow BRAND_ROLE to mint unactivated warranty NFT to retailer", async function () {
      const tx = await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, sampleWarrantyDays);

      await expect(tx)
        .to.emit(warrantyNFT, "ProductMinted")
        .withArgs(1, retailer.address, sampleSerialHash);

      expect(await warrantyNFT.ownerOf(1)).to.equal(retailer.address);
      expect(await warrantyNFT.tokenURI(1)).to.equal(sampleUri);
      expect(await warrantyNFT.totalMinted()).to.equal(1);

      const info = await warrantyNFT.getWarrantyInfo(1);
      expect(info.serialNumberHash).to.equal(sampleSerialHash);
      expect(info.activationDate).to.equal(0);
      expect(info.durationDays).to.equal(sampleWarrantyDays);
      expect(info.isActivated).to.equal(false);
      expect(info.isStolen).to.equal(false);

      // Should be unactivated, hence invalid
      expect(await warrantyNFT.isWarrantyValid(1)).to.equal(false);
    });

    it("Should prevent duplicate serial number registration", async function () {
      await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, sampleWarrantyDays);

      await expect(
        warrantyNFT
          .connect(brand)
          .mintProduct(retailer.address, sampleSerialHash, "ipfs://another", sampleWarrantyDays)
      ).to.be.revertedWith("WarrantyNFT: Serial number already registered");
    });

    it("Should prevent non-brand from minting", async function () {
      await expect(
        warrantyNFT
          .connect(retailer)
          .mintProduct(retailer.address, sampleSerialHash, sampleUri, sampleWarrantyDays)
      ).to.be.revertedWithCustomError(warrantyNFT, "AccessControlUnauthorizedAccount");
    });

    it("Should validate parameters on minting (address, serial, duration)", async function () {
      await expect(
        warrantyNFT.connect(brand).mintProduct(ethers.ZeroAddress, sampleSerialHash, sampleUri, 365)
      ).to.be.revertedWith("WarrantyNFT: Invalid retailer address");

      await expect(
        warrantyNFT.connect(brand).mintProduct(retailer.address, ethers.ZeroHash, sampleUri, 365)
      ).to.be.revertedWith("WarrantyNFT: Invalid serial hash");

      await expect(
        warrantyNFT.connect(brand).mintProduct(retailer.address, sampleSerialHash, sampleUri, 0)
      ).to.be.revertedWith("WarrantyNFT: Duration must be greater than 0");
    });

    it("Should allow batch minting of products via CSV-style arrays", async function () {
      const serials = [
        ethers.keccak256(ethers.toUtf8Bytes("SN-BATCH-001")),
        ethers.keccak256(ethers.toUtf8Bytes("SN-BATCH-002")),
        ethers.keccak256(ethers.toUtf8Bytes("SN-BATCH-003")),
      ];
      const uris = ["ipfs://uri1", "ipfs://uri2", "ipfs://uri3"];
      const durations = [365, 730, 180];

      const tx = await warrantyNFT
        .connect(brand)
        .batchMintProducts(retailer.address, serials, uris, durations);

      await expect(tx).to.emit(warrantyNFT, "ProductMinted");

      expect(await warrantyNFT.totalMinted()).to.equal(3);
      expect(await warrantyNFT.ownerOf(1)).to.equal(retailer.address);
      expect(await warrantyNFT.ownerOf(2)).to.equal(retailer.address);
      expect(await warrantyNFT.ownerOf(3)).to.equal(retailer.address);

      expect((await warrantyNFT.getWarrantyInfo(2)).durationDays).to.equal(730);
    });

    it("Should revert batch minting on array length mismatch", async function () {
      const serials = [ethers.keccak256(ethers.toUtf8Bytes("SN-1"))];
      const uris = ["ipfs://uri1", "ipfs://uri2"];
      const durations = [365];

      await expect(
        warrantyNFT.connect(brand).batchMintProducts(retailer.address, serials, uris, durations)
      ).to.be.revertedWith("WarrantyNFT: Array length mismatch");
    });
  });

  describe("3. Point of Sale: activateAndSell()", function () {
    beforeEach(async function () {
      await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, sampleWarrantyDays);
    });

    it("Should allow retailer to activate warranty and transfer NFT to customer", async function () {
      const tx = await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(warrantyNFT, "WarrantyActivated")
        .withArgs(1, customer.address, block.timestamp, sampleWarrantyDays);

      // Ownership transferred to customer
      expect(await warrantyNFT.ownerOf(1)).to.equal(customer.address);

      const info = await warrantyNFT.getWarrantyInfo(1);
      expect(info.isActivated).to.be.true;
      expect(info.activationDate).to.equal(block.timestamp);

      // Now warranty is valid!
      expect(await warrantyNFT.isWarrantyValid(1)).to.be.true;
    });

    it("Should prevent non-retailer from calling activateAndSell", async function () {
      await expect(
        warrantyNFT.connect(stranger).activateAndSell(1, customer.address)
      ).to.be.revertedWithCustomError(warrantyNFT, "AccessControlUnauthorizedAccount");
    });

    it("Should revert if retailer does not own the token", async function () {
      // Transfer to stranger first or create another token
      await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);

      // Now customer owns it, retailer tries to activate again
      await expect(
        warrantyNFT.connect(retailer).activateAndSell(1, buyer.address)
      ).to.be.revertedWith("WarrantyNFT: Caller does not own this token");
    });

    it("Should prevent activating an already activated token", async function () {
      await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);

      // If token somehow came back to retailer
      await warrantyNFT.connect(customer).transferFrom(customer.address, retailer.address, 1);

      await expect(
        warrantyNFT.connect(retailer).activateAndSell(1, buyer.address)
      ).to.be.revertedWith("WarrantyNFT: Warranty already activated");
    });
  });

  describe("4. Dynamic On-Chain Expiry Mechanics", function () {
    let activationTimestamp;

    beforeEach(async function () {
      await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, 10); // 10 days warranty

      const tx = await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      activationTimestamp = block.timestamp;
    });

    it("Should accurately calculate expiry timestamp", async function () {
      const expectedExpiry = activationTimestamp + 10 * 86400;
      expect(await warrantyNFT.getExpiryTimestamp(1)).to.equal(expectedExpiry);
      expect(await warrantyNFT.isWarrantyValid(1)).to.be.true;
    });

    it("Should remain valid before expiration date", async function () {
      // Advance time by 9 days (still valid)
      await ethers.provider.send("evm_increaseTime", [9 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await warrantyNFT.isWarrantyValid(1)).to.be.true;
    });

    it("Should become invalid immediately once expiration timestamp is passed", async function () {
      // Advance time by 11 days (1 day after expiration)
      await ethers.provider.send("evm_increaseTime", [11 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await warrantyNFT.isWarrantyValid(1)).to.be.false;
    });
  });

  describe("5. Secondary Resale Ownership Transfer", function () {
    beforeEach(async function () {
      await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, 365);
      await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);
    });

    it("Should allow customer to transfer NFT on resale while preserving remaining warranty", async function () {
      const initialInfo = await warrantyNFT.getWarrantyInfo(1);

      // Customer resells to buyer via safeTransferFrom
      await warrantyNFT
        .connect(customer)
        ["safeTransferFrom(address,address,uint256)"](customer.address, buyer.address, 1);

      expect(await warrantyNFT.ownerOf(1)).to.equal(buyer.address);

      const afterInfo = await warrantyNFT.getWarrantyInfo(1);
      // Timestamps remain completely intact
      expect(afterInfo.activationDate).to.equal(initialInfo.activationDate);
      expect(afterInfo.durationDays).to.equal(initialInfo.durationDays);
      expect(afterInfo.isActivated).to.be.true;

      // Buyer now holds valid warranty
      expect(await warrantyNFT.isWarrantyValid(1)).to.be.true;
    });
  });

  describe("6. Anti-Theft Protection: reportStolen() & recoverStolen()", function () {
    beforeEach(async function () {
      await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, 365);
      await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);
    });

    it("Should allow only the token owner to report stolen", async function () {
      await expect(
        warrantyNFT.connect(stranger).reportStolen(1)
      ).to.be.revertedWith("WarrantyNFT: Caller is not the owner");

      await expect(warrantyNFT.connect(customer).reportStolen(1))
        .to.emit(warrantyNFT, "TheftStatusChanged")
        .withArgs(1, true);

      const info = await warrantyNFT.getWarrantyInfo(1);
      expect(info.isStolen).to.be.true;
      // Stolen items are immediately invalidated for warranty claims
      expect(await warrantyNFT.isWarrantyValid(1)).to.be.false;
    });

    it("Should strictly BLOCK any ERC-721 transfer while flagged stolen", async function () {
      await warrantyNFT.connect(customer).reportStolen(1);

      // Attempting transferFrom
      await expect(
        warrantyNFT.connect(customer).transferFrom(customer.address, buyer.address, 1)
      ).to.be.revertedWith("WarrantyNFT: Token flagged stolen. Transfers are blocked.");

      // Attempting safeTransferFrom
      await expect(
        warrantyNFT
          .connect(customer)
          ["safeTransferFrom(address,address,uint256)"](customer.address, buyer.address, 1)
      ).to.be.revertedWith("WarrantyNFT: Token flagged stolen. Transfers are blocked.");
    });

    it("Should allow the owner to recover stolen item and restore transfers", async function () {
      await warrantyNFT.connect(customer).reportStolen(1);

      await expect(
        warrantyNFT.connect(stranger).recoverStolen(1)
      ).to.be.revertedWith("WarrantyNFT: Caller is not the owner");

      await expect(warrantyNFT.connect(customer).recoverStolen(1))
        .to.emit(warrantyNFT, "TheftStatusChanged")
        .withArgs(1, false);

      const info = await warrantyNFT.getWarrantyInfo(1);
      expect(info.isStolen).to.be.false;
      expect(await warrantyNFT.isWarrantyValid(1)).to.be.true;

      // Transfer should now succeed
      await warrantyNFT
        .connect(customer)
        .transferFrom(customer.address, buyer.address, 1);
      expect(await warrantyNFT.ownerOf(1)).to.equal(buyer.address);
    });
  });

  describe("7. Service Center Repair Logs: recordService()", function () {
    beforeEach(async function () {
      await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, 365);
      await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);
    });

    it("Should allow SERVICE_CENTER_ROLE to record repair on-chain", async function () {
      const serviceType = "Display Assembly Replacement";
      const reportCid = "QmServiceDiagnosisProof123";

      const tx = await warrantyNFT
        .connect(serviceCenter)
        .recordService(1, serviceType, reportCid);

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(warrantyNFT, "ServiceRecorded")
        .withArgs(1, serviceCenter.address, serviceType, reportCid, block.timestamp);

      const history = await warrantyNFT.getServiceHistory(1);
      expect(history.length).to.equal(1);
      expect(history[0].serviceCenter).to.equal(serviceCenter.address);
      expect(history[0].serviceType).to.equal(serviceType);
      expect(history[0].ipfsReportCid).to.equal(reportCid);
      expect(history[0].timestamp).to.equal(block.timestamp);
    });

    it("Should prevent non-service-center from recording repair", async function () {
      await expect(
        warrantyNFT.connect(stranger).recordService(1, "Battery Swap", "QmCid")
      ).to.be.revertedWithCustomError(warrantyNFT, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent recording service on a stolen product", async function () {
      await warrantyNFT.connect(customer).reportStolen(1);

      await expect(
        warrantyNFT.connect(serviceCenter).recordService(1, "Inspection", "QmCid")
      ).to.be.revertedWith("WarrantyNFT: Cannot service a stolen product");
    });
  });

  describe("8. Public View & Verification Helpers", function () {
    beforeEach(async function () {
      await warrantyNFT
        .connect(brand)
        .mintProduct(retailer.address, sampleSerialHash, sampleUri, 365);
      await warrantyNFT.connect(retailer).activateAndSell(1, customer.address);
      await warrantyNFT
        .connect(serviceCenter)
        .recordService(1, "Battery Diagnostics", "QmReport1");
    });

    it("Should return correct public verification by serialHash", async function () {
      const res = await warrantyNFT.verifyProductBySerial(sampleSerialHash);

      expect(res.tokenId).to.equal(1);
      expect(res.exists).to.be.true;
      expect(res.currentOwner).to.equal(customer.address);
      expect(res.isActivated).to.be.true;
      expect(res.isValid).to.be.true;
      expect(res.isStolen).to.be.false;
      expect(res.durationDays).to.equal(365);
      expect(res.serviceCount).to.equal(1);
    });

    it("Should return nonexistent status for unregistered serialHash", async function () {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("SN-UNKNOWN"));
      const res = await warrantyNFT.verifyProductBySerial(unknownHash);

      expect(res.tokenId).to.equal(0);
      expect(res.exists).to.be.false;
      expect(res.currentOwner).to.equal(ethers.ZeroAddress);
    });

    it("Should return correct public verification by tokenId", async function () {
      const res = await warrantyNFT.verifyProductByTokenId(1);

      expect(res.serialNumberHash).to.equal(sampleSerialHash);
      expect(res.currentOwner).to.equal(customer.address);
      expect(res.isActivated).to.be.true;
      expect(res.isValid).to.be.true;
      expect(res.serviceCount).to.equal(1);
    });
  });
});
