import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Settings,
  Shield,
  Sparkles,
  UserCheck,
  UserX,
  Lock,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { getRoles, recordRole } from "../services/api";
import TransactionStatus from "../components/common/TransactionStatus";

export const AdminManager = () => {
  const {
    account,
    contract,
    contractAddress,
    isDemoMode,
    simulateTx,
    roles,
    refreshRoles,
    explorerUrl,
    verifyContractCode,
    ROLE_HASHES,
    AMOY_GAS_OVERRIDES,
  } = useWeb3();

  const [targetAddress, setTargetAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState("BRAND_ROLE");
  const [trackedRoles, setTrackedRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [txState, setTxState] = useState({ status: "idle", txHash: null, error: null });

  useEffect(() => {
    fetchTrackedRoles();
  }, []);

  const fetchTrackedRoles = async () => {
    try {
      setLoadingRoles(true);
      const res = await getRoles();
      setTrackedRoles(res.data || []);
    } catch (e) {
      console.warn("[AdminManager] Failed to load tracked roles:", e);
    } finally {
      setLoadingRoles(false);
    }
  };

  /**
   * Helper to retrieve role hash directly from contract getters
   */
  const getContractRoleHash = async (roleName) => {
    if (!contract) return ROLE_HASHES[roleName];
    try {
      if (roleName === "BRAND_ROLE" && typeof contract.BRAND_ROLE === "function") {
        return await contract.BRAND_ROLE();
      }
      if (roleName === "RETAILER_ROLE" && typeof contract.RETAILER_ROLE === "function") {
        return await contract.RETAILER_ROLE();
      }
      if (roleName === "SERVICE_CENTER_ROLE" && typeof contract.SERVICE_CENTER_ROLE === "function") {
        return await contract.SERVICE_CENTER_ROLE();
      }
      if (roleName === "DEFAULT_ADMIN_ROLE" && typeof contract.DEFAULT_ADMIN_ROLE === "function") {
        return await contract.DEFAULT_ADMIN_ROLE();
      }
    } catch (err) {
      console.warn(`[AdminManager] Failed to read ${roleName} getter from contract, falling back:`, err);
    }
    return ROLE_HASHES[roleName] || ethers.keccak256(ethers.toUtf8Bytes(roleName));
  };

  /**
   * Demo Shortcut: Grants all three roles sequentially to the connected account.
   * - Verifies on-chain contract bytecode before proceeding
   * - Reads role hashes directly from contract getters
   * - Checks hasRole() first and skips already-granted roles
   * - Employs explicit Polygon Amoy gas overrides (priority fee, max fee, gas limit)
   * - Awaits tx.wait() sequentially between role grants
   */
  const handleGrantAllDemoRoles = async () => {
    if (!account || (!isDemoMode && !contract)) {
      setTxState({ status: "error", error: "Please connect your admin wallet first." });
      return;
    }

    setTxState({ status: "pending", txHash: null, error: null });

    try {
      if (isDemoMode) {
        const rolesToGrant = ["BRAND_ROLE", "RETAILER_ROLE", "SERVICE_CENTER_ROLE"];
        let lastTxHash = null;

        for (const roleName of rolesToGrant) {
          const txHash = await simulateTx(`Grant ${roleName} to ${account}`);
          lastTxHash = txHash;
          setTxState({ status: "pending", txHash, error: null });

          await recordRole({
            wallet_address: account,
            role_name: roleName,
            granted_by: account,
            tx_hash: txHash,
          });
        }

        setTxState({ status: "success", txHash: lastTxHash, error: null });
        fetchTrackedRoles();
        return;
      }

      // 1. Verify contract code exists on-chain
      await verifyContractCode(contractAddress);

      // 2. Read role hashes directly from contract view getters
      const [brandHash, retailerHash, serviceHash] = await Promise.all([
        contract.BRAND_ROLE(),
        contract.RETAILER_ROLE(),
        contract.SERVICE_CENTER_ROLE(),
      ]);

      const rolesToProcess = [
        { name: "BRAND_ROLE", hash: brandHash },
        { name: "RETAILER_ROLE", hash: retailerHash },
        { name: "SERVICE_CENTER_ROLE", hash: serviceHash },
      ];

      let newlyGrantedCount = 0;
      let lastTxHash = null;

      for (const item of rolesToProcess) {
        // 3. Check if role is already granted; skip if already present
        const alreadyHasRole = await contract.hasRole(item.hash, account);
        if (alreadyHasRole) {
          console.log(`[AdminManager] Role ${item.name} is already granted to ${account}. Skipping.`);
          continue;
        }

        console.log(`[AdminManager] Granting ${item.name} to ${account} with Amoy gas overrides...`, AMOY_GAS_OVERRIDES);
        
        // 4. Send transaction with explicit Amoy gas overrides
        const tx = await contract.grantRole(item.hash, account, AMOY_GAS_OVERRIDES);
        lastTxHash = tx.hash;
        setTxState({ status: "pending", txHash: tx.hash, error: null });

        // 5. Explicitly wait for confirmation before sending the next transaction
        const receipt = await tx.wait();
        console.log(`[AdminManager] ${item.name} granted in block ${receipt.blockNumber}, tx: ${tx.hash}`);
        newlyGrantedCount++;

        // Sync with SQLite backend
        try {
          await recordRole({
            wallet_address: account,
            role_name: item.name,
            granted_by: account,
            tx_hash: tx.hash,
          });
        } catch (apiErr) {
          console.warn(`[AdminManager] Backend role sync warning for ${item.name}:`, apiErr.message);
        }
      }

      await refreshRoles();
      fetchTrackedRoles();

      if (newlyGrantedCount === 0) {
        setTxState({
          status: "success",
          txHash: null,
          error: null,
        });
        alert("All demo roles (Brand, Retailer, Service Center) are already granted to your wallet!");
      } else {
        setTxState({ status: "success", txHash: lastTxHash, error: null });
      }
    } catch (err) {
      // 6. Log the exact underlying error to console with full diagnostics
      console.error("[AdminManager] Grant all roles failed with details:", {
        message: err?.message,
        code: err?.code,
        reason: err?.reason,
        shortMessage: err?.shortMessage,
        data: err?.data,
        info: err?.info,
        transaction: err?.transaction,
        rawError: err,
      });

      const reason =
        err?.reason ||
        err?.shortMessage ||
        err?.message ||
        "Failed to grant demo roles. Please check network and permissions.";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  /**
   * Manual Role Assignment
   */
  const handleGrantRole = async () => {
    if (!targetAddress || (!isDemoMode && !contract)) return;
    const addr = targetAddress.trim();
    if (!ethers.isAddress(addr)) {
      setTxState({ status: "error", error: "Please enter a valid Ethereum address." });
      return;
    }

    setTxState({ status: "pending", txHash: null, error: null });

    try {
      if (isDemoMode) {
        const txHash = await simulateTx(`Grant ${selectedRole} to ${addr}`);
        setTxState({ status: "pending", txHash, error: null });

        await recordRole({
          wallet_address: addr,
          role_name: selectedRole,
          granted_by: account,
          tx_hash: txHash,
        });

        setTxState({ status: "success", txHash, error: null });
        fetchTrackedRoles();
        setTargetAddress("");
        return;
      }

      // 1. Verify on-chain contract code
      await verifyContractCode(contractAddress);

      // 2. Read role hash directly from contract
      const roleHash = await getContractRoleHash(selectedRole);

      // 3. Check if target account already holds the role
      const alreadyHas = await contract.hasRole(roleHash, addr);
      if (alreadyHas) {
        setTxState({ status: "idle", txHash: null, error: null });
        alert(`Account ${addr} already possesses ${selectedRole}. No transaction needed.`);
        return;
      }

      // 4. Submit with Polygon Amoy gas overrides
      console.log(`[AdminManager] Granting ${selectedRole} to ${addr}...`);
      const tx = await contract.grantRole(roleHash, addr, AMOY_GAS_OVERRIDES);
      setTxState({ status: "pending", txHash: tx.hash, error: null });

      // 5. Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(`[AdminManager] Role granted in block ${receipt.blockNumber}, tx: ${tx.hash}`);

      // Sync with SQLite backend
      try {
        await recordRole({
          wallet_address: addr,
          role_name: selectedRole,
          granted_by: account,
          tx_hash: tx.hash,
        });
      } catch (apiErr) {
        console.warn("[AdminManager] Backend sync note:", apiErr.message);
      }

      await refreshRoles();
      setTxState({ status: "success", txHash: tx.hash, error: null });
      fetchTrackedRoles();
      setTargetAddress("");
    } catch (err) {
      console.error("[AdminManager] Grant role failed with details:", {
        message: err?.message,
        code: err?.code,
        reason: err?.reason,
        shortMessage: err?.shortMessage,
        data: err?.data,
        info: err?.info,
        transaction: err?.transaction,
        rawError: err,
      });

      const reason =
        err?.reason ||
        err?.shortMessage ||
        err?.message ||
        "Grant role transaction failed on Polygon Amoy.";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  /**
   * Manual Role Revocation
   */
  const handleRevokeRole = async () => {
    if (!targetAddress || (!isDemoMode && !contract)) return;
    const addr = targetAddress.trim();
    if (!ethers.isAddress(addr)) {
      setTxState({ status: "error", error: "Please enter a valid Ethereum address." });
      return;
    }

    setTxState({ status: "pending", txHash: null, error: null });

    try {
      if (isDemoMode) {
        const txHash = await simulateTx(`Revoke ${selectedRole} from ${addr}`);
        setTxState({ status: "success", txHash, error: null });
        fetchTrackedRoles();
        setTargetAddress("");
        return;
      }

      // 1. Verify contract code
      await verifyContractCode(contractAddress);

      // 2. Read role hash directly from contract
      const roleHash = await getContractRoleHash(selectedRole);

      // 3. Check if target account currently holds the role
      const hasRole = await contract.hasRole(roleHash, addr);
      if (!hasRole) {
        setTxState({ status: "idle", txHash: null, error: null });
        alert(`Account ${addr} does not possess ${selectedRole}. No revocation needed.`);
        return;
      }

      // 4. Submit with Polygon Amoy gas overrides
      console.log(`[AdminManager] Revoking ${selectedRole} from ${addr}...`);
      const tx = await contract.revokeRole(roleHash, addr, AMOY_GAS_OVERRIDES);
      setTxState({ status: "pending", txHash: tx.hash, error: null });

      // 5. Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(`[AdminManager] Role revoked in block ${receipt.blockNumber}, tx: ${tx.hash}`);

      await refreshRoles();
      setTxState({ status: "success", txHash: tx.hash, error: null });
      fetchTrackedRoles();
      setTargetAddress("");
    } catch (err) {
      console.error("[AdminManager] Revoke role failed with details:", {
        message: err?.message,
        code: err?.code,
        reason: err?.reason,
        shortMessage: err?.shortMessage,
        data: err?.data,
        info: err?.info,
        transaction: err?.transaction,
        rawError: err,
      });

      const reason =
        err?.reason ||
        err?.shortMessage ||
        err?.message ||
        "Revoke role transaction failed on Polygon Amoy.";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  const isAdmin = roles.isAdmin;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 w-fit">
          <Settings className="w-3.5 h-3.5 text-amber-600" />
          <span>Platform Administration</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
          On-Chain Role & Permission Manager
        </h1>
        <p className="text-sm text-slate-500">
          Manage institutional access controls (`BRAND_ROLE`, `RETAILER_ROLE`, `SERVICE_CENTER_ROLE`) backed by OpenZeppelin `AccessControl`.
        </p>
      </div>

      {/* Permission Warning */}
      {!isAdmin && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-amber-900">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Connected wallet ({account ? `${account.substring(0, 8)}...` : "None"}) does not hold <strong>DEFAULT_ADMIN_ROLE</strong> on the deployed contract ({contractAddress ? `${contractAddress.substring(0, 8)}...` : "None"}).
            </span>
          </div>
        </div>
      )}

      {/* Quick Demo Single-Wallet Helper */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-purple-50 rounded-3xl p-6 border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D7E6B]">
            <Sparkles className="w-4 h-4" />
            <span>Examiner & Viva Demo Shortcut</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            Grant All Demo Roles to My Connected Wallet
          </h3>
          <p className="text-xs text-slate-500 max-w-lg mt-0.5">
            Instantly assigns `BRAND_ROLE`, `RETAILER_ROLE`, and `SERVICE_CENTER_ROLE` to your active MetaMask account with Polygon Amoy gas tuning so you can test all portals from a single wallet.
          </p>
        </div>

        <button
          onClick={handleGrantAllDemoRoles}
          disabled={!isAdmin || txState.status === "pending"}
          className="px-5 py-3 rounded-2xl bg-[#0D7E6B] hover:bg-[#0B6858] disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all shrink-0 flex items-center gap-2"
        >
          <UserCheck className="w-4 h-4" />
          <span>Grant All Roles to Me</span>
        </button>
      </div>

      {/* Manual Role Assignment Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-5">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Assign / Revoke Role
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Wallet Address *
              </label>
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="0x... Target Ethereum Address"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role *</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
              >
                <option value="BRAND_ROLE">BRAND_ROLE (Can Mint NFTs)</option>
                <option value="RETAILER_ROLE">RETAILER_ROLE (Can Activate & Sell)</option>
                <option value="SERVICE_CENTER_ROLE">SERVICE_CENTER_ROLE (Can Log Repairs)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleGrantRole}
                disabled={!isAdmin || txState.status === "pending"}
                className="flex-1 py-2.5 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Grant Role</span>
              </button>

              <button
                type="button"
                onClick={handleRevokeRole}
                disabled={!isAdmin || txState.status === "pending"}
                className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-semibold border border-rose-200 transition-all flex items-center justify-center gap-1.5"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Revoke</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tracked Roles List */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Tracked System Roles</h3>
              <button
                onClick={fetchTrackedRoles}
                className="text-xs text-[#0D7E6B] font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>

            {loadingRoles ? (
              <div className="text-center py-8 text-xs text-slate-400">Loading roles...</div>
            ) : trackedRoles.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl p-4">
                No roles tracked in SQLite yet. Grant a role to populate.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {trackedRoles.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono text-[11px] truncate max-w-[200px]">
                        {r.wallet_address}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Granted: {r.created_at || "Recent"}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                      {r.role_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      <TransactionStatus
        status={txState.status}
        txHash={txState.txHash}
        error={txState.error}
        explorerUrl={explorerUrl}
        onClose={() => setTxState({ status: "idle", txHash: null, error: null })}
      />
    </div>
  );
};

export default AdminManager;
