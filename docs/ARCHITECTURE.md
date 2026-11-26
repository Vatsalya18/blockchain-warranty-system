# System Architecture & Technical Design Blueprint
## Blockchain-Based Digital Warranty and Product Ownership System

**Document Version:** 2.0.0 (Revised for SQLite & Remix IDE Architecture)  
**Target Network:** Polygon Amoy Testnet (Chain ID: 80002)  
**Database Engine:** SQLite 3 (via `better-sqlite3`)  
**Deployment Tooling:** Remix IDE + MetaMask / Hardhat  

---

## 1. High-Level System Architecture

The application adopts a **Tiered Hybrid Architecture**. Token ownership, authenticity, anti-theft locks, and append-only service logs reside immutably on the **Polygon Amoy blockchain**, while relational business entities, user credentials, and fast query indexes reside in **SQLite** via `better-sqlite3`.

```
+-------------------------------------------------------------------------+
|                           PRESENTATION TIER                             |
|                           React.js 18 + Vite                            |
|                                                                         |
|  +-----------------+  +-----------------+  +-------------------------+  |
|  | Brand Dashboard |  |  Retailer POS   |  |   Customer Vault UI     |  |
|  +-----------------+  +-----------------+  +-------------------------+  |
|  | Service Portal  |  | Admin Dashboard |  | Public Verify (QR scan) |  |
|  +-----------------+  +-----------------+  +-------------------------+  |
|           |                                             |               |
|      REST API Calls                               Web3 Provider         |
|      (JWT Auth)                                   (MetaMask / Ethers v6)|
+-----------|---------------------------------------------|---------------+
            |                                             |
            v                                             v
+-------------------------------+             +---------------------------+
|          BACKEND TIER         |             |      BLOCKCHAIN TIER      |
|    Node.js / Express.js       |             |   Polygon Amoy Testnet    |
|                               |             |                           |
| • Auth & RBAC Middleware      |             | • ERC-721 Contract        |
| • Serial Hasher (keccak256)   |             | • AccessControl Matrix    |
| • Pinata IPFS Gateway Client  |             | • Stolen Transfer Guard   |
| • Claims Workflow Controller  |             | • Append-Only Service Log |
+---------------+---------------+             +-------------+-------------+
                |                                           |
                | WebSocket / RPC Event Subscription       |
                | (WarrantyActivated, ServiceRecorded, ...) |
                v                                           |
+-------------------------------+                           |
|   BACKGROUND EVENT INDEXER    |<--------------------------+
|  (Syncs on-chain state to DB) |
+---------------+---------------+
                |
                v
+-------------------------------------------------------------------------+
|                              DATA TIER                                  |
|                                                                         |
|   +-------------------------------+   +-----------------------------+   |
|   |            SQLite 3           |   |         IPFS (Pinata)       |   |
|   |     (better-sqlite3 WAL)      |   | • ERC-721 Metadata JSON     |   |
|   | • User Identities & Roles     |   | • High-Res Product Media    |   |
|   | • Product Models Catalog      |   | • Service Invoices/Reports  |   |
|   | • Normalized Claims Tickets   |   +-----------------------------+   |
|   | • Synced Warranty Read-Cache  |                                     |
|   | • Relational Service Records  |                                     |
|   +-------------------------------+                                     |
+-------------------------------------------------------------------------+
```

---

## 2. Explicit Data Partitioning Matrix

| Data Item | Storage Layer | Justification |
|---|:---:|---|
| **Token ID & Ownership** | Polygon Amoy (On-Chain) | Cryptographic proof of ownership; cannot be altered even if server is compromised. |
| **Serial Number Hash (`keccak256`)** | Polygon Amoy (On-Chain) | Allows public verification without exposing raw physical serial numbers. |
| **Warranty Activation Date** | Polygon Amoy (On-Chain) | Immutable timestamp prevents fraudulent warranty extensions. |
| **Warranty Duration (Days)** | Polygon Amoy (On-Chain) | Enables smart contract to calculate `isWarrantyValid()` trustlessly. |
| **Theft Lock Status (`isStolen`)** | Polygon Amoy (On-Chain) | Required on-chain to revert unauthorized transfers in `_update()`. |
| **Service & Repair Log Structs** | Polygon Amoy (On-Chain) | Permanent service history gives trust to future secondary buyers. |
| **Role Assignments** | Polygon Amoy (On-Chain) | OpenZeppelin `AccessControl` governs write permissions (minting, activating, repairs). |
| **NFT Metadata JSON (Attributes, Specs)**| IPFS (Pinata) | Decentralized, immutable content addressing without paying massive gas fees. |
| **Product Images & Service Attachments** | IPFS (Pinata) | Large binary media unsuitable for blockchain storage. |
| **User Identities & Passwords** | SQLite (`users` table) | Sensitive personal data protected off-chain (bcrypt-hashed passwords). |
| **Product Model Catalog Master** | SQLite (`product_models` table) | Rapid relational querying, categorizing, and UI dropdown population. |
| **Warranty Claims Processing Workflow** | SQLite (`warranty_claims` table) | Mutable support ticketing with status changes (`pending`, `under_review`). |
| **Synced Warranty Cache** | SQLite (`warranties` table) | Read-optimized local table for sub-second search, filtering, and public portal display. |
| **Service Records Relational Cache** | SQLite (`service_records` table) | Foreign-key linked relational records for fast UI display without slow RPC queries. |

