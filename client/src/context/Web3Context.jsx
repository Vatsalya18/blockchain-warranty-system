import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { ethers, BrowserProvider, JsonRpcProvider, Contract } from "ethers";
import ProductWarrantyNFT from "../abi/ProductWarrantyNFT.json";

const Web3Context = createContext(null);

export const AMOY_CHAIN_ID_DECIMAL = Number(import.meta.env.VITE_CHAIN_ID || 80002);
export const AMOY_CHAIN_ID_HEX = "0x" + AMOY_CHAIN_ID_DECIMAL.toString(16);

export const DEMO_WALLET_ADDRESS = "0x38995Bbe8e8F34dD9969D7d47b2d0BF43Ce0a6fB";
const DEMO_MODE_STORAGE_KEY = "warrantychain_demo_mode";

// Clean and validate VITE_CONTRACT_ADDRESS from environment
const rawContractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS || "0xf0FD5C464383FA272450D41057554e78506565d3")
  .toString()
  .trim()
  .replace(/^["']|["']$/g, "");

export const CONTRACT_ADDRESS = ethers.isAddress(rawContractAddress)
  ? ethers.getAddress(rawContractAddress)
  : "";

if (!CONTRACT_ADDRESS) {
  console.error(
    `[Web3Context] Invalid VITE_CONTRACT_ADDRESS: "${rawContractAddress}". Ensure it is a valid 42-character Ethereum address.`
  );
}

export const EXPLORER_URL = (import.meta.env.VITE_BLOCK_EXPLORER || "https://amoy.polygonscan.com/").trim().replace(/\/$/, "");
export const RPC_URL = (import.meta.env.VITE_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com").trim();

// Fallback role hashes if contract view functions are unavailable
export const ROLE_HASHES = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
  BRAND_ROLE: ethers.keccak256(ethers.toUtf8Bytes("BRAND_ROLE")),
  RETAILER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("RETAILER_ROLE")),
  SERVICE_CENTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("SERVICE_CENTER_ROLE")),
};

// Gas overrides specifically tuned for Polygon Amoy (Chain ID 80002)
// Explicit gasLimit bypasses eth_estimateGas "missing revert data" failures on public RPCs
export const AMOY_GAS_OVERRIDES = {
  maxPriorityFeePerGas: ethers.parseUnits("35", "gwei"),
  maxFeePerGas: ethers.parseUnits("60", "gwei"),
  gasLimit: 150000n,
};

export const getAmoyGasOverrides = (customGasLimit = 150000n) => ({
  maxPriorityFeePerGas: ethers.parseUnits("35", "gwei"),
  maxFeePerGas: ethers.parseUnits("60", "gwei"),
  gasLimit: BigInt(customGasLimit),
});

/**
 * Generates a valid 66-character hex transaction hash (0x + 64 hex chars)
 */
const generateRandomTxHash = () => {
  const bytes = new Uint8Array(32);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
};

/**
 * Verifies on-chain bytecode exists for a contract address before initiating transactions.
 */
