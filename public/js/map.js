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
    this.messageContainer = null;
    this.customStartMarker = null;
    this.customDestMarker = null;
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
      
      // Create Google Maps link
      let googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${station.location.lat},${station.location.lng}`;
      if (station.id && station.id.startsWith('ChI')) {
        // If we have a Google Place ID, use that for more accurate linking
        googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${station.location.lat},${station.location.lng}&query_place_id=${station.id}`;
      }
      
      // Add station details
      popupContent += `
          <div class="spklu-details">
            <p><strong>Rating:</strong> ${station.rating} ⭐</p>
            <p><strong>Address:</strong> ${station.placeDetails}</p>
            <p><strong>Charging Speed:</strong> ${station.chargingSpeed} kW</p>
            <p><strong>Connectors:</strong> ${station.connectorTypes.join(', ')}</p>
            <p><strong>Amenities:</strong> ${station.amenities.length > 0 ? station.amenities.join(', ') : 'None specified'}</p>
            <p class="gmaps-link"><a href="${googleMapsLink}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>
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

    // Save the current SPKLU stations if we're in show all mode
    const savedSPKLU = this.isShowAllMode ? [...this.googleSPKLUStations] : [];

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
    
    // Restore saved SPKLU stations if we're in show all mode
    if (this.isShowAllMode && savedSPKLU.length > 0) {
      this.googleSPKLUStations = savedSPKLU;
      // Re-display all SPKLU stations
      this.displayGoogleSPKLU(savedSPKLU);
    } else {
      this.googleSPKLUStations = [];
    }
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
    // Clear existing route without losing SPKLU
    this.clearMap();

    const { path, chargingStops, restStops } = routeData.route;
    
    // Validate path data
    if (!path || !Array.isArray(path) || path.length === 0) {
      console.error("Invalid path data for route display:", path);
      return;
    }
    
    // Create waypoints from path for routing
    const waypoints = path.filter(point => {
      return point && point.location && 
             typeof point.location.lat === 'number' && 
             typeof point.location.lng === 'number';
    }).map(point => 
      L.latLng(point.location.lat, point.location.lng)
    );
    
    // Simplify waypoints if there are too many close together
    // This prevents back-and-forth routing issues
    const simplifiedWaypoints = this.simplifyWaypoints(waypoints);
    
    // Store these points as backup in case routesfound doesn't trigger
    this.routePoints = simplifiedWaypoints;

    // Validate waypoints are sufficient for routing
    if (simplifiedWaypoints.length < 2) {
      console.error("Not enough valid waypoints for routing:", simplifiedWaypoints);
      // Try to show points that are available anyway
      this.showAvailablePoints(path);
      return;
    }

    // Create vehicle marker at the start position
    const vehicleIcon = L.divIcon({
      className: 'vehicle-icon',
      html: '<div class="car-emoji">🚙</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    if (simplifiedWaypoints.length > 0) {
      this.markers.vehicle = L.marker(simplifiedWaypoints[0], {
        icon: vehicleIcon
      }).addTo(this.map);
    }
    
    // Create markers for charging stops
    if (chargingStops && chargingStops.length > 0) {
      chargingStops.forEach(stop => {
        // Only add if we have location data
        if (stop.location && stop.location.lat && stop.location.lng) {
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
            <strong>${stop.stationName || 'Charging Stop'}</strong><br>
            Charging Time: ${stop.chargingTimeMinutes || 0} minutes<br>
            Energy Added: ${Math.round(stop.energyAdded) || 0} kWh
          `);

          this.markers.chargingStations.push(marker);
        }
      });
    }
    
    console.log("Creating routing control with", simplifiedWaypoints.length, "waypoints");
    
    // Make sure waypoints are valid
    if (simplifiedWaypoints.length < 2) {
      console.error("Not enough valid waypoints for routing:", simplifiedWaypoints);
      return;
    }

    // Create and add routing control
    this.routingControl = L.Routing.control({
      waypoints: simplifiedWaypoints,
      lineOptions: {
        styles: [{ color: '#1e88e5', opacity: 0.7, weight: 5 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      createMarker: function() { return null; } // Prevent default markers
    }).addTo(this.map);
    
    // Wait for route calculation to complete before setting animation points
    this.routingControl.on('routesfound', (e) => {
      console.log("Routes found event triggered!");
      
      // Extract all coordinates from all route segments
      if (e.routes && e.routes.length > 0) {
        console.log("Found route with", e.routes[0].coordinates.length, "coordinates");
        
        // Use the coordinates from the actual calculated route
        const actualRoute = e.routes[0];
        this.routePoints = actualRoute.coordinates;
        
        // Update vehicle position to the start of the route
        if (this.markers.vehicle && this.routePoints.length > 0) {
          this.markers.vehicle.setLatLng(this.routePoints[0]);
        }
        
        // Start animation
        this.animateVehicle();
        
        // Fit the map to show the entire route
        this.fitMapToRoute();
      } else {
        console.warn("No routes found in the event");
        // Fallback to starting animation with current points
        this.animateVehicle();
      }
    });

    // Create markers for rest stops
    if (restStops && restStops.length > 0) {
      restStops.forEach(stop => {
        // Only add if we have location data
        if (stop.location && stop.location.lat && stop.location.lng) {
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
            <strong>${stop.name || 'Rest Stop'}</strong><br>
            Rest Time: ${stop.restTimeMinutes || 15} minutes
          `);

          this.markers.restStops.push(marker);
        }
      });
    }

    // Fit the map to show the entire route
    this.fitMapToRoute();

    // Fallback: If no routesfound event after 3 seconds, start animation with current points
    setTimeout(() => {
      if (this.routePoints.length > 0 && !this.animationFrame) {
        console.log("Starting animation with fallback route points");
        this.animateVehicle();
      }
    }, 3000);
    
    // If we're not in show all mode, fetch SPKLU in the current view
    if (!this.isShowAllMode) {
      this.fetchSPKLUInView();
    }
  }

  /**
   * Animate vehicle along the route
   */
  animateVehicle() {
    console.log("Starting vehicle animation with", this.routePoints.length, "points");
    
    // Cancel any existing animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // If route is too short or animation completed
    if (!this.routePoints || this.routePoints.length < 2) {
      console.warn("Route too short for animation:", this.routePoints?.length);
      return;
    }
    
    // Reset position if at the end
    if (this.vehiclePosition >= this.routePoints.length - 1) {
      this.vehiclePosition = 0;
    }

    // Calculate animation speed based on route length
    // Longer routes should move slightly faster
    const routeLength = this.routePoints.length;
    const baseSpeed = 0.003;
    const speedAdjustment = Math.min(routeLength / 1000, 0.004); // Cap the speed adjustment
    const animationSpeed = baseSpeed + speedAdjustment;
    
    console.log(`Animation speed: ${animationSpeed} (route length: ${routeLength} points)`);

    const animate = () => {
      // Don't animate if route is too short
      if (this.routePoints.length < 2) {
        console.warn("Route too short for animation:", this.routePoints.length);
        return;
      }
      
      // Get current and next points
      const currentIndex = Math.floor(this.vehiclePosition);
      const nextIndex = Math.min(currentIndex + 1, this.routePoints.length - 1);
      
      // Safeguard against invalid indices
      if (currentIndex < 0 || currentIndex >= this.routePoints.length || 
          nextIndex < 0 || nextIndex >= this.routePoints.length) {
        console.warn("Invalid animation indices:", currentIndex, nextIndex, "of", this.routePoints.length);
        this.vehiclePosition = 0;
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }
      
      const currentPoint = this.routePoints[currentIndex];
      const nextPoint = this.routePoints[nextIndex];

      if (!currentPoint || !nextPoint) {
        // Skip this frame if we don't have valid points
        console.warn("Invalid route points at indices:", currentIndex, nextIndex);
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }

      // Calculate interpolation within the segment (0 to 1)
      const segmentPosition = this.vehiclePosition % 1;

      // Calculate intermediate position
      const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * segmentPosition;
      const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * segmentPosition;

      // Update vehicle marker position
      if (this.markers.vehicle) {
        this.markers.vehicle.setLatLng([lat, lng]);
        
        // Calculate bearing/heading
        const dx = nextPoint.lng - currentPoint.lng;
        const dy = nextPoint.lat - currentPoint.lat;
        const bearing = Math.atan2(dx, dy) * 180 / Math.PI;
        
        // Rotate the vehicle icon
        const vehicleIcon = this.markers.vehicle.getElement();
        if (vehicleIcon) {
          const iconInner = vehicleIcon.querySelector('.car-emoji');
          if (iconInner) {
            iconInner.style.transform = `rotate(${bearing}deg)`;
          }
        }
      } else {
        console.warn("Vehicle marker missing during animation");
      }

      // Increment position
      this.vehiclePosition += animationSpeed;

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

  /**
   * Enable location picker mode on the map
   * @param {string} type - 'start' or 'destination'
   * @param {Function} callback - Called when a location is selected
   */
  enableLocationPicker(type, callback) {
    console.log(`Map: Enabling location picker for ${type}`);
    
    // Make sure the map is initialized
    if (!this.map) {
      console.error('Map not initialized!');
      return;
    }
    
    // Remove any existing click handlers
    this.map.off('click');
    
    // Show helper message
    this.showMapMessage(`Click on the map to select your ${type === 'start' ? 'starting point' : 'destination'}`);
    
    // Highlight the map with a subtle animation to indicate it's in selection mode
    const mapContainer = document.getElementById('map');
    mapContainer.style.transition = 'box-shadow 0.3s ease';
    mapContainer.style.boxShadow = type === 'start' ? '0 0 15px rgba(76, 175, 80, 0.7)' : '0 0 15px rgba(244, 67, 54, 0.7)';
    
    // Add click handler to the map
    this.map.once('click', (e) => {
      // Get clicked coordinates
      const position = e.latlng;
      console.log(`Map: Selected ${type} at position:`, position);
      
      // Create marker for the selected location
      this.setCustomLocation(type, position);
      
      // Hide the message
      this.hideMapMessage();
      
      // Remove highlight
      mapContainer.style.boxShadow = 'none';
      
      // Call the callback function with the selected position
      if (callback) {
        console.log(`Map: Calling ${type} callback with position`);
        callback(position);
      }
    });
  }
  
  /**
   * Show a message overlay on the map
   * @param {string} message - The message to display
   */
  showMapMessage(message) {
    // Create message container if it doesn't exist
    if (!this.messageContainer) {
      this.messageContainer = document.createElement('div');
      this.messageContainer.className = 'map-message';
      document.getElementById('map').appendChild(this.messageContainer);
    }
    
    // Set message and show
    this.messageContainer.textContent = message;
    this.messageContainer.style.display = 'block';
    
    // Add attention-grabbing animation
    this.messageContainer.style.animation = 'pulse 2s infinite';
  }
  
  /**
   * Hide the map message overlay
   */
  hideMapMessage() {
    if (this.messageContainer) {
      this.messageContainer.style.display = 'none';
      this.messageContainer.style.animation = 'none';
    }
  }
  
  /**
   * Set a custom location marker
   * @param {string} type - 'start' or 'destination'
   * @param {L.LatLng} position - The marker position
   */
  setCustomLocation(type, position) {
    console.log(`Map: Setting custom ${type} location:`, position);
    
    // Make sure the map is initialized
    if (!this.map) {
      console.error('Map not initialized when setting custom location!');
      return null;
    }
    
    // Remove existing marker if any
    if (type === 'start' && this.customStartMarker) {
      console.log('Map: Removing existing start marker');
      this.map.removeLayer(this.customStartMarker);
    } else if (type === 'destination' && this.customDestMarker) {
      console.log('Map: Removing existing destination marker');
      this.map.removeLayer(this.customDestMarker);
    }
    
    // Create icon based on type
    const icon = L.divIcon({
      className: type === 'start' ? 'start-marker-icon' : 'destination-marker-icon',
      html: `<div class="${type === 'start' ? 'start-marker' : 'destination-marker'}">${type === 'start' ? 'A' : 'B'}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    
    try {
      // Create marker
      const marker = L.marker(position, {
        icon,
        draggable: true
      }).addTo(this.map);
      
      // Add popup with information
      marker.bindPopup(type === 'start' ? 'Start Location' : 'Destination').openPopup();
      
      // Add drag end event for position updates
      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        console.log(`Map: ${type} marker dragged to:`, newPos);
        
        // Create custom event to notify app.js
        document.dispatchEvent(new CustomEvent(
          type === 'start' ? 'start-location-changed' : 'destination-location-changed', 
          { detail: newPos }
        ));
      });
      
      // Add extra feedback for a more modern experience
      if (type === 'start') {
        this.customStartMarker = marker;
        this.showBriefIndicator('Start location set!', '#4CAF50');
      } else {
        this.customDestMarker = marker;
        this.showBriefIndicator('Destination set!', '#F44336');
      }
      
      console.log(`Map: ${type} marker created successfully`);
      return marker;
    } catch (error) {
      console.error(`Map: Error creating ${type} marker:`, error);
      alert(`Failed to create marker: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Show a brief success indicator
   * @param {string} message - Message to show
   * @param {string} color - Color of the indicator
   */
  showBriefIndicator(message, color) {
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.top = '50%';
    indicator.style.left = '50%';
    indicator.style.transform = 'translate(-50%, -50%)';
    indicator.style.backgroundColor = color;
    indicator.style.color = 'white';
    indicator.style.padding = '10px 20px';
    indicator.style.borderRadius = '20px';
    indicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    indicator.style.zIndex = '1000';
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 0.3s';
    indicator.textContent = message;
    
    document.getElementById('map').appendChild(indicator);
    
    // Fade in
    setTimeout(() => {
      indicator.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => {
        document.getElementById('map').removeChild(indicator);
      }, 300);
    }, 1500);
  }

  /**
   * Clear all custom location markers
   */
  clearCustomLocations() {
    if (this.customStartMarker) {
      this.map.removeLayer(this.customStartMarker);
      this.customStartMarker = null;
    }
    
    if (this.customDestMarker) {
      this.map.removeLayer(this.customDestMarker);
      this.customDestMarker = null;
    }
  }

  /**
   * Shows available points on the map when there aren't enough for routing
   * @param {Array} pathPoints - Array of path points
   */
  showAvailablePoints(pathPoints) {
    if (!pathPoints || !Array.isArray(pathPoints)) return;
    
    // Filter out invalid points
    const validPoints = pathPoints.filter(point => 
      point && point.location && 
      typeof point.location.lat === 'number' && 
      typeof point.location.lng === 'number'
    );
    
    if (validPoints.length === 0) {
      console.warn("No valid points available to display");
      return;
    }
    
    // Create markers for each valid point
    validPoints.forEach((point, index) => {
      const isStart = index === 0;
      const isEnd = index === validPoints.length - 1;
      
      // Create different styled markers for start, end, and waypoints
      let marker;
      
      if (isStart) {
        // Start marker (green)
        marker = L.circleMarker([point.location.lat, point.location.lng], {
          radius: 10,
          fillColor: '#4CAF50',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(this.map);
        marker.bindPopup(`<strong>Start:</strong> ${point.name}`);
      } else if (isEnd) {
        // End marker (red)
        marker = L.circleMarker([point.location.lat, point.location.lng], {
          radius: 10,
          fillColor: '#F44336',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(this.map);
        marker.bindPopup(`<strong>Destination:</strong> ${point.name}`);
      } else {
        // Waypoint (blue)
        marker = L.circleMarker([point.location.lat, point.location.lng], {
          radius: 6,
          fillColor: '#2196F3',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(this.map);
        marker.bindPopup(`<strong>Waypoint:</strong> ${point.name}`);
      }
      
      // Add to appropriate marker collection
      if (isStart || isEnd) {
        this.markers.chargingStations.push(marker);
      } else {
        this.markers.restStops.push(marker);
      }
    });
    
    // Fit map to these points
    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(
        validPoints.map(p => [p.location.lat, p.location.lng])
      );
      this.map.fitBounds(bounds);
    }
    
    // Show a message to the user about route creation failure
    this.showMapMessage("Could not create route. Try selecting different locations.");
    
    // Hide the message after a few seconds
    setTimeout(() => {
      this.hideMapMessage();
    }, 5000);
  }

  /**
   * Simplify waypoints if there are too many close together
   * @param {Array} waypoints - Array of L.LatLng objects
   * @returns {Array} - Simplified array of L.LatLng objects
   */
  simplifyWaypoints(waypoints) {
    if (!waypoints || waypoints.length < 2) return waypoints;

    const simplified = [];
    let lastPoint = waypoints[0];

    simplified.push(lastPoint);

    for (let i = 1; i < waypoints.length; i++) {
      const currentPoint = waypoints[i];
      const dx = currentPoint.lng - lastPoint.lng;
      const dy = currentPoint.lat - lastPoint.lat;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.001) {
        simplified.push(currentPoint);
        lastPoint = currentPoint;
      }
    }

    return simplified;
  }
}

// Create a global instance of the map handler
const mapHandler = new MapHandler(); 