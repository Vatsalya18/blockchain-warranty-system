# Smart Contract Design & Specification
## Contract: `ProductWarrantyNFT.sol`

**Language:** Solidity `^0.8.24`  
**Standard:** ERC-721 (Non-Fungible Token) with `ERC721URIStorage`  
**Security Framework:** OpenZeppelin Contracts v5.0 (`AccessControl`, `ReentrancyGuard`)  
**Deployment Target:** Polygon Amoy Testnet (Chain ID: 80002)  

---

## 1. Architectural Strategy

The contract balances decentralization and execution efficiency:
1. **AccessControl:** Implements deterministic, byte-keyed roles for Admin, Brand, Retailer, and Service Center.
2. **Serial Privacy:** Only `bytes32 serialNumberHash = keccak256(...)` is stored on-chain, preventing plain serial snooping.
3. **Storage Packing:** Tight variable packing reduces expensive `SSTORE` operations:
   - `activationDate`: `uint64` (valid until year 2500+)
   - `durationDays`: `uint32`
   - `isActivated`: `bool` (1 byte)
   - `isStolen`: `bool` (1 byte)
   All fit within a single 32-byte storage slot!
4. **Enforced Transfer Locks:** Overriding the OpenZeppelin v5 `_update()` internal function guarantees that `reportStolen` halts all standard ERC-721 transfers without needing non-standard transfer wrappers.

---

## 2. Roles & Permissions Matrix

```solidity
bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");
bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");
bytes32 public constant SERVICE_CENTER_ROLE = keccak256("SERVICE_CENTER_ROLE");
```

| Function Name | Authorized Callers | State Changes |
|---|---|---|
| `mintProduct` | `BRAND_ROLE` | Mints NFT to Retailer; initializes `WarrantyDetails`. |
| `batchMintProducts` | `BRAND_ROLE` | Loops and mints multiple tokens to Retailer in a single transaction. |
| `activateAndSell` | `RETAILER_ROLE` or Token Owner | Starts warranty countdown; transfers token to Customer. |
| `reportStolen` | Token Owner (`ownerOf(tokenId)`) | Sets `isStolen = true`; freezes token transfers. |
| `recoverStolen` | Token Owner (`ownerOf(tokenId)`) | Sets `isStolen = false`; unfreezes token transfers. |
| `recordService` | `SERVICE_CENTER_ROLE` | Appends `ServiceRecord` struct to token history. |
| `transferFrom / safeTransferFrom` | Token Owner (if not stolen) | Moves NFT to new owner while preserving warranty timestamps. |

---

## 3. Data Structures

```solidity
struct WarrantyDetails {
    bytes32 serialNumberHash; // keccak256(serialNumber)
    uint64 activationDate;    // Unix timestamp at point of sale
    uint32 durationDays;      // Total warranty coverage in days
    bool isActivated;         // True after point of sale
    bool isStolen;            // True if reported stolen by owner
}

struct ServiceRecord {
    uint64 timestamp;         // Block timestamp when service was logged
    address serviceCenter;    // Service center wallet address
    string serviceType;       // e.g., "Screen Replacement", "Battery Swap"
    string ipfsReportCid;     // IPFS hash of full technician notes/receipt
}
```

---

## 4. Complete Function Interface Specifications

### 4.1 `mintProduct`
```solidity
function mintProduct(
    address retailer,
    bytes32 serialHash,
    string calldata tokenURI,
    uint32 durationDays
) external onlyRole(BRAND_ROLE) returns (uint256);
```
- **Requirements:**
  - `retailer != address(0)`
  - `serialHash` must not have been previously registered.
  - `durationDays > 0`
- **Behavior:**
  - Increments `_nextTokenId`.
  - Mints token directly to `retailer`.
  - Sets token URI via `_setTokenURI(tokenId, tokenURI)`.
  - Initializes `WarrantyDetails` with `isActivated = false`, `activationDate = 0`.
  - Emits `ProductMinted(tokenId, retailer, serialHash)`.

