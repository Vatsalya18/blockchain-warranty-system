# REST API Specification & Endpoint Documentation
## Blockchain-Based Digital Warranty and Product Ownership System

**Base URL:** `http://localhost:5000/api`  
**Database:** SQLite 3 via `better-sqlite3`  
**Authentication Scheme:** Bearer JWT in `Authorization` header (`Authorization: Bearer <token>`)  
**Standard Error Format:**
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Detailed error message explanation"
  }
}
```

---

## 1. Authentication & User Profile Endpoints

### 1.1 Register User / Organization
- **Endpoint:** `POST /api/auth/register`
- **Access:** Public
- **Request Body:**
```json
{
  "name": "Tata Croma Retail #42",
  "email": "croma42@retailer.com",
  "password": "SecurePassword123!",
  "role": "retailer",
  "walletAddress": "0x71c8959da40...a28e",
  "organizationDetails": {
    "businessRegistrationNumber": "GST-07AAAAA0000A1Z5",
    "contactPhone": "+919876543210",
    "physicalAddress": "Connaught Place, New Delhi",
    "website": "https://croma.com"
  }
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "userId": 4,
    "email": "croma42@retailer.com",
    "role": "retailer",
    "isApprovedByAdmin": 0,
    "message": "Account created. Institutional accounts require administrator approval before on-chain actions."
  }
}
```

### 1.2 User Login
- **Endpoint:** `POST /api/auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "email": "croma42@retailer.com",
  "password": "SecurePassword123!"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
      "id": 4,
      "name": "Tata Croma Retail #42",
      "email": "croma42@retailer.com",
      "role": "retailer",
      "walletAddress": "0x71c8959da40...a28e",
      "isApprovedByAdmin": 1,
      "onChainRoleAssigned": 1
    }
  }
}
```

### 1.3 Link / Update Wallet Address
- **Endpoint:** `POST /api/auth/link-wallet`
- **Access:** Authenticated (Any Role)
- **Request Body:**
```json
{
  "walletAddress": "0x71c8959da40...a28e",
  "signature": "0xabcdef..."
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Wallet verified and linked successfully"
}
```

---

## 2. Administrator Endpoints

### 2.1 Get Pending Organization Approvals
- **Endpoint:** `GET /api/admin/pending-orgs`
- **Access:** Admin only (`role === 'admin'`)
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 5,
      "name": "Authorized Samsung Care Center",
      "email": "care@samsung-partner.com",
      "role": "service_center",
      "walletAddress": "0x892...11ff",
      "businessRegistrationNumber": "IN-SC-99120",
      "contactPhone": "+919811002233",
      "createdAt": 1732060800
    }
  ]
}
```

### 2.2 Approve Organization & Flag for On-Chain Role
- **Endpoint:** `PATCH /api/admin/approve-org/:userId`
- **Access:** Admin only
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Organization approved off-chain. Admin can now sign role assignment on-chain.",
  "data": {
    "userId": 5,
    "role": "service_center",
    "walletAddress": "0x892...11ff",
    "onChainRoleBytes": "0x7561... (SERVICE_CENTER_ROLE bytes32)"
  }
}
```

---

## 3. Brand & Manufacturer Endpoints

### 3.1 Register Product Model
- **Endpoint:** `POST /api/brand/models`
- **Access:** Brand only (`role === 'brand' && is_approved_by_admin === 1`)
- **Request Body:**
```json
{
  "modelName": "Samsung Galaxy S24 Ultra",
  "modelCode": "SM-S928B",
  "category": "Smartphones",
  "description": "Flagship smartphone with AI features and titanium frame",
  "defaultWarrantyDays": 730,
  "specifications": {
    "storage": "512GB",
    "color": "Titanium Gray",
    "processor": "Snapdragon 8 Gen 3"
  },
  "imageUrl": "https://brand-cdn.com/s24.png"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "modelId": 1,
    "modelCode": "SM-S928B",
    "imageIpfsCid": "QmZtmD2qtQgLzzpkNdFiPbnCj83p8x...",
    "baseMetadataUri": "ipfs://QmZtmD2qtQgLzzpkNdFiPbnCj83p8x..."
  }
}
```

### 3.2 Prepare Single Minting Parameters & Pin Metadata
- **Endpoint:** `POST /api/brand/prepare-mint`
- **Access:** Brand only
- **Request Body:**
```json
{
  "modelId": 1,
  "rawSerialNumber": "SN-S24U-99214-DEL",
  "retailerWallet": "0x71c8959da40...a28e",
  "warrantyDays": 730
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "serialNumberHash": "0x3f5b89a1c... (keccak256)",
    "tokenUri": "ipfs://QmPZ4wK6y42...",
    "retailerWallet": "0x71c8959da40...a28e",
    "warrantyDays": 730,
    "instructions": "Call contract.mintProduct(retailerWallet, serialNumberHash, tokenUri, warrantyDays)"
  }
}
```

### 3.3 Batch CSV Parse & Bulk IPFS Pinning
- **Endpoint:** `POST /api/brand/parse-csv-mint`
- **Access:** Brand only
- **Multipart Form Data:** `file: warranty_units.csv`, `modelId: 1`, `retailerWallet: 0x71c...`
- **Response (200 OK):**
```json
{
  "success": true,
  "totalUnits": 50,
  "data": {
    "retailerWallet": "0x71c8959da40...a28e",
    "serialHashes": ["0x3f5b...", "0x892a..."],
    "tokenUris": ["ipfs://Qm1...", "ipfs://Qm2..."],
    "durations": [730, 730],
    "instructions": "Call contract.batchMintProducts(retailerWallet, serialHashes, tokenUris, durations)"
  }
}
```

---

## 4. Retailer Endpoints

### 4.1 Get Inventory in Custody
- **Endpoint:** `GET /api/retailer/inventory?status=minted`
- **Access:** Retailer only
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "tokenId": 1042,
      "modelName": "Samsung Galaxy S24 Ultra",
      "modelCode": "SM-S928B",
      "category": "Smartphones",
      "warrantyDurationDays": 730,
      "metadataUri": "ipfs://QmPZ4w...",
      "status": "minted"
    }
  ]
}
```

