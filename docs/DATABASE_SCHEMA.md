# Relational Database Schema & Migrations Specification
## Blockchain-Based Digital Warranty and Product Ownership System

**Database Engine:** SQLite 3 (via `better-sqlite3` driver)  
**Execution Mode:** Local File Database with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`)  
**Integrity Enforcement:** Foreign Keys Enabled (`PRAGMA foreign_keys = ON;`)  
**Document Version:** 2.0.0 (Revised for SQLite Architecture)

---

## 1. Architectural Role of SQLite vs. Blockchain

```
+---------------------------------------------------------------------------------+
|                                 DATA DIVISION                                   |
+---------------------------------------+-----------------------------------------+
| POLYGON AMOY BLOCKCHAIN (ON-CHAIN)    | SQLITE LOCAL RELATIONAL DB (OFF-CHAIN)  |
+---------------------------------------+-----------------------------------------+
| • Cryptographic proof of ownership   | • User PII (email, name, hashed pass)   |
| • Tamper-proof activation timestamp   | • Organization details & approval state |
| • keccak256(serialNumber) hash        | • Product model catalog & specifications|
| • Stolen flag (reverts transfers)     | • Customer support claims lifecycle     |
| • Append-only service log structs     | • Indexed cache of on-chain state       |
| • OpenZeppelin AccessControl roles    | • Sync checkpoint (last_indexed_block)  |
+---------------------------------------+-----------------------------------------+
```

SQLite serves as the high-speed, local relational data store and read-cache for the application:
1. **Zero External Cloud Dependencies:** The entire database is contained within a local file (`server/data/warranty.db`), eliminating network latency, cloud costs, and Atlas IP whitelist issues during college project presentations and examiner vivas.
2. **Relational Integrity:** Strict foreign key constraints (`REFERENCES`) guarantee that product models, claims, and service records remain consistent.
3. **Synchronous Performance:** `better-sqlite3` provides lightning-fast synchronous C++ bindings, avoiding async query overhead and providing instantaneous UI responses ($< 15\text{ ms}$).

---

## 2. Complete Relational Database Tables

### 2.1 Table: `users`
Stores user identities, hashed credentials, roles, and institutional verification status.

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'brand', 'retailer', 'customer', 'service_center')),
    wallet_address TEXT UNIQUE, -- Checksummed or lowercase 0x Ethereum address
    business_reg_number TEXT,
    contact_phone TEXT,
    physical_address TEXT,
    website TEXT,
    is_approved_by_admin INTEGER NOT NULL DEFAULT 0, -- 0 = False, 1 = True
    on_chain_role_assigned INTEGER NOT NULL DEFAULT 0, -- 0 = False, 1 = True
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_role_approved ON users(role, is_approved_by_admin);
```

---

### 2.2 Table: `product_models`
Stores manufacturer product catalog templates created by Brands before individual units are minted.

```sql
CREATE TABLE IF NOT EXISTS product_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_user_id INTEGER NOT NULL,
    brand_wallet_address TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_code TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    specifications_json TEXT DEFAULT '{}', -- JSON string of key-value attributes
    image_url TEXT DEFAULT '',
    image_ipfs_cid TEXT DEFAULT '',
    default_warranty_days INTEGER NOT NULL CHECK(default_warranty_days > 0),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (brand_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE(model_code, brand_wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_product_models_brand ON product_models(brand_user_id);
CREATE INDEX IF NOT EXISTS idx_product_models_category ON product_models(category);
```

---

### 2.3 Table: `warranties`
The off-chain synchronized replica of the on-chain ERC-721 tokens on Polygon Amoy.

```sql
CREATE TABLE IF NOT EXISTS warranties (
    token_id INTEGER PRIMARY KEY, -- Matches the on-chain ERC-721 tokenId
    serial_number_hash TEXT UNIQUE NOT NULL, -- keccak256(serialNumber) stored on-chain
    model_id INTEGER NOT NULL,
    brand_address TEXT NOT NULL,
    retailer_address TEXT NOT NULL,
    current_owner_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'minted' CHECK(status IN ('minted', 'active', 'expired', 'stolen')),
    activation_date INTEGER, -- Unix timestamp when activated at POS
    expiry_date INTEGER, -- Unix timestamp: activation_date + (warranty_duration_days * 86400)
    warranty_duration_days INTEGER NOT NULL,
    is_stolen INTEGER NOT NULL DEFAULT 0, -- 0 = False, 1 = True (locks transfer on-chain)
    metadata_uri TEXT DEFAULT '', -- ipfs://...
    mint_tx_hash TEXT DEFAULT '',
    activation_tx_hash TEXT DEFAULT '',
    last_sync_block INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (model_id) REFERENCES product_models(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_warranties_serial_hash ON warranties(serial_number_hash);
CREATE INDEX IF NOT EXISTS idx_warranties_current_owner ON warranties(current_owner_address);
CREATE INDEX IF NOT EXISTS idx_warranties_retailer ON warranties(retailer_address, status);
CREATE INDEX IF NOT EXISTS idx_warranties_status_expiry ON warranties(status, expiry_date);
```

