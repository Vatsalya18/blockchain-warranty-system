# Phased Development Roadmap & Implementation Plan
## Blockchain-Based Digital Warranty and Product Ownership System

**Document Version:** 1.0.0  
**Project Scope:** Complete End-to-End Implementation across Smart Contracts, Backend, Database, and Frontend.  

---

## 1. Roadmap Overview & Milestones

```
+-------------------------------------------------------------------------------+
| PHASE 1: Smart Contract Engineering & On-Chain Verification                   |
| ├── Write ProductWarrantyNFT.sol with OpenZeppelin v5 AccessControl           |
| ├── Full Hardhat Unit Test Suite (100% path coverage for roles, stolen, etc.) |
| └── Deploy to Polygon Amoy Testnet & Verify on Polygonscan                    |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| PHASE 2: Backend API, SQLite Database & IPFS Pinata Service                   |
| ├── Initialize Node.js/Express server architecture                            |
| ├── Configure SQLite connection (better-sqlite3) & Relational Migrations      |
| ├── Implement JWT Auth & Role-Based Middleware                                |
| ├── Build IPFS Pinata integration for metadata & product image uploads        |
| └── Build CSV batch parsing service with keccak256 serial hashing             |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| PHASE 3: Real-Time Blockchain Event Indexer & Synced Read Cache               |
| ├── WebSocket/RPC Ethers.js event listener worker                             |
| ├── Implement handlers for ProductMinted, WarrantyActivated, etc.             |
| └── Block checkpointing logic in sync_states to resume without missing events |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| PHASE 4: Frontend Development & Role-Specific Dashboards                      |
| ├── Setup React 18 + Vite + Tailwind CSS + Web3 Context                       |
| ├── Admin Dashboard (Organization review & on-chain role grant)               |
| ├── Brand Portal (Model creation, single & CSV batch minting)                 |
| ├── Retailer POS Portal (Unactivated inventory & point-of-sale transfer)      |
| ├── Customer Vault (Owned items, warranty timer, resale transfer, theft flag) |
| ├── Service Center Portal (In-browser camera QR scanner & repair logging)     |
| └── Public Verification Page (Serial search, authenticity check, timeline)    |
+-------------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------------+
| PHASE 5: End-to-End Verification, Polish & Project Documentation              |
| ├── Comprehensive user journey testing across all 5 roles                     |
| ├── Verification of stolen lockouts, expiry calculations, and reorg safety    |
| └── Final project presentation guide & demonstration test data seed scripts   |
+-------------------------------------------------------------------------------+
```

---

## 2. Detailed Breakdown by Phase

### Phase 1: Smart Contract Engineering & On-Chain Verification
- **Deliverables:**
  - `ProductWarrantyNFT.sol` implementing ERC-721, `ERC721URIStorage`, and `AccessControl`.
  - Hardhat test suite in `test/WarrantyNFT.test.js` validating:
    - Admin assigning roles (`BRAND_ROLE`, `RETAILER_ROLE`, `SERVICE_CENTER_ROLE`).
    - Brand minting to retailer with unactivated warranty status.
    - Batch minting gas efficiency.
    - Retailer calling `activateAndSell` and verifying timestamp calculation.
    - Customer calling `reportStolen` and confirming standard transfers revert.
    - Customer calling `recoverStolen` and confirming transfers succeed.
    - Service center appending repair history.
    - Dynamic evaluation of `isWarrantyValid`.
  - Deployment script `scripts/deploy.js` targeting Polygon Amoy.
- **Quality Gate:** All tests passing locally with zero errors before deploying on Amoy testnet.

---

### Phase 2: Backend REST API, SQLite Database & IPFS Integration
- **Deliverables:**
  - Modular Express folder structure (`controllers`, `database`, `routes`, `middleware`, `services`).
  - SQLite database migration script creating `users`, `product_models`, `warranties`, `service_records`, `warranty_claims`, `sync_states`.
  - Pinata IPFS service module (`pinJSONToIPFS`, `pinFileToIPFS`).
  - REST endpoints for User registration, Login, Brand catalog, Minting preparation, and Claims.
  - CSV parser converting uploaded rows of serial numbers into `keccak256` hashes and metadata payloads.
- **Quality Gate:** All API endpoints tested and verified via automated test scripts or Postman collection.

---

### Phase 3: Real-Time Event Indexer
- **Deliverables:**
  - Event listener daemon running concurrently with the Express server.
  - Subscriptions to all on-chain events:
    - `ProductMinted` $\rightarrow$ Inserts warranty row with status `minted`.
    - `WarrantyActivated` $\rightarrow$ Updates warranty row with `activation_date`, `expiry_date`, and status `active`.
    - `Transfer` $\rightarrow$ Updates `current_owner_address`.
    - `TheftStatusChanged` $\rightarrow$ Updates `is_stolen` and status flags.
    - `ServiceRecorded` $\rightarrow$ Inserts row into `service_records` table and updates linked claim.
  - Resilient restart recovery scanning from `sync_states.last_indexed_block`.
- **Quality Gate:** Making an on-chain transaction reflects in SQLite within 1 second.

---

### Phase 4: Frontend Role Dashboards & Web3 Integration
- **Deliverables:**
  - Global `Web3Context` handling MetaMask connection, network switching to Amoy, and wallet state.
  - Protected routes restricting views based on authenticated JWT role and verified wallet address.
  - Role-specific UI screens:
    1. **Public Verification View:** Search bar + QR camera scanner. Displays authenticity verification, remaining warranty progress bar, and repair logs.
    2. **Admin Screen:** Approving institutional registrations and executing on-chain `grantRole` transactions.
    3. **Brand Portal:** Model builder, single unit minting, and drag-and-drop CSV batch minting.
    4. **Retailer POS:** Inventory view, customer wallet input, and single-click activation and sale.
    5. **Customer Vault:** Grid of owned devices, live warranty countdown, resale transfer modal, theft report button, and warranty claim submission.
    6. **Service Center View:** Camera scanner, instant validity badge, repair entry form, and IPFS report upload.
- **Quality Gate:** Responsive UI tested across desktop and mobile screen resolutions.

---

### Phase 5: End-to-End System Integration & Demo Preparation
- **Deliverables:**
  - Seed script to pre-populate demo data (1 Admin, 1 Brand, 1 Retailer, 1 Service Center, 2 Customers, 3 Product Models).
  - Walkthrough test script verifying the full lifecycle from Brand manufacture to customer resale and repair.
  - Final project documentation, architecture diagrams, and presentation deck outline.
- **Quality Gate:** Complete, flawless demonstration flow ready for viva examination.
