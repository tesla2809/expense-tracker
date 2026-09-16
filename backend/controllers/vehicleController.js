import fs from "fs";
import path from "path";
import {
  listVehiclesByUser,
  createVehicle,
  updateVehicleById,
  deleteVehicleById,
} from "../models/vehicleStore.js";
import { UPLOADS_DIR } from "../middleware/uploadMiddleware.js";

// multer's .fields() puts uploads in req.files as { fieldName: [file] } —
// this pulls out the stored path for one optional field, or undefined if
// nothing was uploaded under that name.
const docFilePath = (req, field) => {
  const file = req.files?.[field]?.[0];
  return file ? `/uploads/${file.filename}` : undefined;
};

const deleteFileIfAny = (relativePath) => {
  if (!relativePath) return;
  fs.unlink(path.join(UPLOADS_DIR, path.basename(relativePath)), () => {});
};

export const getVehicles = async (req, res) => {
  try {
    const vehicles = await listVehiclesByUser(req.user.id);
    res.json(vehicles);
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).json({ message: error.message || "Error fetching vehicles" });
  }
};

export const addVehicle = async (req, res) => {
  const { name, numberPlate, rcExpiry, insuranceExpiry, permitExpiry } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Vehicle name is required" });
  }
  try {
    const vehicle = await createVehicle({
      userId: req.user.id,
      name: name.trim(),
      numberPlate,
      rcExpiry,
      insuranceExpiry,
      permitExpiry,
      rcFile: docFilePath(req, "rcFile"),
      insuranceFile: docFilePath(req, "insuranceFile"),
      permitFile: docFilePath(req, "permitFile"),
    });
    res.status(201).json(vehicle);
  } catch (error) {
    console.error("Error adding vehicle:", error);
    res.status(500).json({ message: error.message || "Error adding vehicle" });
  }
};

export const updateVehicle = async (req, res) => {
  const { name, numberPlate, rcExpiry, insuranceExpiry, permitExpiry } = req.body;
  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (numberPlate !== undefined) updates.numberPlate = numberPlate;
    if (rcExpiry !== undefined) updates.rcExpiry = rcExpiry;
    if (insuranceExpiry !== undefined) updates.insuranceExpiry = insuranceExpiry;
    if (permitExpiry !== undefined) updates.permitExpiry = permitExpiry;

    // Look up the current vehicle first so we can clean up any doc files
    // that are about to be replaced.
    const existing = (await listVehiclesByUser(req.user.id)).find((v) => v._id === req.params.id);

    for (const field of ["rcFile", "insuranceFile", "permitFile"]) {
      const newPath = docFilePath(req, field);
      if (newPath) {
        if (existing?.[field]) deleteFileIfAny(existing[field]);
        updates[field] = newPath;
      }
    }

    const { vehicle, error } = await updateVehicleById(req.params.id, req.user.id, updates);
    if (error === "not_found") return res.status(404).json({ message: "Vehicle not found" });
    if (error === "forbidden") return res.status(403).json({ message: "Not authorized to update this vehicle" });
    res.json(vehicle);
  } catch (error) {
    console.error("Error updating vehicle:", error);
    res.status(500).json({ message: error.message || "Error updating vehicle" });
  }
};

export const deleteVehicle = async (req, res) => {
  try {
    const { vehicle: deleted, error } = await deleteVehicleById(req.params.id, req.user.id);
    if (error === "not_found") return res.status(404).json({ message: "Vehicle not found" });
    if (error === "forbidden") return res.status(403).json({ message: "Not authorized to delete this vehicle" });

    deleteFileIfAny(deleted?.rcFile);
    deleteFileIfAny(deleted?.insuranceFile);
    deleteFileIfAny(deleted?.permitFile);

    res.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    res.status(500).json({ message: error.message || "Error deleting vehicle" });
  }
};