---

### 2.4 Table: `service_records`
Normalized relational table storing repair entries logged on-chain by authorized service centers.

```sql
CREATE TABLE IF NOT EXISTS service_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    service_center_user_id INTEGER,
    service_center_address TEXT NOT NULL,
    service_type TEXT NOT NULL, -- e.g., "Screen Replacement", "Battery Swap"
    ipfs_report_cid TEXT NOT NULL, -- IPFS hash of technician report/bill
    technician_notes TEXT DEFAULT '',
    parts_replaced_json TEXT DEFAULT '[]', -- JSON array of replaced part numbers
    tx_hash TEXT NOT NULL, -- Polygon Amoy transaction hash
    service_timestamp INTEGER NOT NULL, -- On-chain block timestamp
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (token_id) REFERENCES warranties(token_id) ON DELETE CASCADE,
    FOREIGN KEY (service_center_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_records_token ON service_records(token_id);
CREATE INDEX IF NOT EXISTS idx_service_records_sc ON service_records(service_center_address);
CREATE INDEX IF NOT EXISTS idx_service_records_tx ON service_records(tx_hash);
```

---

### 2.5 Table: `warranty_claims`
Manages customer defect reports and claims workflows before and during repair.

```sql
CREATE TABLE IF NOT EXISTS warranty_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    claimant_user_id INTEGER NOT NULL,
    claimant_wallet TEXT NOT NULL,
    assigned_service_center_id INTEGER,
    issue_title TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    attachments_json TEXT DEFAULT '[]', -- JSON array of photo/invoice URLs
    claim_status TEXT NOT NULL DEFAULT 'pending' CHECK(claim_status IN ('pending', 'under_review', 'approved', 'in_repair', 'resolved', 'rejected')),
    admin_or_service_notes TEXT DEFAULT '',
    service_record_id INTEGER, -- Populated once the repair is logged on-chain
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (token_id) REFERENCES warranties(token_id) ON DELETE RESTRICT,
    FOREIGN KEY (claimant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_service_center_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (service_record_id) REFERENCES service_records(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_token ON warranty_claims(token_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON warranty_claims(claimant_user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON warranty_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_claims_assigned_sc ON warranty_claims(assigned_service_center_id, claim_status);
```

---

### 2.6 Table: `sync_states`
Maintains the block indexing checkpoint to ensure the WebSocket/RPC listener resumes without dropping events.

```sql
CREATE TABLE IF NOT EXISTS sync_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id INTEGER NOT NULL,
    contract_address TEXT NOT NULL,
    last_indexed_block INTEGER NOT NULL DEFAULT 0,
    last_sync_timestamp INTEGER DEFAULT (unixepoch()),
    UNIQUE(chain_id, contract_address)
);
```

---

## 3. Entity Relationship (ER) Diagram

```
 +--------------------+       1:N        +-----------------------+
 |       users        |----------------->|    product_models     |
 |  (id, role, ...)   |                  | (id, brand_user_id)   |
 +--------------------+                  +-----------------------+
           |                                         |
           | 1:N (claims)                            | 1:N
           v                                         v
 +--------------------+       1:1        +-----------------------+
 |  warranty_claims   |◄-----------------|      warranties       |
 | (claimant_user_id) |                  | (token_id, model_id)  |
 +--------------------+                  +-----------------------+
           |                                         |
           | 1:1 (optional link)                     | 1:N
           v                                         v
 +--------------------+                  +-----------------------+
 |  service_records   |◄─────────────────|    service_records    |
 | (on-chain repairs) |                  | (token_id, tx_hash)   |
 +--------------------+                  +-----------------------+
```

---

## 4. Migration & Initialization Strategy

1. **Migration Runner:** An automated initialization script (`server/src/database/migrate.js`) executes all table creation and index DDL on server boot.
2. **Pragma Optimizations:**
   ```javascript
   const Database = require('better-sqlite3');
   const db = new Database(process.env.DB_FILE_PATH || './data/warranty.db');
   
   // Enable foreign keys and high-speed WAL mode
   db.pragma('journal_mode = WAL');
   db.pragma('foreign_keys = ON');
   db.pragma('synchronous = NORMAL');
   ```
3. **Transaction Safety:** Multi-step updates (e.g., syncing a service event and marking an associated claim as `resolved`) are wrapped inside SQLite ACID transactions (`db.transaction(() => { ... })()`).
