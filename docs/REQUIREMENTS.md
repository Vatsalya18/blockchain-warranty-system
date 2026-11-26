# Software Requirements Specification (SRS)
## Blockchain-Based Digital Warranty and Product Ownership System

**Document Version:** 1.0.0  
**Project Classification:** B.Tech Semester-V Capstone Project  
**Affiliation:** Jaypee Institute of Information Technology (JIIT)  
**Authors:** Piyush Panwar, Vatsalya Singh, Bhumi Varshney  
**Supervisor:** Mr. Prakhar Mishra  

---

## 1. Introduction & Problem Statement

### 1.1 Context
Traditional warranty management relies primarily on paper receipts, physical warranty cards, and vendor-siloed centralized databases. These legacy artifacts present fundamental flaws:
- They degrade, fade, or get misplaced over time.
- Physical invoices are trivial to forge or tamper with using modern graphic tools.
- Secondary buyers in second-hand markets (e.g., OLX, Cashify, eBay) have zero reliable means to verify if a product is genuine, under valid warranty, or reported stolen.
- Manufacturers suffer significant losses annually due to warranty fraud (e.g., duplicate claims across unauthorized repair shops, false returns).

### 1.2 The Solution
A decentralized, full-stack Web3 application where each physical product unit is issued an ERC-721 Non-Fungible Token (NFT) on the Polygon Amoy blockchain at manufacture. The NFT represents proof of authenticity, ownership, and warranty coverage. When a product is sold, the warranty is activated; when resold, the token and remaining warranty transfer to the buyer; when serviced, certified repairs are permanently logged on-chain; and when stolen, transfers are locked immediately.

---

## 2. Requirements Traceability Matrix

Every feature below is classified into:
- **[EXPLICIT]**: Directly mandated by the submitted project synopsis.
- **[RECOMMENDED]**: Senior architectural best practice required to make the system secure, reliable, and user-friendly for project demonstrations.

| Req ID | Description | Source / Reference | Classification |
|---|---|---|---|
| **FR-AUTH-01** | User registration and login with email, password, and role selection | Synopsis Page 5 | **EXPLICIT** |
| **FR-AUTH-02** | Web3 wallet linking via MetaMask (`window.ethereum`) | Synopsis Page 5 | **EXPLICIT** |
| **FR-AUTH-03** | Admin verification and approval for Brand, Retailer, and Service Center orgs | Synopsis Page 5 | **EXPLICIT** |
| **FR-BRD-01** | Brand can create and manage product model definitions | Synopsis Page 5 | **EXPLICIT** |
| **FR-BRD-02** | Brand can mint individual warranty NFTs directly to a retailer's wallet | Synopsis Page 5, 6 | **EXPLICIT** |
| **FR-BRD-03** | Brand can batch mint warranty NFTs using a CSV upload | Synopsis Page 5 | **EXPLICIT** |
| **FR-BRD-04** | Off-chain metadata (images, specifications) uploaded to IPFS via Pinata | Synopsis Page 5, 6 | **EXPLICIT** |
| **FR-RET-01** | Retailer can view unactivated inventory in custody | Synopsis Page 5, 6 | **EXPLICIT** |
| **FR-RET-02** | Retailer executes point-of-sale activation (`activateAndSell`) transferring NFT to customer | Synopsis Page 5, 6 | **EXPLICIT** |
| **FR-CUST-01** | Customer dashboard displays owned products, remaining warranty days, and status | Synopsis Page 5, 7 | **EXPLICIT** |
| **FR-CUST-02** | Customer can transfer product ownership to another wallet on secondary resale | Synopsis Page 4, 5 | **EXPLICIT** |
| **FR-CUST-03** | Customer can flag a product as stolen (`reportStolen`) | Synopsis Page 5, 7 | **EXPLICIT** |
| **FR-CUST-04** | Customer can unflag a recovered product (`recoverStolen`) | Synopsis Page 7 | **EXPLICIT** |
| **FR-CUST-05** | Customer can raise off-chain warranty claims for damaged/faulty products | Synopsis Page 5, 6 | **EXPLICIT** |
| **FR-SRV-01** | Service Center can verify product warranty status via camera QR code scan | Synopsis Page 5, 7 | **EXPLICIT** |
| **FR-SRV-02** | Service Center records repair logs on-chain (`recordService`) | Synopsis Page 5, 7 | **EXPLICIT** |
| **FR-PUB-01** | Public verification portal: verify authenticity, stolen flag, and repair history by serial or QR | Synopsis Page 3, 5, 7 | **EXPLICIT** |
| **FR-CORE-01** | Serial numbers stored strictly as `keccak256` hashes on-chain | Synopsis Page 7 | **EXPLICIT** |
| **FR-CORE-02** | Transfers automatically blocked on-chain when a product is flagged stolen | Synopsis Page 3, 4, 7 | **EXPLICIT** |
| **FR-CORE-03** | Backend event listener syncing on-chain events to SQLite database in real time | Synopsis Page 6 | **EXPLICIT** |
| **FR-OPT-01** | Cryptographic nonce verification for wallet linking (Sign-In with Ethereum style) | Architecture Recommendation | **RECOMMENDED** |
| **FR-OPT-02** | QR Code export utility (PNG/PDF printable label generation for brands/retailers) | Architecture Recommendation | **RECOMMENDED** |
| **FR-OPT-03** | Automated expiry banner & badge computing exact remaining days, hours, and minutes | Architecture Recommendation | **RECOMMENDED** |

