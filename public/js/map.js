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

    // Return the initialized map
    return this.map;
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

      this.markers.chargingStations.push(marker);
    });
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
}

// Create a global instance of the map handler
const mapHandler = new MapHandler(); 