export const verifyContractCode = async (targetAddress, targetProvider) => {
  const cleanAddr = (targetAddress || CONTRACT_ADDRESS || "").toString().trim().replace(/^["']|["']$/g, "");
  if (!cleanAddr || !ethers.isAddress(cleanAddr)) {
    throw new Error(
      `Invalid smart contract address: "${targetAddress}". Check VITE_CONTRACT_ADDRESS in .env.`
    );
  }
  if (!targetProvider) {
    throw new Error("No Web3 provider available to verify contract code.");
  }
  const code = await targetProvider.getCode(cleanAddr);
  if (!code || code === "0x" || code === "0x0") {
    throw new Error(
      `No smart contract bytecode deployed at ${cleanAddr} on this network. ` +
      `Ensure MetaMask is connected to Polygon Amoy (Chain ID 80002) and that the contract is deployed.`
    );
  }
  return true;
};

const contractABI = ProductWarrantyNFT.abi || ProductWarrantyNFT;

export const Web3Provider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [walletAccount, setWalletAccount] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const [walletRoles, setWalletRoles] = useState({
    isAdmin: false,
    isBrand: false,
    isRetailer: false,
    isServiceCenter: false,
  });
  const [rolesLoading, setRolesLoading] = useState(false);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(next));
      } catch (e) {
        console.warn("[Web3Context] Could not persist Demo Mode in localStorage:", e);
      }
      return next;
    });
  }, []);

  /**
   * Simulates a gasless blockchain transaction in Demo Mode:
   * waits 600ms and returns a valid random 66-character hex txHash.
   */
  const simulateTx = useCallback(async (label = "Simulated Transaction") => {
    console.log(`[Demo Mode] Simulating transaction: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const txHash = generateRandomTxHash();
    console.log(`[Demo Mode] Confirmed simulated tx (${label}): ${txHash}`);
    return txHash;
  }, []);

  // Derived active state (switches cleanly between Demo Mode and Live MetaMask)
  const account = isDemoMode ? DEMO_WALLET_ADDRESS : walletAccount;
  const chainId = isDemoMode ? AMOY_CHAIN_ID_DECIMAL : walletChainId;
  const isAmoyNetwork = isDemoMode ? true : walletChainId === AMOY_CHAIN_ID_DECIMAL;
  const roles = useMemo(
    () =>
      isDemoMode
        ? {
            isAdmin: true,
            isBrand: true,
            isRetailer: true,
            isServiceCenter: true,
          }
        : walletRoles,
    [isDemoMode, walletRoles]
  );

  // Static fallback provider for read-only calls
  const fallbackProvider = useMemo(() => {
    try {
      return new JsonRpcProvider(
        RPC_URL,
        {
          chainId: AMOY_CHAIN_ID_DECIMAL,
          name: "polygonAmoy",
        },
        { staticNetwork: true }
      );
    } catch (e) {
      console.warn("[Web3Context] Fallback JsonRpcProvider creation failed:", e);
      return null;
    }
  }, []);

  // Contract instance (uses Signer if connected, otherwise fallbackProvider)
  const contract = useMemo(() => {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === ethers.ZeroAddress) {
      return null;
    }
    try {
      const activeSignerOrProvider = signer || provider || fallbackProvider;
      if (!activeSignerOrProvider) return null;
      return new Contract(CONTRACT_ADDRESS, contractABI, activeSignerOrProvider);
    } catch (err) {
      console.warn("[Web3Context] Contract initialization error:", err);
      return null;
    }
  }, [signer, provider, fallbackProvider]);

  // Check roles for the connected live account using dynamic role getters
  const checkRoles = useCallback(async (targetAccount) => {
    if (!targetAccount || !CONTRACT_ADDRESS || CONTRACT_ADDRESS === ethers.ZeroAddress) {
      setWalletRoles({ isAdmin: false, isBrand: false, isRetailer: false, isServiceCenter: false });
      return;
    }

    try {
      setRolesLoading(true);
      const activeProvider = provider || fallbackProvider;
      if (!activeProvider) return;

      // Verify on-chain contract code exists before querying
      const code = await activeProvider.getCode(CONTRACT_ADDRESS);
      if (!code || code === "0x" || code === "0x0") {
        console.warn(`[Web3Context] No bytecode at ${CONTRACT_ADDRESS} on chain ${walletChainId}.`);
        setWalletRoles({ isAdmin: false, isBrand: false, isRetailer: false, isServiceCenter: false });
        return;
      }

      // Read contract using provider
      const readContract = new Contract(CONTRACT_ADDRESS, contractABI, activeProvider);

      // Read role hashes directly from contract constants if available, else fall back
      const [adminRole, brandRole, retailerRole, serviceRole] = await Promise.all([
        typeof readContract.DEFAULT_ADMIN_ROLE === "function"
          ? readContract.DEFAULT_ADMIN_ROLE().catch(() => ethers.ZeroHash)
          : ethers.ZeroHash,
        typeof readContract.BRAND_ROLE === "function"
          ? readContract.BRAND_ROLE().catch(() => ROLE_HASHES.BRAND_ROLE)
          : ROLE_HASHES.BRAND_ROLE,
        typeof readContract.RETAILER_ROLE === "function"
          ? readContract.RETAILER_ROLE().catch(() => ROLE_HASHES.RETAILER_ROLE)
          : ROLE_HASHES.RETAILER_ROLE,
        typeof readContract.SERVICE_CENTER_ROLE === "function"
          ? readContract.SERVICE_CENTER_ROLE().catch(() => ROLE_HASHES.SERVICE_CENTER_ROLE)
          : ROLE_HASHES.SERVICE_CENTER_ROLE,
      ]);

      const [isAdmin, isBrand, isRetailer, isServiceCenter] = await Promise.all([
        readContract.hasRole(adminRole, targetAccount).catch(() => false),
        readContract.hasRole(brandRole, targetAccount).catch(() => false),
        readContract.hasRole(retailerRole, targetAccount).catch(() => false),
        readContract.hasRole(serviceRole, targetAccount).catch(() => false),
      ]);

      setWalletRoles({ isAdmin, isBrand, isRetailer, isServiceCenter });
    } catch (err) {
      console.warn("[Web3Context] Failed to check on-chain roles:", err.message);
    } finally {
      setRolesLoading(false);
    }
  }, [provider, fallbackProvider, walletChainId]);

  // Refresh roles on demand
  const refreshRoles = useCallback(async () => {
    if (isDemoMode) return;
    if (walletAccount) {
      await checkRoles(walletAccount);
    }
  }, [isDemoMode, walletAccount, checkRoles]);

  // Check initial connected wallet
  const checkConnectedWallet = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      setProvider(browserProvider);

      const accounts = await browserProvider.send("eth_accounts", []);
      const network = await browserProvider.getNetwork();
      const currentChain = Number(network.chainId);
      setWalletChainId(currentChain);

      if (accounts.length > 0) {
        setWalletAccount(accounts[0]);
        const browserSigner = await browserProvider.getSigner();
        setSigner(browserSigner);
        checkRoles(accounts[0]);
      }
    } catch (err) {
      console.warn("[Web3Context] Wallet status check skipped:", err.message);
    }
  }, [checkRoles]);

  useEffect(() => {
    checkConnectedWallet();

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
          setWalletAccount(null);
          setSigner(null);
          setWalletRoles({ isAdmin: false, isBrand: false, isRetailer: false, isServiceCenter: false });
        } else {
          setWalletAccount(accounts[0]);
          if (provider) {
            const browserSigner = await provider.getSigner();
            setSigner(browserSigner);
          }
          checkRoles(accounts[0]);
        }
      };

      const handleChainChanged = (newChainId) => {
        setWalletChainId(parseInt(newChainId, 16));
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [checkConnectedWallet, provider, checkRoles]);

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask or enable Demo Mode.");
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setWalletAccount(accounts[0]);
      const currentChain = Number(network.chainId);
      setWalletChainId(currentChain);
      const browserSigner = await browserProvider.getSigner();
      setSigner(browserSigner);

      if (currentChain !== AMOY_CHAIN_ID_DECIMAL) {
        await switchToAmoy();
      }

      checkRoles(accounts[0]);
      setIsConnecting(false);
      return true;
    } catch (err) {
      console.error("[Web3Context] Wallet connection failed:", err);
      setError(err.message || "Failed to connect wallet.");
      setIsConnecting(false);
      return false;
    }
  };

  // Switch to Polygon Amoy Testnet
  const switchToAmoy = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AMOY_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      // Chain 80002 not added yet in MetaMask (error code 4902)
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: AMOY_CHAIN_ID_HEX,
                chainName: "Polygon Amoy Testnet",
                nativeCurrency: {
                  name: "MATIC",
                  symbol: "MATIC",
                  decimals: 18,
                },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: [EXPLORER_URL],
              },
            ],
          });
        } catch (addError) {
          console.error("[Web3Context] Failed to add Amoy network to MetaMask:", addError);
        }
      }
    }
  };

  const disconnectWallet = () => {
    setWalletAccount(null);
    setSigner(null);
    setWalletRoles({ isAdmin: false, isBrand: false, isRetailer: false, isServiceCenter: false });
  };

  const checkContractBytecode = useCallback(
    async (targetAddr = CONTRACT_ADDRESS) => {
      const activeProvider = provider || fallbackProvider;
      return verifyContractCode(targetAddr, activeProvider);
    },
    [provider, fallbackProvider]
  );

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        isAmoyNetwork,
        isDemoMode,
        toggleDemoMode,
        simulateTx,
        DEMO_WALLET_ADDRESS,
        provider,
        signer,
        contract,
        contractAddress: CONTRACT_ADDRESS,
        explorerUrl: EXPLORER_URL,
        roles,
        rolesLoading,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
        switchToAmoy,
        refreshRoles,
        verifyContractCode: checkContractBytecode,
        ROLE_HASHES,
        AMOY_GAS_OVERRIDES,
        getAmoyGasOverrides,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
};