### 4.2 `batchMintProducts`
```solidity
function batchMintProducts(
    address retailer,
    bytes32[] calldata serialHashes,
    string[] calldata tokenURIs,
    uint32[] calldata durations
) external onlyRole(BRAND_ROLE);
```
- **Requirements:**
  - Array lengths of `serialHashes`, `tokenURIs`, and `durations` must be equal.
  - Recommended batch size $\le 100$ to avoid block gas limit exhaustion.

### 4.3 `activateAndSell`
```solidity
function activateAndSell(uint256 tokenId, address customer) external;
```
- **Requirements:**
  - Caller must be either current `ownerOf(tokenId)` or hold `RETAILER_ROLE`.
  - `customer != address(0)`.
  - `!warranty[tokenId].isActivated` (prevents double activation).
- **Behavior:**
  - Sets `activationDate = uint64(block.timestamp)`.
  - Sets `isActivated = true`.
  - Calls `_transfer(ownerOf(tokenId), customer, tokenId)` to transfer ownership to customer.
  - Emits `WarrantyActivated(tokenId, customer, block.timestamp, warranty[tokenId].durationDays)`.

### 4.4 `reportStolen` / `recoverStolen`
```solidity
function reportStolen(uint256 tokenId) external;
function recoverStolen(uint256 tokenId) external;
```
- **Requirements:**
  - `msg.sender == ownerOf(tokenId)`
- **Behavior:**
  - Updates `warranty[tokenId].isStolen` to `true` / `false`.
  - Emits `TheftStatusChanged(tokenId, isStolen)`.

### 4.5 `recordService`
```solidity
function recordService(
    uint256 tokenId,
    string calldata serviceType,
    string calldata ipfsReportCid
) external onlyRole(SERVICE_CENTER_ROLE);
```
- **Requirements:**
  - Token must exist.
  - Token must not be reported stolen.
- **Behavior:**
  - Appends new `ServiceRecord` to `serviceHistories[tokenId]`.
  - Emits `ServiceRecorded(tokenId, msg.sender, serviceType, ipfsReportCid, block.timestamp)`.

### 4.6 `isWarrantyValid` (View)
```solidity
function isWarrantyValid(uint256 tokenId) external view returns (bool) {
    WarrantyDetails memory w = warranties[tokenId];
    if (!w.isActivated || w.isStolen) {
        return false;
    }
    return block.timestamp <= (w.activationDate + (uint256(w.durationDays) * 1 days));
}
```

### 4.7 Internal Transfer Hook Override
```solidity
function _update(
    address to,
    uint256 tokenId,
    address auth
) internal override returns (address) {
    address from = _ownerOf(tokenId);
    // If not a mint operation, check if token is locked due to theft
    if (from != address(0)) {
        require(!warranties[tokenId].isStolen, "WarrantyNFT: Token flagged stolen. Transfers are blocked.");
    }
    return super._update(to, tokenId, auth);
}
```

---

## 5. Contract Events

```solidity
event ProductMinted(uint256 indexed tokenId, address indexed retailer, bytes32 indexed serialHash);
event WarrantyActivated(uint256 indexed tokenId, address indexed customer, uint64 activationDate, uint32 durationDays);
event TheftStatusChanged(uint256 indexed tokenId, bool isStolen);
event ServiceRecorded(uint256 indexed tokenId, address indexed serviceCenter, string serviceType, string ipfsReportCid, uint64 timestamp);
```

---

## 6. Security Analysis & Best Practices

1. **Reentrancy Protection:** All state mutations occur before external calls; view functions are pure/view.
2. **Access Control Auditing:** Modifiers `onlyRole(ROLE_NAME)` guard all privileged endpoints.
3. **No Centralized Key Backdoors:** No admin can arbitrarily take away or seize customer tokens. Admin role only manages institutional authorization (`grantRole` / `revokeRole`).
4. **Front-Running & Griefing Prevention:** Serial numbers are hashed; attackers monitoring the mempool cannot derive the raw serial or claim ownership before the point-of-sale call executes.
