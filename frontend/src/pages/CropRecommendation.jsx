
import { useState } from "react";
import { getCropRecommendation } from "../services/api";

const initialForm = {
  nitrogen: "80",
  phosphorus: "45",
  potassium: "40",
  temperature: "28",
  humidity: "75",
  ph: "6.5",
  rainfall: "180",
  soil_type: "loamy",
  season: "kharif",
};

const fields = [
  { name: "nitrogen", label: "Nitrogen (N)", min: 0, max: 200, step: 1 },
  { name: "phosphorus", label: "Phosphorus (P)", min: 0, max: 200, step: 1 },
  { name: "potassium", label: "Potassium (K)", min: 0, max: 250, step: 1 },
  { name: "temperature", label: "Temperature (°C)", min: 0, max: 60, step: 0.1 },
  { name: "humidity", label: "Humidity (%)", min: 0, max: 100, step: 0.1 },
  { name: "ph", label: "Soil pH", min: 0, max: 14, step: 0.1 },
  { name: "rainfall", label: "Rainfall (mm)", min: 0, max: 5000, step: 0.1 },
];

const factorLabels = {
  temperature: "Temperature",
  humidity: "Humidity",
  ph: "Soil pH",
  rainfall: "Rainfall",
};

export default function CropRecommendation() {
  const [form, setForm] = useState(initialForm);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResults(null);
    setLoading(true);

    try {
      const payload = {
        ...form,
        nitrogen: Number(form.nitrogen),
        phosphorus: Number(form.phosphorus),
        potassium: Number(form.potassium),
        temperature: Number(form.temperature),
        humidity: Number(form.humidity),
        ph: Number(form.ph),
        rainfall: Number(form.rainfall),
      };

      const data = await getCropRecommendation(payload);
      setResults(data);
    } catch (err) {
      setError(err.message || "Unable to get crop recommendations.");
    } finally {
      setLoading(false);
    }
  }

  function getRecommendations(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.recommendations)) {
      return data.recommendations;
    }
    if (Array.isArray(data?.crops)) return data.crops;
    if (data?.crop) return [data];
    return [];
  }

  const recommendations = results ? getRecommendations(results) : [];

  return (
    <div className="crop-recommendation-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SMART FARMING</p>
          <h1>Crop Recommendation</h1>
          <p className="subtitle">
            Enter your soil and weather conditions to get crop suggestions.
          </p>
        </div>
      </div>

      <section className="content-card crop-form-card">
        <h2>Soil and Climate Details</h2>
        <p>Enter the latest available values for your farm.</p>

        <form onSubmit={handleSubmit} className="crop-form">
          {fields.map((field) => (
            <div className="crop-form-field" key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              <input
                id={field.name}
                name={field.name}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={form[field.name]}
                onChange={handleChange}
                required
              />
            </div>
          ))}

          <div className="crop-form-field">
            <label htmlFor="soil_type">Soil Type</label>
            <select
              id="soil_type"
              name="soil_type"
              value={form.soil_type}
              onChange={handleChange}
              required
            >
              <option value="loamy">Loamy</option>
              <option value="clay">Clay</option>
              <option value="sandy">Sandy</option>
              <option value="silty">Silty</option>
              <option value="black">Black soil</option>
              <option value="red">Red soil</option>
              <option value="alluvial">Alluvial</option>
            </select>
          </div>

          <div className="crop-form-field">
            <label htmlFor="season">Season</label>
            <select
              id="season"
              name="season"
              value={form.season}
              onChange={handleChange}
              required
            >
              <option value="kharif">Kharif (Monsoon)</option>
              <option value="rabi">Rabi (Winter)</option>
              <option value="zaid">Zaid (Summer)</option>
            </select>
          </div>

          {error && (
            <div className="error-message crop-form-message" role="alert">
              {error}
            </div>
          )}

          <div className="crop-form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? "Finding suitable crops..." : "Get Recommendations"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setForm(initialForm);
                setResults(null);
                setError("");
              }}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {results && (
        <section className="content-card crop-results">
          <h2>Recommended Crops</h2>

          {results.message && (
            <p className="crop-api-message">{results.message}</p>
          )}

          {recommendations.length > 0 ? (
            <div className="crop-results-grid">
              {recommendations.map((item, index) => {
                const cropName =
                  item.crop || item.crop_name || item.name || `Crop ${index + 1}`;

                const score =
                  item.suitability_percent ??
                  item.suitability_score ??
                  item.match_percentage ??
                  item.score;

                const factorScores = item.factor_scores || {};

                return (
                  <article
                    className="crop-result-card"
                    key={`${cropName}-${index}`}
                  >
                    <span className="crop-result-icon" aria-hidden="true">
                      🌱
                    </span>

                    <h3>{cropName}</h3>

                    {score !== undefined && (
                      <div className="crop-suitability">
                        <div className="crop-suitability-heading">
                          <strong>Suitability score</strong>
                          <strong>{score}%</strong>
                        </div>

                        <div
                          className="crop-progress-track"
                          role="progressbar"
                          aria-label={`${cropName} suitability score`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.max(
                            0,
                            Math.min(100, Number(score) || 0)
                          )}
                        >
                          <div
                            className="crop-progress-fill"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, Number(score) || 0)
                              )}%`,
                            }}
                          />
                        </div>

                        {item.suitability_label && (
                          <p className="crop-suitability-label">
                            {item.suitability_label}
                          </p>
                        )}
                      </div>
                    )}

                    {item.description && (
                      <div className="crop-detail-section">
                        <h4>About this crop</h4>
                        <p>{item.description}</p>
                      </div>
                    )}

                    {(item.growing_season || item.season) && (
                      <div className="crop-detail-section">
                        <h4>Growing season</h4>
                        <p>{item.growing_season || item.season}</p>
                      </div>
                    )}

                    {item.explanation && (
                      <div className="crop-detail-section">
                        <h4>Why this crop?</h4>
                        <p>{item.explanation}</p>
                      </div>
                    )}

                    {item.cultivation_guidance && (
                      <div className="crop-detail-section">
                        <h4>Cultivation guidance</h4>
                        <p>{item.cultivation_guidance}</p>
                      </div>
                    )}

                    {Object.keys(factorScores).length > 0 && (
                      <div className="crop-detail-section">
                        <h4>Condition match</h4>

                        <div className="crop-factor-list">
                          {Object.entries(factorScores).map(
                            ([factor, value]) => (
                              <div
                                className="crop-factor-row"
                                key={factor}
                              >
                                <span>
                                  {factorLabels[factor] || factor}
                                </span>
                                <strong>{value}%</strong>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>
              {results.message ||
                "No recommendations were returned. Check your inputs and try again."}
            </p>
          )}

          <p className="crop-disclaimer">
            These scores are preliminary comparisons generated by prototype
            rules, not probabilities of crop success or yield. Confirm soil
            fertility, local climate, water availability, and planting dates
            with local agricultural guidance before making planting decisions.
          </p>
        </section>
      )}

      <style>{`
        .crop-api-message {
          line-height: 1.6;
          margin-bottom: 18px;
        }

        .crop-detail-section {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid var(--border-color, #e5e7eb);
        }

        .crop-detail-section h4 {
          margin: 0 0 7px;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .crop-detail-section p {
          margin: 0;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .crop-suitability {
          margin-top: 12px;
        }

        .crop-suitability-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .crop-progress-track {
          width: 100%;
          height: 9px;
          margin-top: 9px;
          border-radius: 99px;
          overflow: hidden;
          background: #e5eee6;
        }

        .crop-progress-fill {
          height: 100%;
          border-radius: inherit;
          background: #27945b;
          transition: width 0.25s ease;
        }

        .crop-suitability-label {
          margin: 7px 0 0;
          font-size: 0.88rem;
          opacity: 0.8;
        }

        .crop-factor-list {
          display: grid;
          gap: 9px;
        }

        .crop-factor-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
