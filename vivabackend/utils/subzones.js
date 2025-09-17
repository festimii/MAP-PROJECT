export const parseSubZoneGeoJSON = (rawValue) => {
  if (!rawValue) {
    return null;
  }

  try {
    if (typeof rawValue === "string") {
      return JSON.parse(rawValue);
    }

    if (typeof rawValue === "object") {
      return rawValue;
    }
  } catch (err) {
    console.warn("⚠️ Failed to parse SubZone GeoJSON", err);
  }

  return null;
};

export const mergeSubZoneData = (target, name, geoJsonValue) => {
  if (!target) {
    return;
  }

  if (!target.SubZone_Name && name) {
    target.SubZone_Name = name;
  }

  if (!target.SubZone_GeoJSON && geoJsonValue) {
    target.SubZone_GeoJSON = parseSubZoneGeoJSON(geoJsonValue);
  }
};