---

## 3. Core Lifecycle Mechanics

### 3.1 Minting & Custody Distribution
```
[Brand Dashboard] ──(Uploads Model & Serials)──► [Node.js Backend]
                                                         │
                                               Calculates keccak256
                                               Generates JSON Metadata
                                               Pins to IPFS (Pinata)
                                                         │
                                                         ▼
[Polygon Contract] ◄──(Sign batchMint via MetaMask)── [Brand Wallet]
        │
   Mints ERC-721
   Owner = Retailer Address
   Status = Minted (Unactivated)
        │
   Emits ProductMinted
        │
        ▼
[Event Indexer] ──► Inserts row into SQLite `warranties` table
```

### 3.2 Point-of-Sale Activation & Expiry Mechanics
1. When a consumer buys the product, the retailer selects the Token ID in their dashboard and inputs the customer's wallet address.
2. The retailer executes `activateAndSell(tokenId, customerAddress)` via MetaMask.
3. The smart contract validates caller is retailer, sets `activationDate = block.timestamp`, `isActivated = true`, and transfers the NFT to the customer.
4. **Expiry Calculation:**
   $$\text{Expiry Timestamp} = \text{activationDate} + (\text{durationDays} \times 86400)$$
   Dynamic check in `isWarrantyValid(tokenId)` compares against `block.timestamp`.
5. The indexer catches `WarrantyActivated` and updates the SQLite record:
   ```sql
   UPDATE warranties SET status = 'active', activation_date = ?, expiry_date = ?, current_owner_address = ? WHERE token_id = ?;
   ```

### 3.3 Ownership Transfer Preserving Remaining Warranty
1. When the initial customer resells the physical item, they transfer the NFT to the buyer's wallet (`safeTransferFrom`).
2. The contract verifies `!warranties[tokenId].isStolen`.
3. Because `activationDate` and `durationDays` are permanent state variables on-chain, the remaining warranty is automatically inherited by the new owner.
4. The indexer receives the `Transfer` event and updates `current_owner_address` in SQLite.

### 3.4 Stolen Product Reporting & Recovery
1. The registered owner calls `reportStolen(tokenId)`.
2. The contract sets `isStolen = true`. Overridden `_update()` hook immediately reverts any transfer attempts.
3. The indexer updates `is_stolen = 1` and `status = 'stolen'` in SQLite.
4. If recovered, the owner calls `recoverStolen(tokenId)`, restoring transferability.

### 3.5 Service Center Repair Recording
1. The customer brings the device to an authorized service center.
2. The service center scans the QR code; system queries `isWarrantyValid(tokenId)`:
   - If `isStolen`: Displays **STOLEN ITEM DETECTED**.
   - If expired: Informs customer warranty has lapsed.
   - If valid: Shows remaining days and full past repair records.
3. The technician enters the diagnosis and replaced parts, which are pinned to IPFS.
4. The service center signs `recordService(tokenId, serviceType, ipfsReportCid)` on-chain.
5. The indexer catches `ServiceRecorded` and writes an entry into the SQLite `service_records` table, linking it to any active claim.

### 3.6 QR-Based Public Verification
1. Physical QR code contains `https://<domain>/verify?tokenId=1042&serial=SN-SONY-99214`.
2. Anyone scans the QR code or searches by serial number.
3. The backend:
   - Computes `keccak256(serial)`.
   - Queries SQLite `warranties` joined with `product_models` and `service_records`.
   - Returns verified authenticity, brand info, remaining warranty countdown, stolen status, and repair timeline.

---

## 4. Remix IDE Smart Contract Workflow

For B.Tech academic development and evaluation, deploying via **Remix IDE** with **MetaMask** offers maximum reliability:

1. Open Remix IDE (`https://remix.ethereum.org/`).
2. Create `ProductWarrantyNFT.sol` using our audited code from `blockchain/contracts/ProductWarrantyNFT.sol`.
3. Compile with Solidity `0.8.24` and EVM version `Cancun`.
4. In "Deploy & Run Transactions", select Environment: **Injected Provider - MetaMask**.
5. Ensure MetaMask is connected to **Polygon Amoy Testnet (Chain ID 80002)**.
6. Pass your Admin deployer address into the constructor and click **Deploy**.
7. Copy the deployed contract address and paste it into `server/.env` and `client/.env`.
8. The Express event listener and React frontend immediately attach to the live contract!
