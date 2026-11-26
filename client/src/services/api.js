import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getHealth = async () => {
  const res = await api.get("/health");
  return res.data;
};

export const getProducts = async (params = {}) => {
  const res = await api.get("/products", { params });
  return res.data;
};

export const verifyProduct = async (serialOrTokenId) => {
  const res = await api.get(`/products/verify/${encodeURIComponent(serialOrTokenId)}`);
  return res.data;
};

export const createProduct = async (productData) => {
  const res = await api.post("/products", productData);
  return res.data;
};

export const activateProduct = async (tokenId, data) => {
  const res = await api.patch(`/products/${tokenId}/activate`, data);
  return res.data;
};

export const transferProduct = async (tokenId, data) => {
  try {
    const res = await api.patch(`/products/${tokenId}/transfer`, data);
    return res.data;
  } catch (err) {
    // Fallback to /activate if running against an older backend instance without /transfer
    if (err?.response?.status === 404) {
      const res = await api.patch(`/products/${tokenId}/activate`, data);
      return res.data;
    }
    throw err;
  }
};

export const updateTheftStatus = async (tokenId, data) => {
  const res = await api.patch(`/products/${tokenId}/theft`, data);
  return res.data;
};

export const logServiceRecord = async (tokenId, data) => {
  const res = await api.post(`/products/${tokenId}/service`, data);
  return res.data;
};

export const getServiceRecords = async (tokenId) => {
  const res = await api.get(`/products/${tokenId}/service`);
  return res.data;
};

export const getRoles = async (wallet = "") => {
  const res = await api.get("/roles", { params: wallet ? { wallet } : {} });
  return res.data;
};

export const recordRole = async (roleData) => {
  const res = await api.post("/roles", roleData);
  return res.data;
};

export default api;
