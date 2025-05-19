/**
 * Map handler for the EV Trip Planner using LeafletJS
 */
class MapHandler {
  /**
   * Initialize the map
   */
  constructor() {
    this.map = null;
    this.routingControl = null;
    this.markers = {
      chargingStations: [],
      restStops: [],
      vehicle: null
    };
    this.animationFrame = null;
    this.routePoints = [];
    this.vehiclePosition = 0;
    this.googleSPKLUStations = []; // Added to store Google SPKLU stations
    this.isShowAllMode = false; // Flag to indicate if we're in "show all SPKLU" mode
  }

  /**
   * Initialize the map centered on Indonesia
   */
  initMap() {
    // Create map centered on Indonesia
    this.map = L.map('map').setView([-2.5, 118], 5);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(this.map);

    // Add event listener for map movement to fetch SPKLU
    this.map.on('moveend', this.handleMapMoveEnd.bind(this));

    // Fetch SPKLU in current view on initialization
    this.fetchSPKLUInView();

    // Return the initialized map
    return this.map;
  }
  
  /**
   * Handle map moveend event - decide whether to fetch new SPKLU or not
   */
  handleMapMoveEnd() {
    // Only fetch new SPKLU if we're not in "show all" mode
    if (!this.isShowAllMode) {
      this.fetchSPKLUInView();
    }
  }