---

## 5. Customer & Claims Endpoints

### 5.1 Get My Products
- **Endpoint:** `GET /api/customer/my-products`
- **Access:** Customer only
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "tokenId": 1042,
      "modelName": "Samsung Galaxy S24 Ultra",
      "imageUrl": "https://gateway.pinata.cloud/ipfs/QmZtm...",
      "status": "active",
      "activationDate": 1737025800,
      "expiryDate": 1800105800,
      "daysRemaining": 421,
      "isStolen": 0,
      "serviceRecordsCount": 1
    }
  ]
}
```

### 5.2 Raise Warranty Claim
- **Endpoint:** `POST /api/claims/raise`
- **Access:** Customer only
- **Request Body:**
```json
{
  "tokenId": 1042,
  "issueTitle": "Display touch unresponsive on right border",
  "issueDescription": "Device suffered touch register drops after latest system update",
  "attachments": ["https://images.com/defect1.jpg"]
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "claimId": 8,
    "status": "pending",
    "message": "Claim ticket created. Please bring device to any authorized service center with your QR code."
  }
}
```

---

## 6. Service Center Endpoints

### 6.1 Upload Repair Report to IPFS
- **Endpoint:** `POST /api/service/upload-report`
- **Access:** Service Center only
- **Request Body:**
```json
{
  "tokenId": 1042,
  "serviceType": "Screen Digitizer Replacement",
  "partsReplaced": ["OLED Panel Assy", "Waterproof Sealant"],
  "technicianNotes": "Replaced original display assembly under warranty coverage. Tested OK."
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "ipfsReportCid": "QmServiceReportHash123...",
    "instructions": "Call contract.recordService(1042, 'Screen Digitizer Replacement', 'QmServiceReportHash123...')"
  }
}
```

---

## 7. Public Verification Endpoint

### 7.1 Verify Product Authenticity & Status
- **Endpoint:** `GET /api/verify/public?tokenId=1042&serial=SN-S24U-99214-DEL`
- **Access:** Public (Anonymous)
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "isAuthentic": true,
    "tokenId": 1042,
    "product": {
      "modelName": "Samsung Galaxy S24 Ultra",
      "modelCode": "SM-S928B",
      "brand": "Samsung Electronics",
      "brandAddress": "0xBrandWallet...",
      "imageUrl": "https://gateway.pinata.cloud/ipfs/QmZtm..."
    },
    "warranty": {
      "status": "active",
      "isActivated": 1,
      "isStolen": 0,
      "activationDate": 1737025800,
      "expiryDate": 1800105800,
      "daysRemaining": 421
    },
    "serviceHistory": [
      {
        "id": 1,
        "timestamp": 1746886800,
        "serviceCenter": "0xCareCenterWallet...",
        "serviceType": "Screen Digitizer Replacement",
        "technicianNotes": "Replaced original display assembly under warranty coverage.",
        "reportUrl": "https://gateway.pinata.cloud/ipfs/QmServiceReportHash123...",
        "txHash": "0x9812...bbce"
      }
    ]
  }
}
```
