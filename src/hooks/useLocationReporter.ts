import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export function useLocationReporter() {
  const reportLocation = useCallback(async (lat: number, lng: number, accuracy?: number) => {
    try {
      const token = localStorage.getItem("mindcare_token");
      if (!token) return;

      await fetch("/api/risk/report-location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ lat, lng, accuracy })
      });
      console.log(`[LocationReporter] Silent coordinates reported: ${lat}, ${lng} (${accuracy || 0}m accuracy)`);
    } catch (err) {
      console.error("[LocationReporter] Failed to report location:", err);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("[LocationReporter] Geolocation API not supported by browser.");
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      reportLocation(latitude, longitude, accuracy);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn(`[LocationReporter] Geolocation query failed: ${error.message}`);
    };

    const checkAndReport = async () => {
      try {
        const token = localStorage.getItem("mindcare_token");
        if (!token) return;

        const scoreRes = await api.risk.getScore();
        // Restrict geolocation requests to active high/critical crisis states or manual SOS states only
        if (scoreRes.level === "high" || scoreRes.level === "critical") {
          console.log("[LocationReporter] Active crisis state detected. Requesting geolocation.");
          navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
          });
        }
      } catch (err) {
        console.error("[LocationReporter] Geolocation permission query or check failed:", err);
      }
    };

    // Check immediately and then check periodically every 30 seconds
    checkAndReport();
    const intervalId = setInterval(checkAndReport, 30000);

    return () => clearInterval(intervalId);
  }, [reportLocation]);
}