---

## 3. Detailed Functional Requirements

### 3.1 Authentication & Organization Onboarding
- **3.1.1** The system shall support five roles: `Admin`, `Brand`, `Retailer`, `Customer`, and `ServiceCenter`.
- **3.1.2** All users authenticate off-chain with email and password (hashed with bcrypt, 12 rounds) receiving a scoped JSON Web Token (JWT).
- **3.1.3** Institutional roles (`Brand`, `Retailer`, `ServiceCenter`) register with business credentials and start in a `PENDING_APPROVAL` status.
- **3.1.4** The Admin reviews organization applications and approves them. Upon approval, the Admin assigns the corresponding on-chain role (`BRAND_ROLE`, `RETAILER_ROLE`, `SERVICE_CENTER_ROLE`) to the organization's verified wallet address.

### 3.2 Product Catalog & NFT Minting (Brand)
- **3.2.1** Brands define product templates including Model Name, Model Code, Description, Category, Image, and Default Warranty Period (in days).
- **3.2.2** Individual Minting: Brand enters a unique physical serial number and destination retailer wallet address. The system computes `keccak256(serialNumber)`, generates metadata JSON, pins it to IPFS, and executes `mintProduct()`.
- **3.2.3** Batch Minting: Brand uploads a CSV file containing `[serialNumber, modelCode, warrantyDays]`. The system parses the file, generates bulk IPFS metadata, and executes `batchMintProducts()`.
- **3.2.4** Tokens are minted directly into the retailer's wallet address. At this stage, `isActivated = false` and `activationDate = 0`.

### 3.3 Retail Point of Sale & Warranty Activation (Retailer)
- **3.3.1** Retailers view their inventory of unactivated products held in custody.
- **3.3.2** At checkout, the retailer inputs or scans the customer's Polygon wallet address.
- **3.3.3** Retailer executes `activateAndSell(tokenId, customerAddress)`.
- **3.3.4** The smart contract sets `activationDate = block.timestamp`, `isActivated = true`, and transfers the token from the retailer to the customer.

### 3.4 Asset Ownership, Resale & Anti-Theft (Customer)
- **3.4.1** Customers view their personal digital vault showing all owned items, active warranty badges, and time remaining.
- **3.4.2** Resale Transfer: The customer can enter a buyer's wallet address to transfer the NFT. The remaining warranty period is preserved because `activationDate` and `durationDays` remain unchanged.
- **3.4.3** Theft Flagging: The current owner can call `reportStolen(tokenId)`. Once flagged:
  - Smart contract reverts any token transfer attempts.
  - The public verification portal and service center scanner display prominent **STOLEN** alerts.
- **3.4.4** Recovery: Only the registered owner can call `recoverStolen(tokenId)` to restore normal transferability.

### 3.5 Service & Maintenance (Service Center)
- **3.5.1** Service centers use a web camera or 2D scanner to scan product QR codes.
- **3.5.2** The system checks `isWarrantyValid(tokenId)`. If expired or stolen, appropriate alerts are displayed.
- **3.5.3** If valid, technician logs repair details (Service Type, Work Performed, Replaced Parts). Detailed notes are pinned to IPFS, and `recordService(tokenId, serviceType, ipfsCid)` is executed on-chain.

### 3.6 Public Verification Portal
- **3.6.1** Accessible publicly without requiring wallet connection or user login.
- **3.6.2** Allows searching by Raw Serial Number or Token ID, or scanning a product QR code.
- **3.6.3** Displays:
  - Genuine Manufacturer Verification Badge.
  - Model Name, Specifications, and Official Product Image.
  - Warranty Status: `Active`, `Expired`, or `Unactivated`.
  - Remaining Warranty Duration.
  - Stolen Status: `Clean` vs. `Reported Stolen`.
  - Complete, verifiable timeline of all historical service and maintenance logs.

---

## 4. Non-Functional Requirements (NFR)

1. **Security & Data Privacy:**
   - Personally Identifiable Information (PII) such as customer name, phone, address, and email must **never** be written to the blockchain.
   - Physical serial numbers must **never** be stored as plaintext on-chain; only `keccak256` hashes are stored.
2. **Performance & Responsiveness:**
   - Read operations (public verification, customer dashboard) must serve from indexed SQLite relational tables within $< 100\text{ ms}$.
   - Heavy RPC polling is strictly prohibited on client devices; the backend event listener maintains state cache.
3. **Auditability & Immutability:**
   - Once a service record is written to the blockchain, it cannot be edited, deleted, or backdated.
4. **Usability:**
   - Intuitive desktop and mobile responsive design supporting camera-based QR scanning directly in-browser.
