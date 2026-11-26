# Technology Stack, Tooling & Configuration Guide
## Blockchain-Based Digital Warranty and Product Ownership System

**Document Version:** 2.0.0 (Revised for SQLite Architecture)  
**Project Category:** Full-Stack Web3 DApp (Hybrid On-Chain/Off-Chain)  

---

## 1. Technology Selection & Rationale

```
+-----------------------------------------------------------------------------------------+
| LAYER               TECHNOLOGY                     VERSION    RATIONALE                 |
+---------------------+------------------------------+----------+-------------------------+
| Frontend Framework  | React.js (via Vite)          | 18.x     | Fast HMR, SPA           |
| Web3 Integration    | ethers.js                    | 6.x      | Polygon Amoy & MetaMask |
| Styling & UI        | Tailwind CSS + Lucide Icons  | 3.x      | Matches Reference UI    |
| QR Code Engine      | html5-qrcode + qrcode.react  | Latest   | Camera & Render         |
| Backend Runtime     | Node.js LTS                  | 20.x     | High I/O asynchronous   |
| REST Framework      | Express.js                   | 4.x      | Battle-tested           |
| Database Engine     | SQLite 3 (better-sqlite3)    | 11.x     | Fast, local, zero-cloud |
| File Storage (Dec.) | IPFS via Pinata Gateway      | Latest   | ERC-721 CIDs            |
| Smart Contracts     | Solidity                     | ^0.8.24  | Type safety             |
| Contract Deployment | Remix IDE / Hardhat          | Latest   | Visual & scripted deploy|
| Security Library    | OpenZeppelin Contracts       | 5.x      | Audited ERC721          |
| Blockchain Network  | Polygon Amoy Testnet         | Chain 80002 Low gas, EVM        |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Why SQLite (`better-sqlite3`) for this Project

1. **Zero Cloud Friction for Demonstrations:**
   - No external MongoDB Atlas connection strings, IP whitelist blocks on university Wi-Fi, or cloud billings.
   - The entire database lives in a local file (`server/data/warranty.db`) that can be bundled, inspected with DB Browser for SQLite, or wiped/seeded in seconds.
2. **Synchronous C++ Binding (`better-sqlite3`):**
   - Direct synchronous API drastically simplifies database queries, eliminates "unhandled promise rejection" crashes, and executes queries in $< 15\text{ ms}$.
3. **Strict Relational Integrity:**
   - Enforces foreign keys (`ON DELETE RESTRICT/CASCADE`) between Users, Models, Warranties, Claims, and Service Records.
4. **Write-Ahead Logging (WAL Mode):**
   - High concurrent read performance allows the frontend to query data while the background blockchain event indexer writes new blocks simultaneously.

---

## 3. Environment Variables Specification

### 3.1 Backend Environment (`server/.env`)
```env
PORT=5000
NODE_ENV=development

# SQLite Database File Path
DB_FILE_PATH=./data/warranty.db

# JWT Authentication
JWT_SECRET=super_secret_jwt_passphrase_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# Pinata IPFS Credentials
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret
PINATA_JWT=your_pinata_jwt_token
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/

# Polygon Amoy RPC & Smart Contract
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
INDEXER_START_BLOCK=0
```

### 3.2 Frontend Environment (`client/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_CHAIN_ID=80002
VITE_CHAIN_NAME="Polygon Amoy Testnet"
VITE_RPC_URL=https://rpc-amoy.polygon.technology/
VITE_BLOCK_EXPLORER=https://amoy.polygonscan.com/
VITE_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

### 3.3 Blockchain Environment (`blockchain/.env`)
```env
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

---

## 4. Smart Contract Deployment with Remix IDE

1. Open **[Remix IDE](https://remix.ethereum.org/)**.
2. Create `contracts/ProductWarrantyNFT.sol` and paste the Solidity source code.
3. In compiler tab, select version `0.8.24` and enable optimization.
4. In the deploy tab:
   - Select **Injected Provider - MetaMask**.
   - Make sure MetaMask is connected to **Polygon Amoy (Chain ID 80002)**.
   - Enter your Admin wallet address in the `defaultAdmin` parameter.
   - Click **Deploy** and confirm the transaction in MetaMask.
5. Copy the deployed contract address and paste it into `server/.env` and `client/.env`.
