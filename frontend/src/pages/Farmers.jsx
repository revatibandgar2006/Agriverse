
import { useEffect, useRef, useState } from "react";
import {
  getFarmers,
  createFarmer,
  updateFarmer,
  deleteFarmer,
} from "../services/api";

export default function Farmers() {
  const [farmers, setFarmers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    location: "",
    farm_size: "",
    crop: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const formSectionRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    loadFarmers();
  }, []);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setSelectedFarmer(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  async function loadFarmers() {
    setLoading(true);
    setError("");

    try {
      const response = await getFarmers();
      const data = Array.isArray(response)
        ? response
        : response?.farmers;

      setFarmers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load farmers. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetForm() {
    setForm({
      name: "",
      phone: "",
      location: "",
      farm_size: "",
      crop: "",
    });
    setEditingId(null);
  }

  function handleAddFarmerClick() {
    resetForm();
    setError("");
    setMessage("");

    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 350);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.location.trim() ||
      !form.farm_size.trim() ||
      !form.crop.trim()
    ) {
      setError("Please fill in all fields.");
      return;
    }

    const farmSizeNumber = Number(form.farm_size);

    if (!Number.isFinite(farmSizeNumber) || farmSizeNumber <= 0) {
      setError("Farm size must be a positive number.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      farm_size: String(form.farm_size).trim(),
      crop: form.crop.trim(),
    };

    setSaving(true);

    try {
      if (editingId !== null) {
        await updateFarmer(editingId, payload);
        setMessage("Farmer updated successfully.");
      } else {
        await createFarmer(payload);
        setMessage("Farmer added successfully.");
      }

      resetForm();
      await loadFarmers();
    } catch (err) {
      const detail = err?.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : detail
            ? JSON.stringify(detail)
            : err?.message || "Unable to save farmer details."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(farmer) {
    setSelectedFarmer(null);
    setEditingId(farmer.id);

    setForm({
      name: farmer.name ?? "",
      phone: farmer.phone ?? "",
      location: farmer.location ?? "",
      farm_size: String(farmer.farm_size ?? ""),
      crop: farmer.crop ?? "",
    });

    setError("");
    setMessage("");

    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 350);
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this farmer?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await deleteFarmer(id);

      if (editingId === id) {
        resetForm();
      }

      setSelectedFarmer(null);
      setMessage("Farmer deleted successfully.");
      await loadFarmers();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Unable to delete farmer."
      );
    }
  }

  const searchText = search.trim().toLowerCase();

  const filteredFarmers = farmers.filter((farmer) =>
    [
      farmer.name,
      farmer.phone,
      farmer.location,
      farmer.farm_size,
      farmer.crop,
    ].some((value) =>
      String(value ?? "").toLowerCase().includes(searchText)
    )
  );

  return (
    <main className="page-content farmers-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FARM MANAGEMENT</p>
          <h1>Farmer Management</h1>
          <p className="subtitle">
            Manage farmer details in your AgriVerse system.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={loadFarmers}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleAddFarmerClick}
          >
            + Add Farmer
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="success-message" role="status">
          {message}
        </div>
      )}

      <section
        className="content-card farmer-form-card"
        ref={formSectionRef}
      >
        <div className="section-heading">
          <div>
            <h2>
              {editingId !== null ? "Edit Farmer" : "Add New Farmer"}
            </h2>
            <p>Enter the farmer's information below.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="farmer-form">
          <div className="form-field">
            <label htmlFor="name">Farmer Name</label>
            <input
              ref={nameInputRef}
              id="name"
              name="name"
              type="text"
              placeholder="Enter farmer name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Enter phone number"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="Enter village or city"
              value={form.location}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="farm_size">Farm Size</label>
            <input
              id="farm_size"
              name="farm_size"
              type="number"
              min="0.01"
              step="any"
              placeholder="Enter farm size"
              value={form.farm_size}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="crop">Crop</label>
            <input
              id="crop"
              name="crop"
              type="text"
              placeholder="e.g. Sugarcane, Wheat, Rice"
              value={form.crop}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Update Farmer"
                  : "Add Farmer"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="content-card farmer-list-card">
        <div className="section-heading list-header">
          <div>
            <h2>Farmers List</h2>
            <p>Your saved farmer records.</p>
          </div>

          <input
            type="search"
            className="search-input"
            placeholder="Search by name, crop, or location..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search farmers by name, crop, phone, location, or farm size"
          />
        </div>

        {loading ? (
          <p>Loading farmers...</p>
        ) : filteredFarmers.length === 0 ? (
          <div className="empty-state">
            <span>🌱</span>
            <h3>
              {farmers.length === 0
                ? "No farmer records yet"
                : "No matching farmers"}
            </h3>
            <p>
              {farmers.length === 0
                ? "Add your first farmer using the form above."
                : "Try searching with another name, crop, or location."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Farm Size</th>
                  <th>Crop</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredFarmers.map((farmer) => (
                  <tr key={farmer.id}>
                    <td>{farmer.id}</td>
                    <td>{farmer.name}</td>
                    <td>{farmer.phone}</td>
                    <td>{farmer.location}</td>
                    <td>{farmer.farm_size}</td>
                    <td>
                      <span className="crop-tag">{farmer.crop}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="view-button"
                          onClick={() => setSelectedFarmer(farmer)}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleEdit(farmer)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(farmer.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="profile-description">
          Total farmers displayed: {filteredFarmers.length}
        </p>
      </section>

      {selectedFarmer && (
        <div
          className="farmer-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedFarmer(null);
            }
          }}
        >
          <section
            className="farmer-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="farmer-modal-title"
          >
            <div className="farmer-modal-header">
              <div>
                <p className="eyebrow">FARMER PROFILE</p>
                <h2 id="farmer-modal-title">
                  {selectedFarmer.name || "Farmer Details"}
                </h2>
                <p>Complete information for this farmer.</p>
              </div>

              <button
                type="button"
                className="farmer-modal-close"
                aria-label="Close farmer details"
                onClick={() => setSelectedFarmer(null)}
              >
                ×
              </button>
            </div>

            <div className="farmer-profile-icon" aria-hidden="true">
              {String(selectedFarmer.name || "F")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="farmer-details-grid">
              <div className="farmer-detail-item">
                <span>Farmer ID</span>
                <strong>{selectedFarmer.id ?? "Not available"}</strong>
              </div>

              <div className="farmer-detail-item">
                <span>Full Name</span>
                <strong>{selectedFarmer.name || "Not available"}</strong>
              </div>

              <div className="farmer-detail-item">
                <span>Phone Number</span>
                <strong>{selectedFarmer.phone || "Not available"}</strong>
              </div>

              <div className="farmer-detail-item">
                <span>Location</span>
                <strong>{selectedFarmer.location || "Not available"}</strong>
              </div>

              <div className="farmer-detail-item">
                <span>Farm Size</span>
                <strong>
                  {selectedFarmer.farm_size != null &&
                  String(selectedFarmer.farm_size).trim() !== ""
                    ? String(selectedFarmer.farm_size)
                    : "Not available"}
                </strong>
              </div>

              <div className="farmer-detail-item">
                <span>Primary Crop</span>
                <strong>{selectedFarmer.crop || "Not available"}</strong>
              </div>
            </div>

            <div className="farmer-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedFarmer(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => handleEdit(selectedFarmer)}
              >
                Edit Farmer
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
