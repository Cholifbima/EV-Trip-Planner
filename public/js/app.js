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
  
  // SPKLU Elements
  const showAllSpkluBtn = document.getElementById('show-all-spklu-btn');
  const hideAllSpkluBtn = document.getElementById('hide-all-spklu-btn');
  const startIndexingBtn = document.getElementById('start-indexing-btn');
  const indexingProgressContainer = document.getElementById('indexing-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const spkluCountEl = document.getElementById('spklu-count');
  
  // SPKLU Tracking
  let indexingInProgress = false;
  let progressCheckInterval = null;

  // Initialize map
  mapHandler.initMap();

  // Load initial data
  loadInitialData();

  // Add event listeners
  planTripBtn.addEventListener('click', planTrip);
  showAllSpkluBtn.addEventListener('click', showAllSPKLU);
  hideAllSpkluBtn.addEventListener('click', hideAllSPKLU);
  startIndexingBtn.addEventListener('click', startIndexingSPKLU);

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
      
      // Check if we have any indexed SPKLU and show them
      try {
        const result = await api.getAllSPKLU();
        if (result.success && result.stations && result.stations.length > 0) {
          console.log(`Loading ${result.stations.length} previously indexed SPKLU stations`);
          spkluCountEl.textContent = `SPKLU Found: ${result.count}`;
          
          // Enable show all mode to keep all SPKLU visible
          mapHandler.setShowAllMode(true, result.stations);
        }
      } catch (e) {
        console.warn('Could not load indexed SPKLU:', e);
      }
      
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

  /**
   * Show all indexed SPKLU in Indonesia
   */
  async function showAllSPKLU() {
    try {
      showAllSpkluBtn.disabled = true;
      showAllSpkluBtn.textContent = 'Loading...';
      
      // Get all indexed SPKLU
      const result = await api.getAllSPKLU();
      
      if (result.success) {
        // Update SPKLU count
        spkluCountEl.textContent = `SPKLU Found: ${result.count}`;
        
        // Clear existing SPKLU markers and display all stations
        if (result.stations && result.stations.length > 0) {
          // Enable "show all" mode to keep stations visible when moving the map
          mapHandler.setShowAllMode(true, result.stations);
        } else if (!result.isComplete) {
          alert('No SPKLU stations indexed yet. Click "Index All SPKLU in Indonesia" first.');
        } else {
          alert('No SPKLU stations found in Indonesia.');
        }
      } else {
        alert('Failed to load SPKLU data.');
      }
      
      showAllSpkluBtn.disabled = false;
      showAllSpkluBtn.textContent = 'Show All SPKLU in Indonesia';
    } catch (error) {
      console.error('Error showing all SPKLU:', error);
      alert('Failed to show all SPKLU: ' + (error.message || 'Unknown error'));
      showAllSpkluBtn.disabled = false;
      showAllSpkluBtn.textContent = 'Show All SPKLU in Indonesia';
    }
  }

  /**
   * Start indexing all SPKLU in Indonesia
   */
  async function startIndexingSPKLU() {
    if (indexingInProgress) {
      alert('Indexing is already in progress.');
      return;
    }
    
    try {
      // Update UI
      startIndexingBtn.disabled = true;
      startIndexingBtn.textContent = 'Indexing...';
      indexingProgressContainer.style.display = 'block';
      progressFill.style.width = '0%';
      progressText.textContent = '0%';
      indexingInProgress = true;
      
      // Start indexing
      const result = await api.startSPKLUIndexing();
      
      if (result.success) {
        // Check progress periodically
        progressCheckInterval = setInterval(checkIndexingProgress, 2000);
      } else {
        alert('Failed to start indexing: ' + (result.error || 'Unknown error'));
        resetIndexingUI();
      }
    } catch (error) {
      console.error('Error starting SPKLU indexing:', error);
      alert('Failed to start indexing: ' + (error.message || 'Unknown error'));
      resetIndexingUI();
    }
  }
  
  /**
   * Check the progress of SPKLU indexing
   */
  async function checkIndexingProgress() {
    try {
      const result = await api.getSPKLUIndexingProgress();
      
      if (result.success) {
        // Update progress bar
        const progress = result.progress || 0;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        
        // Check if indexing is complete
        if (result.isComplete) {
          clearInterval(progressCheckInterval);
          
          // Get all indexed SPKLU
          const spkluData = await api.getAllSPKLU();
          spkluCountEl.textContent = `SPKLU Found: ${spkluData.count || 0}`;
          
          // Show all indexed SPKLU on the map
          showAllSPKLU();
          
          // Reset UI after a short delay
          setTimeout(resetIndexingUI, 1000);
          
          alert('Indexing complete! All SPKLU stations in Indonesia have been indexed.');
        }
      }
    } catch (error) {
      console.error('Error checking indexing progress:', error);
    }
  }
  
  /**
   * Reset the indexing UI elements
   */
  function resetIndexingUI() {
    startIndexingBtn.disabled = false;
    startIndexingBtn.textContent = 'Index All SPKLU in Indonesia';
    indexingInProgress = false;
    if (progressCheckInterval) {
      clearInterval(progressCheckInterval);
      progressCheckInterval = null;
    }
  }

  /**
   * Hide all indexed SPKLU in Indonesia
   */
  async function hideAllSPKLU() {
    try {
      hideAllSpkluBtn.disabled = true;
      hideAllSpkluBtn.textContent = 'Loading...';
      
      // Hide all SPKLU
      mapHandler.setShowAllMode(false);
      
      hideAllSpkluBtn.disabled = false;
      hideAllSpkluBtn.textContent = 'Hide All SPKLU';
    } catch (error) {
      console.error('Error hiding all SPKLU:', error);
      alert('Failed to hide all SPKLU: ' + (error.message || 'Unknown error'));
      hideAllSpkluBtn.disabled = false;
      hideAllSpkluBtn.textContent = 'Hide All SPKLU';
    }
  }
}); 