  /**
   * Fetch SPKLU in current map view using Google Places API
   */
  async fetchSPKLUInView() {
    try {
      const bounds = this.map.getBounds();
      
      if (!bounds) return;
      
      const boundsObj = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      };

      // Call API to get SPKLU stations
      const result = await api.searchSPKLUFromGoogle(boundsObj);
      
      if (result.success) {
        this.displayGoogleSPKLU(result.stations);
      } else if (result.error === "Google Maps API key not configured") {
        console.warn("Google Maps API key not configured. SPKLU stations from Google will not be available.");
        // Only show warning once
        this.map.off('moveend', this.handleMapMoveEnd.bind(this));
      }
    } catch (error) {
      console.error('Error fetching SPKLU in view:', error);
    }
  }

  /**
   * Display SPKLU stations from Google Places API
   * @param {Array} stations - Array of SPKLU stations
   */
  displayGoogleSPKLU(stations) {
    // Clear existing Google SPKLU markers
    this.clearGoogleSPKLU();
    
    // Store new stations
    this.googleSPKLUStations = stations;
    
    // Create markers for each SPKLU station
    stations.forEach(station => {
      // Create custom icon 
      const spkluIcon = L.divIcon({
        className: 'spklu-marker',
        html: '<div class="spklu-marker-inner">⚡</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      // Create marker
      const marker = L.marker([station.location.lat, station.location.lng], {
        icon: spkluIcon,
        title: station.name
      }).addTo(this.map);
      
      // Create popup content with photo if available
      let popupContent = `
        <div class="spklu-popup">
          <h3>SPKLU Charging Station</h3>
      `;
      
      // Add photo if available
      if (station.photoReference) {
        popupContent += `<img src="/api/spklu-photo/${station.photoReference}?maxwidth=300" alt="${station.name}" class="spklu-photo">`;
      } else {
        // Use EV charging icon if no photo is available
        popupContent += `<div style="text-align:center;font-size:40px;margin:10px 0;">⚡🔌🚗</div>`;
      }
      
      // Add station details
      popupContent += `
          <div class="spklu-details">
            <p><strong>Rating:</strong> ${station.rating} ⭐</p>
            <p><strong>Address:</strong> ${station.placeDetails}</p>
            <p><strong>Charging Speed:</strong> ${station.chargingSpeed} kW</p>
            <p><strong>Connectors:</strong> ${station.connectorTypes.join(', ')}</p>
            <p><strong>Amenities:</strong> ${station.amenities.length > 0 ? station.amenities.join(', ') : 'None specified'}</p>
          </div>
        </div>
      `;
      
      // Add popup to marker
      marker.bindPopup(popupContent);
      
      // Add hover effect
      marker.on('mouseover', function() {
        this.openPopup();
      });
      
      // Add to markers collection
      this.markers.chargingStations.push(marker);
    });
  }

  /**
   * Clear Google SPKLU markers from the map
   */
  clearGoogleSPKLU() {
    // Clear existing markers related to Google SPKLU
    this.googleSPKLUStations = [];
    
    // Remove markers from map
    this.markers.chargingStations.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers.chargingStations = [];
  }

  /**
   * Clear all markers and routes from the map
   */
  clearMap() {
    // Clear routing control
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }

    // Clear charging station markers
    this.markers.chargingStations.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers.chargingStations = [];

    // Clear rest stop markers
    this.markers.restStops.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers.restStops = [];

    // Clear vehicle marker
    if (this.markers.vehicle) {
      this.map.removeLayer(this.markers.vehicle);
      this.markers.vehicle = null;
    }

    // Cancel any ongoing animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.routePoints = [];
    this.vehiclePosition = 0;
    this.googleSPKLUStations = [];
  }

  /**
   * Display charging stations on the map
   * @param {Array} chargingStations - Array of charging station data
   */
  displayChargingStations(chargingStations) {
    // Clear existing charging station markers
    this.markers.chargingStations.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers.chargingStations = [];

    // Add new charging station markers
    chargingStations.forEach(station => {
      const marker = L.circleMarker([station.location.lat, station.location.lng], {
        radius: 8,
        fillColor: '#ff9800',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);

      // Add popup with station information
      marker.bindPopup(`
        <strong>${station.name}</strong><br>
        Charging Speed: ${station.chargingSpeed} kW<br>
        Connectors: ${station.connectorTypes.join(', ')}<br>
        Amenities: ${station.amenities.join(', ')}
      `);

      // Add hover effect
      marker.on('mouseover', function() {
        this.openPopup();
      });

      this.markers.chargingStations.push(marker);
    });

    // Also fetch SPKLU from Google API
    this.fetchSPKLUInView();
  }

  /**
   * Display a route on the map
   * @param {Object} routeData - Route data from the API
   */
  displayRoute(routeData) {
    // Clear existing route
    this.clearMap();

    const { path, chargingStops, restStops } = routeData.route;

    // Create waypoints for the route
    const waypoints = path.map(point => 
      L.latLng(point.location.lat, point.location.lng)
    );

    this.routePoints = waypoints;

    // Create and add routing control
    this.routingControl = L.Routing.control({
      waypoints,
      lineOptions: {
        styles: [{ color: '#1e88e5', opacity: 0.7, weight: 5 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false
    }).addTo(this.map);

    // Create markers for charging stops
    chargingStops.forEach(stop => {
      const marker = L.circleMarker([stop.location.lat, stop.location.lng], {
        radius: 10,
        fillColor: '#ff9800',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);

      // Add popup with charging information
      marker.bindPopup(`
        <strong>${stop.stationName}</strong><br>
        Charging Time: ${stop.chargingTimeMinutes} minutes<br>
        Energy Added: ${Math.round(stop.energyAdded)} kWh
      `);

      this.markers.chargingStations.push(marker);
    });

    // Create markers for rest stops
    restStops.forEach(stop => {
      const marker = L.circleMarker([stop.location.lat, stop.location.lng], {
        radius: 8,
        fillColor: '#4caf50',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);

      // Add popup with rest stop information
      marker.bindPopup(`
        <strong>${stop.name}</strong><br>
        Rest Time: ${stop.restTimeMinutes} minutes
      `);

      this.markers.restStops.push(marker);
    });

    // Create vehicle marker
    if (waypoints.length > 0) {
      const vehicleIcon = L.divIcon({
        className: 'vehicle-icon',
        html: '<span style="font-size: 20px;">🚗</span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      this.markers.vehicle = L.marker(waypoints[0], {
        icon: vehicleIcon
      }).addTo(this.map);

      // Start animation
      this.animateVehicle();
    }

    // Fetch SPKLU in current view
    this.fetchSPKLUInView();
  }

  /**
   * Animate vehicle along the route
   */
  animateVehicle() {
    // Cancel any existing animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // If route is too short or animation completed
    if (this.routePoints.length < 2 || this.vehiclePosition >= this.routePoints.length - 1) {
      this.vehiclePosition = 0;
    }

    const animate = () => {
      // Get current and next points
      const currentPoint = this.routePoints[Math.floor(this.vehiclePosition)];
      const nextPoint = this.routePoints[Math.min(Math.floor(this.vehiclePosition) + 1, this.routePoints.length - 1)];

      // Calculate interpolation within the segment (0 to 1)
      const segmentPosition = this.vehiclePosition % 1;

      // Calculate intermediate position
      const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * segmentPosition;
      const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * segmentPosition;

      // Update vehicle marker position
      if (this.markers.vehicle) {
        this.markers.vehicle.setLatLng([lat, lng]);
      }

      // Increment position
      this.vehiclePosition += 0.005;

      // If we've reached the end, reset to beginning for loop
      if (this.vehiclePosition >= this.routePoints.length - 1) {
        this.vehiclePosition = 0;
      }

      // Continue animation
      this.animationFrame = requestAnimationFrame(animate);
    };

    // Start animation
    animate();
  }

  /**
   * Fit map to show all route waypoints
   */
  fitMapToRoute() {
    if (this.routePoints.length > 0) {
      this.map.fitBounds(L.latLngBounds(this.routePoints));
    }
  }

  /**
   * Fit map to show all stations 
   * @param {Array} stations - Array of stations with lat/lng coordinates
   * @param {number} padding - Padding in pixels around the bounds (optional)
   */
  fitMapToStations(stations, padding = 50) {
    if (stations && stations.length > 0) {
      const points = stations.map(station => [station.location.lat, station.location.lng]);
      this.map.fitBounds(L.latLngBounds(points), { padding: [padding, padding] });
    }
  }

  /**
   * Set "show all SPKLU" mode
   * @param {boolean} enabled - Whether to enable show all mode
   * @param {Array} stations - Array of all SPKLU stations
   */
  setShowAllMode(enabled, stations = []) {
    this.isShowAllMode = enabled;
    
    if (enabled && stations.length > 0) {
      // Clear existing markers and show all stations
      this.clearGoogleSPKLU();
      this.displayGoogleSPKLU(stations);
      this.fitMapToStations(stations);
    } else if (!enabled) {
      // Clear all and fetch only in current view
      this.clearGoogleSPKLU();
      this.fetchSPKLUInView();
    }
  }
}

// Create a global instance of the map handler
const mapHandler = new MapHandler(); 