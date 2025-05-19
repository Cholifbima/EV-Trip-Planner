/**
 * Main application functionality for EV Trip Planner
 */
document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const vehicleSelect = document.getElementById('vehicle-select');
  const startSelect = document.getElementById('start-select');
  const destinationSelect = document.getElementById('destination-select');
  const planTripBtn = document.getElementById('plan-trip-btn');
  const resultsSection = document.getElementById('results-section');
  const totalDistanceEl = document.getElementById('total-distance');
  const estimatedTimeEl = document.getElementById('estimated-time');
  const chargingStopsEl = document.getElementById('charging-stops');
  const tripDetailsEl = document.getElementById('trip-details');

  // Initialize map
  mapHandler.initMap();

  // Load initial data
  loadInitialData();

  // Add event listeners
  planTripBtn.addEventListener('click', planTrip);

  /**
   * Load initial data from API
   */
  async function loadInitialData() {
    try {
      // Show loading state
      setButtonLoading(true);
      
      // Fetch vehicles
      const vehicles = await api.getVehicles();
      populateSelect(vehicleSelect, vehicles, 'id', 'name');
      
      // Fetch cities
      const cities = await api.getCities();
      populateSelect(startSelect, cities, 'id', 'name');
      populateSelect(destinationSelect, cities, 'id', 'name');
      
      // Fetch charging stations
      const chargingStations = await api.getChargingStations();
      mapHandler.displayChargingStations(chargingStations);
      
      // Hide loading state
      setButtonLoading(false);
    } catch (error) {
      console.error('Error loading initial data:', error);
      showErrorMessage('Failed to load initial data. Please try refreshing the page.');
      setButtonLoading(false);
    }
  }

  /**
   * Populate a select element with options
   * @param {HTMLSelectElement} selectElement - The select element to populate
   * @param {Array} items - Array of items to populate with
   * @param {string} valueKey - The key to use for option value
   * @param {string} textKey - The key to use for option text
   */
  function populateSelect(selectElement, items, valueKey, textKey) {
    // Keep the first option (placeholder)
    const firstOption = selectElement.options[0];
    selectElement.innerHTML = '';
    selectElement.appendChild(firstOption);
    
    // Add new options
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item[valueKey];
      option.textContent = item[textKey];
      selectElement.appendChild(option);
    });
  }

  /**
   * Plan a trip with selected parameters
   */
  async function planTrip() {
    // Get selected values
    const vehicleId = vehicleSelect.value;
    const startCity = startSelect.value;
    const endCity = destinationSelect.value;
    
    // Validate inputs
    if (!vehicleId || !startCity || !endCity) {
      showErrorMessage('Please select vehicle, start location, and destination');
      return;
    }
    
    // Same start and end?
    if (startCity === endCity) {
      showErrorMessage('Start and destination cannot be the same');
      return;
    }
    
    try {
      // Show loading state
      setButtonLoading(true);
      
      // Call API to plan trip
      const tripData = await api.planTrip(vehicleId, startCity, endCity);
      
      // Display results
      displayResults(tripData);
      
      // Hide loading state
      setButtonLoading(false);
    } catch (error) {
      console.error('Error planning trip:', error);
      showErrorMessage('Failed to plan trip: ' + (error.message || 'Unknown error'));
      setButtonLoading(false);
    }
  }

  /**
   * Display trip planning results
   * @param {Object} tripData - Trip data from API
   */
  function displayResults(tripData) {
    if (!tripData.success) {
      showErrorMessage(tripData.error || 'Failed to plan trip');
      return;
    }
    
    const { route, vehicle } = tripData;
    
    // Update summary information
    totalDistanceEl.textContent = `${Math.round(route.totalDistance)} km`;
    estimatedTimeEl.textContent = `${Math.round(route.estimatedTripTimeHours * 10) / 10} hours (${route.estimatedTripTimeMinutes} min)`;
    chargingStopsEl.textContent = `${route.chargingStops.length}`;
    
    // Display route on map
    mapHandler.displayRoute(tripData);
    
    // Generate trip details
    generateTripDetails(tripData);
    
    // Show results section
    resultsSection.style.display = 'block';
  }

  /**
   * Generate trip details HTML
   * @param {Object} tripData - Trip data from API
   */
  function generateTripDetails(tripData) {
    const { route, vehicle } = tripData;
    const { path, chargingStops, restStops } = route;
    
    // Clear existing details
    tripDetailsEl.innerHTML = '';
    
    // Create vehicle information element
    const vehicleInfo = document.createElement('div');
    vehicleInfo.className = 'stop-item';
    vehicleInfo.innerHTML = `
      <div class="stop-name">${vehicle.name}</div>
      <div class="stop-details">
        Range: ${vehicle.range} km | Battery: ${vehicle.batteryCapacity} kWh
      </div>
    `;
    tripDetailsEl.appendChild(vehicleInfo);
    
    // Create start location element
    const startLocation = document.createElement('div');
    startLocation.className = 'stop-item';
    startLocation.innerHTML = `
      <div class="stop-name">Start: ${path[0].name}</div>
      <div class="stop-details">
        Starting with full battery
      </div>
    `;
    tripDetailsEl.appendChild(startLocation);
    
    // Combine charging and rest stops for chronological display
    const allStops = [
      ...chargingStops.map(stop => ({
        ...stop,
        type: 'charging',
        location: stop.location,
        nodeId: stop.nodeId
      })),
      ...restStops.map(stop => ({
        ...stop,
        type: 'rest',
        location: stop.location,
        nodeId: stop.nodeId
      }))
    ];
    
    // Sort stops by their order in the path
    allStops.sort((a, b) => {
      const aIndex = path.findIndex(p => p.id === a.nodeId);
      const bIndex = path.findIndex(p => p.id === b.nodeId);
      return aIndex - bIndex;
    });
    
    // Add each stop to trip details
    allStops.forEach(stop => {
      const stopEl = document.createElement('div');
      stopEl.className = `stop-item ${stop.type === 'charging' ? 'charging-stop' : 'rest-stop'}`;
      
      if (stop.type === 'charging') {
        stopEl.innerHTML = `
          <div class="stop-name">🔌 Charging Stop: ${stop.stationName}</div>
          <div class="stop-details">
            Charge for ${stop.chargingTimeMinutes} minutes<br>
            Energy added: ${Math.round(stop.energyAdded)} kWh
          </div>
        `;
      } else {
        stopEl.innerHTML = `
          <div class="stop-name">🛑 Rest Stop: ${stop.name}</div>
          <div class="stop-details">
            Rest for ${stop.restTimeMinutes} minutes
          </div>
        `;
      }
      
      tripDetailsEl.appendChild(stopEl);
    });
    
    // Create destination element
    const destination = document.createElement('div');
    destination.className = 'stop-item';
    destination.innerHTML = `
      <div class="stop-name">Destination: ${path[path.length - 1].name}</div>
      <div class="stop-details">
        Total journey: ${Math.round(route.totalDistance)} km<br>
        Total time: ${Math.round(route.estimatedTripTimeHours * 10) / 10} hours
      </div>
    `;
    tripDetailsEl.appendChild(destination);
  }

  /**
   * Set button loading state
   * @param {boolean} isLoading - Whether the button is in loading state
   */
  function setButtonLoading(isLoading) {
    if (isLoading) {
      planTripBtn.disabled = true;
      planTripBtn.textContent = 'Loading...';
    } else {
      planTripBtn.disabled = false;
      planTripBtn.textContent = 'Plan Trip';
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message to show
   */
  function showErrorMessage(message) {
    alert(message);
  }
}); 