// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ProductWarrantyNFT
 * @author Vatsalya Singh, Piyush Panwar, Bhumi Varshney
 * @notice Production smart contract for Blockchain-Based Digital Warranty and Product Ownership System
 * @dev Deployed on Polygon Amoy Testnet (Chain ID: 80002)
 */
contract ProductWarrantyNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");
    bytes32 public constant SERVICE_CENTER_ROLE = keccak256("SERVICE_CENTER_ROLE");

    uint256 private _nextTokenId;

    struct WarrantyDetails {
        bytes32 serialNumberHash; // keccak256(serialNumber)
        uint64 activationDate;    // Unix timestamp at point of sale (0 if unactivated)
        uint32 durationDays;      // Warranty duration in days
        bool isActivated;         // True after point of sale
        bool isStolen;            // True if owner flagged product as stolen
    }

    struct ServiceRecord {
        uint64 timestamp;         // Unix timestamp when repair was logged
        address serviceCenter;    // Authorized service center address
        string serviceType;       // e.g., "Screen Replacement", "Battery Swap"
        string ipfsReportCid;     // IPFS CID of diagnostic notes/invoice
    }

    // Mapping from tokenId => WarrantyDetails
    mapping(uint256 => WarrantyDetails) public warranties;

    // Mapping from tokenId => array of ServiceRecord
    mapping(uint256 => ServiceRecord[]) internal _serviceHistories;

    // Mapping from serialNumberHash => tokenId (0 if not registered)
    mapping(bytes32 => uint256) public serialToTokenId;

    // Events
    event ProductMinted(uint256 indexed tokenId, address indexed retailer, bytes32 indexed serialHash);
    event WarrantyActivated(uint256 indexed tokenId, address indexed customer, uint64 activationDate, uint32 durationDays);
    event TheftStatusChanged(uint256 indexed tokenId, bool isStolen);
    event ServiceRecorded(uint256 indexed tokenId, address indexed serviceCenter, string serviceType, string ipfsReportCid, uint64 timestamp);

    /**
     * @notice Constructor initializes the contract and grants DEFAULT_ADMIN_ROLE to deployer.
     * @param defaultAdmin Address to receive the administrator role.
     */
    constructor(address defaultAdmin) ERC721("BlockchainWarrantyNFT", "BWNFT") {
        require(defaultAdmin != address(0), "WarrantyNFT: Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Mints an unactivated product warranty NFT directly into an authorized retailer's wallet.
     * @param retailer Destination retailer address holding custody before sale.
     * @param serialHash keccak256 hash of the physical product serial number.
     * @param tokenURI IPFS URI containing product metadata JSON.
     * @param durationDays Total warranty validity in days upon future activation.
     */
    function mintProduct(
        address retailer,
        bytes32 serialHash,
        string calldata tokenURI,
        uint32 durationDays
    ) external onlyRole(BRAND_ROLE) returns (uint256) {
        require(retailer != address(0), "WarrantyNFT: Invalid retailer address");
        require(serialHash != bytes32(0), "WarrantyNFT: Invalid serial hash");
        require(serialToTokenId[serialHash] == 0, "WarrantyNFT: Serial number already registered");
        require(durationDays > 0, "WarrantyNFT: Duration must be greater than 0");

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        _safeMint(retailer, tokenId);
        _setTokenURI(tokenId, tokenURI);

        warranties[tokenId] = WarrantyDetails({
            serialNumberHash: serialHash,
            activationDate: 0,
            durationDays: durationDays,
            isActivated: false,
            isStolen: false
        });

        serialToTokenId[serialHash] = tokenId;

        emit ProductMinted(tokenId, retailer, serialHash);
        return tokenId;
    }

    /**
     * @notice Batch mints multiple product warranty NFTs into a retailer's wallet.
     * @param retailer Destination retailer wallet address.
     * @param serialHashes Array of keccak256 hashes of physical serial numbers.
     * @param tokenURIs Array of IPFS metadata URIs.
     * @param durations Array of warranty durations in days.
     */
    function batchMintProducts(
        address retailer,
        bytes32[] calldata serialHashes,
        string[] calldata tokenURIs,
        uint32[] calldata durations
    ) external onlyRole(BRAND_ROLE) returns (uint256[] memory) {
        require(retailer != address(0), "WarrantyNFT: Invalid retailer address");
        uint256 length = serialHashes.length;
        require(length > 0, "WarrantyNFT: Empty arrays provided");
        require(length == tokenURIs.length && length == durations.length, "WarrantyNFT: Array length mismatch");
        require(length <= 100, "WarrantyNFT: Batch size exceeds limit of 100");

        uint256[] memory tokenIds = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            bytes32 sHash = serialHashes[i];
            require(sHash != bytes32(0), "WarrantyNFT: Invalid serial hash");
            require(serialToTokenId[sHash] == 0, "WarrantyNFT: Serial number already registered");
            require(durations[i] > 0, "WarrantyNFT: Duration must be greater than 0");

            _nextTokenId++;
            uint256 tokenId = _nextTokenId;

            _safeMint(retailer, tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);

            warranties[tokenId] = WarrantyDetails({
                serialNumberHash: sHash,
                activationDate: 0,
                durationDays: durations[i],
                isActivated: false,
                isStolen: false
            });

            serialToTokenId[sHash] = tokenId;
            tokenIds[i] = tokenId;

            emit ProductMinted(tokenId, retailer, sHash);
        }

        return tokenIds;
    }

    /**
     * @notice Activates product warranty at point-of-sale and transfers ownership to the consumer.
     * @dev Callable only by accounts holding RETAILER_ROLE who currently hold custody of the token.
     * @param tokenId ERC-721 token identifier.
     * @param customer Customer's Polygon wallet address.
     */
    function activateAndSell(uint256 tokenId, address customer) external onlyRole(RETAILER_ROLE) {
        require(customer != address(0), "WarrantyNFT: Invalid customer address");
        require(ownerOf(tokenId) == msg.sender, "WarrantyNFT: Caller does not own this token");

        WarrantyDetails storage warranty = warranties[tokenId];
        require(!warranty.isActivated, "WarrantyNFT: Warranty already activated");
        require(!warranty.isStolen, "WarrantyNFT: Token flagged stolen");

        warranty.activationDate = uint64(block.timestamp);
        warranty.isActivated = true;

        _transfer(msg.sender, customer, tokenId);

        emit WarrantyActivated(tokenId, customer, warranty.activationDate, warranty.durationDays);
    }

    /**
     * @notice Allows current token owner to report a physical product as stolen, locking all transfers.
     * @param tokenId ERC-721 token identifier.
     */
    function reportStolen(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "WarrantyNFT: Caller is not the owner");
        require(!warranties[tokenId].isStolen, "WarrantyNFT: Already flagged as stolen");

        warranties[tokenId].isStolen = true;
        emit TheftStatusChanged(tokenId, true);
    }

    /**
     * @notice Allows current token owner to clear the stolen status upon physical item recovery.
     * @param tokenId ERC-721 token identifier.
     */
    function recoverStolen(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "WarrantyNFT: Caller is not the owner");
        require(warranties[tokenId].isStolen, "WarrantyNFT: Not flagged as stolen");

        warranties[tokenId].isStolen = false;
        emit TheftStatusChanged(tokenId, false);
    }

    /**
     * @notice Records an immutable service or repair log on-chain.
     * @dev Callable only by authorized service centers.
     * @param tokenId ERC-721 token identifier.
     * @param serviceType Description of service (e.g. "Screen Replacement", "Firmware Flash").
     * @param ipfsReportCid IPFS CID pointing to detailed technician report/invoice.
     */
    function recordService(
        uint256 tokenId,
        string calldata serviceType,
        string calldata ipfsReportCid
    ) external onlyRole(SERVICE_CENTER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "WarrantyNFT: Nonexistent token");
        require(!warranties[tokenId].isStolen, "WarrantyNFT: Cannot service a stolen product");
        require(bytes(serviceType).length > 0, "WarrantyNFT: Empty service type");
        require(bytes(ipfsReportCid).length > 0, "WarrantyNFT: Empty IPFS report CID");

        uint64 currentTimestamp = uint64(block.timestamp);

        _serviceHistories[tokenId].push(ServiceRecord({
            timestamp: currentTimestamp,
            serviceCenter: msg.sender,
            serviceType: serviceType,
            ipfsReportCid: ipfsReportCid
        }));

        emit ServiceRecorded(tokenId, msg.sender, serviceType, ipfsReportCid, currentTimestamp);
    }

    /**
     * @notice Dynamically calculates whether a warranty is currently active, unexpired, and not stolen.
     * @param tokenId ERC-721 token identifier.
     */
    function isWarrantyValid(uint256 tokenId) public view returns (bool) {
        WarrantyDetails memory w = warranties[tokenId];
        if (!w.isActivated || w.isStolen) {
            return false;
        }
        uint256 expiryTimestamp = uint256(w.activationDate) + (uint256(w.durationDays) * 1 days);
        return block.timestamp <= expiryTimestamp;
    }

    /**
     * @notice Computes exact unix timestamp at which the warranty expires.
     * @param tokenId ERC-721 token identifier.
     */
    function getExpiryTimestamp(uint256 tokenId) public view returns (uint64) {
        WarrantyDetails memory w = warranties[tokenId];
        if (!w.isActivated) {
            return 0;
        }
        return uint64(uint256(w.activationDate) + (uint256(w.durationDays) * 1 days));
    }

    /**
     * @notice Retrieves full warranty struct details for a given token.
     * @param tokenId ERC-721 token identifier.
     */
    function getWarrantyInfo(uint256 tokenId) external view returns (WarrantyDetails memory) {
        require(_ownerOf(tokenId) != address(0), "WarrantyNFT: Nonexistent token");
        return warranties[tokenId];
    }

    /**
     * @notice Retrieves the entire chronological service history for a token.
     * @param tokenId ERC-721 token identifier.
     */
    function getServiceHistory(uint256 tokenId) external view returns (ServiceRecord[] memory) {
        require(_ownerOf(tokenId) != address(0), "WarrantyNFT: Nonexistent token");
        return _serviceHistories[tokenId];
    }

    /**
     * @notice Public verification helper to check product validity and history by raw serial number hash.
     * @param serialHash keccak256 hash of product serial number.
     */
    function verifyProductBySerial(bytes32 serialHash) external view returns (
        uint256 tokenId,
        bool exists,
        address currentOwner,
        bool isActivated,
        bool isValid,
        bool isStolen,
        uint64 activationDate,
        uint32 durationDays,
        uint64 expiryTimestamp,
        uint256 serviceCount
    ) {
        tokenId = serialToTokenId[serialHash];
        if (tokenId == 0) {
            return (0, false, address(0), false, false, false, 0, 0, 0, 0);
        }
        exists = true;
        currentOwner = ownerOf(tokenId);
        WarrantyDetails memory w = warranties[tokenId];
        isActivated = w.isActivated;
        isValid = isWarrantyValid(tokenId);
        isStolen = w.isStolen;
        activationDate = w.activationDate;
        durationDays = w.durationDays;
        expiryTimestamp = getExpiryTimestamp(tokenId);
        serviceCount = _serviceHistories[tokenId].length;
    }

    /**
     * @notice Public verification helper to inspect warranty state by Token ID.
     * @param tokenId ERC-721 token identifier.
     */
    function verifyProductByTokenId(uint256 tokenId) external view returns (
        bytes32 serialNumberHash,
        address currentOwner,
        bool isActivated,
        bool isValid,
        bool isStolen,
        uint64 activationDate,
        uint32 durationDays,
        uint64 expiryTimestamp,
        uint256 serviceCount
    ) {
        require(_ownerOf(tokenId) != address(0), "WarrantyNFT: Nonexistent token");
        currentOwner = ownerOf(tokenId);
        WarrantyDetails memory w = warranties[tokenId];
        serialNumberHash = w.serialNumberHash;
        isActivated = w.isActivated;
        isValid = isWarrantyValid(tokenId);
        isStolen = w.isStolen;
        activationDate = w.activationDate;
        durationDays = w.durationDays;
        expiryTimestamp = getExpiryTimestamp(tokenId);
        serviceCount = _serviceHistories[tokenId].length;
    }

    /**
     * @notice Total number of warranty NFTs minted to date.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Overrides OpenZeppelin ERC721 v5 internal transfer hook.
     * Enforces the anti-theft lock: halts all token transfers if the product is flagged stolen.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            require(!warranties[tokenId].isStolen, "WarrantyNFT: Token flagged stolen. Transfers are blocked.");
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Overrides required by Solidity for multiple inheritance.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
