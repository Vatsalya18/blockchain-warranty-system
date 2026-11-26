# Blockchain-Based Digital Warranty and Product Ownership System

**Target Network:** Polygon Amoy Testnet (Chain ID: `80002`)  
**Architecture:** Hybrid Web3 Decentralized Application (Solidity, Node.js, Express, SQLite, IPFS, React.js)  
**Authors:** Piyush Panwar, Vatsalya Singh, Bhumi Varshney  
**Supervisor:** Mr. Prakhar Mishra  
**Affiliation:** Jaypee Institute of Information Technology (JIIT)  

---

## 1. Project Overview

This project implements a decentralized product warranty and ownership lifecycle management platform. Physical product units are issued as **ERC-721 Non-Fungible Tokens (NFTs)** on the Polygon Amoy blockchain. 

### Core Capabilities:
- **Tamper-Proof Digital Warranty:** Cryptographically verified proof of authenticity issued by the manufacturer/brand.
- **Privacy-Preserving Serial Hashes:** Raw serial numbers are stored strictly as `keccak256` hashes on-chain.
- **Point-of-Sale Activation:** Retailers activate warranties upon consumer purchase, initiating the on-chain warranty clock.
- **Resale Transferability:** Consumers can transfer ownership on secondary resale while preserving remaining warranty duration.
- **On-Chain Anti-Theft Lock:** Owners can flag stolen units, immediately blocking any subsequent token transfer on-chain.
- **Append-Only Service Logs:** Authorized service centers write immutable repair records to the blockchain.
- **Public Verification:** Zero-login instant verification via serial number search or QR code scan.

---

## 2. Technology Stack

- **Smart Contracts:** Solidity `^0.8.24`, Hardhat, OpenZeppelin Contracts v5.0 (`AccessControl`, `ERC721URIStorage`).
- **Blockchain Network:** Polygon Amoy Testnet.
- **Backend API:** Node.js LTS, Express.js REST Framework.
- **Database:** SQLite 3 via `better-sqlite3` (High-speed, zero-cloud local relational store).
- **Decentralized Storage:** IPFS via Pinata Gateway for metadata JSON and multimedia.
- **Frontend Application:** React 18, Vite, Tailwind CSS, Lucide Icons, ethers.js v6, html5-qrcode.

---

## 3. Project Structure

```
BlockchainProject/
├── blockchain/               # Hardhat development environment & smart contracts
│   ├── contracts/            # Solidity contracts (ProductWarrantyNFT.sol)
│   ├── scripts/              # Deployment and verification scripts
│   ├── test/                 # Chai & Ethers unit tests
│   ├── hardhat.config.js     # Polygon Amoy & compiler configuration
│   └── package.json
│
├── server/                   # Node.js & Express REST API
│   ├── src/
│   │   ├── config/           # Database & constants configuration
│   │   ├── database/         # SQLite schema migrations & DB connection
│   │   ├── middleware/       # Centralized error handling & JWT middleware
│   │   ├── models/           # Relational DAO models (User, Warranty, Claims, etc.)
│   │   └── server.js         # Express app entry point
│   ├── data/                 # SQLite local database storage (warranty.db)
│   └── package.json
│
├── client/                   # React 18 + Vite Web3 Frontend
│   ├── src/
│   │   ├── components/       # Reusable layout and metric components
│   │   ├── context/          # Web3Context (MetaMask & ethers.js v6)
│   │   ├── pages/            # Role-specific dashboard views
│   │   ├── App.jsx           # Application root
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js    # Design system matching UI reference
│   └── package.json
│
└── docs/                     # Comprehensive architectural documentation
    ├── references/           # Preserved UI reference images
    ├── REQUIREMENTS.md       # Full SRS & Traceability Matrix
    ├── ARCHITECTURE.md       # Component interaction & data flows
    ├── DATABASE_SCHEMA.md    # SQLite tables, foreign keys & migrations
    ├── API_DOCUMENTATION.md  # REST API specifications
    ├── SMART_CONTRACT_DESIGN.md # Smart contract specification
    ├── TECH_STACK.md         # Tools & dependencies guide
    ├── UI_DESIGN_GUIDELINES.md # Visual style and design tokens
    └── DEVELOPMENT_ROADMAP.md # Phased implementation plan
```

---

## 4. Prerequisites

1. **Node.js:** `v20.x` or `v24.x` LTS
2. **NPM:** `v10.x` or `v11.x`
3. **Git:** Installed and configured
4. **MetaMask Extension:** Configured with Polygon Amoy Testnet (`Chain ID: 80002`)
5. **Remix IDE (or Hardhat):** For deploying the smart contract on Polygon Amoy

---

## 5. Installation Instructions

Install dependencies across all three modular subprojects:

```bash
# 1. Install Blockchain dependencies
cd blockchain
npm install

# 2. Install Server dependencies
cd ../server
npm install

# 3. Install Client dependencies
cd ../client
npm install
```

---

## 6. Environment Configuration

Copy the example environment files and configure your keys:

```bash
# Blockchain
cp blockchain/.env.example blockchain/.env

# Server
cp server/.env.example server/.env

# Client
cp client/.env.example client/.env
```

---

## 7. Local Development Commands

```bash
# Run Smart Contract Unit Tests (Hardhat)
cd blockchain
npx hardhat test

# Start Express Backend Server (Port 5000)
cd ../server
npm start

# Start Vite React Frontend (Port 5173)
cd ../client
npm run dev
```

---

## 8. Development Roadmap Progress

- [x] **Phase 1: Project Initialization & UI Reference Analysis**
- [x] **Phase 2 — Step 1: Smart Contract Engineering & Unit Testing (26 passing tests)**
- [x] **Phase 2 — Step 2: Express + SQLite 3 + ethers.js v6 Backend (17 passing tests)**
- [x] **Phase 3: React 18 + Vite + ethers.js v6 Web3 Frontend (All 5 portals + Public Verify + QR scanner)**
- [x] **End-to-End System Build Verification (`vite build` 100% success)**
