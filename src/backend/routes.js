const express = require('express');
const router = express.Router();
const AStar = require('../models/astar');
const axios = require('axios'); // Tambahkan axios untuk HTTP requests
const config = require('../utils/config'); // Import config
const spkluFetcher = require('../utils/spkluFetcher');

// Load data
const roadNetwork = require('../data/road-network.json');
const chargingStations = require('../data/charging-stations.json');
const vehicles = require('../data/vehicles.json');

// Get Google Maps API key from config
const GOOGLE_MAPS_API_KEY = config.googleMapsApiKey;

// Get all available vehicles
router.get('/vehicles', (req, res) => {
  res.json(vehicles);
});

// Get all charging stations
router.get('/charging-stations', (req, res) => {
  res.json(chargingStations);
});

// Get all cities (nodes in the road network)
router.get('/cities', (req, res) => {
  res.json(roadNetwork.nodes);
});

// Get SPKLU photo from Google
router.get('/spklu-photo/:photoReference', async (req, res) => {
  try {
    const { photoReference } = req.params;
    const maxWidth = req.query.maxwidth || 400;
    
    if (!photoReference) {
      return res.status(400).json({
        success: false,
        error: "Missing photo reference"
      });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Google Maps API key not configured"
      });
    }

    // Proxy the photo request to Google
    const response = await axios({
      method: 'get',
      url: 'https://maps.googleapis.com/maps/api/place/photo',
      params: {
        maxwidth: maxWidth,
        photoreference: photoReference,
        key: GOOGLE_MAPS_API_KEY
      },
      responseType: 'stream'
    });
    
    // Set appropriate headers
    res.set('Content-Type', response.headers['content-type']);
    
    // Pipe the image data to our response
    response.data.pipe(res);
    
  } catch (error) {
    console.error('Error fetching SPKLU photo:', error);
    res.status(500).json({
      success: false,
      error: "Error fetching SPKLU photo"
    });
  }
});

// Search for SPKLU using Google Places API
router.post('/search-spklu-google', async (req, res) => {
  try {
    const { bounds } = req.body;
    
    if (!bounds) {
      return res.status(400).json({
        success: false,
        error: "Missing map bounds"
      });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Google Maps API key not configured"
      });
    }

    // Calculate the center of the bounds
    const center = {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };
    
    // Calculate radius in meters (approximate)
    const earthRadius = 6371000; // earth radius in meters
    const latDiff = Math.abs(bounds.north - bounds.south) * Math.PI / 180;
    const lngDiff = Math.abs(bounds.east - bounds.west) * Math.PI / 180;
    const latDistance = latDiff * earthRadius;
    const lngDistance = lngDiff * earthRadius * Math.cos(center.lat * Math.PI / 180);
    const radius = Math.max(latDistance, lngDistance) / 2;
    
    // Make request to Google Places API
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        key: GOOGLE_MAPS_API_KEY,
        location: `${center.lat},${center.lng}`,
        radius: Math.min(radius, 50000), // Google Places API limits radius to 50km
        keyword: 'SPKLU OR EV charging station OR stasiun pengisian kendaraan listrik',
        type: 'point_of_interest'
      }
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', response.data.status);
      return res.status(500).json({
        success: false,
        error: `Google Places API error: ${response.data.status}`
      });
    }

    // Transform Google Places results to our charging station format
    const spkluStations = response.data.results.map(place => {
      // Try to determine charging speed and connectors from place details (if available)
      // This is approximate as Google doesn't provide this information directly
      let chargingSpeed = 50; // default to 50kW
      let connectorTypes = ["CCS", "CHAdeMO"]; // default connectors
      
      // Extract attributes from place name or types if possible
      if (place.name.toLowerCase().includes('fast') || place.name.toLowerCase().includes('cepat')) {
        chargingSpeed = 100;
      }
      
      if (place.name.toLowerCase().includes('type 2') || place.name.toLowerCase().includes('tipe 2')) {
        connectorTypes.push("Type 2");
      }
      
      // Map amenities based on place types
      const amenities = [];
      if (place.types.includes('cafe') || place.types.includes('restaurant')) {
        amenities.push('cafe');
      }
      if (place.types.includes('convenience_store') || place.types.includes('store')) {
        amenities.push('convenience store');
      }
      if (place.types.includes('parking')) {
        amenities.push('parking');
      }
      if (place.types.includes('gas_station')) {
        amenities.push('gas station');
      }
      
      // Create a charging station object
      return {
        id: place.place_id,
        name: place.name,
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        chargingSpeed,
        connectorTypes,
        amenities,
        rating: place.rating || 0,
        photoReference: place.photos && place.photos.length > 0 ? place.photos[0].photo_reference : null,
        placeDetails: place.vicinity || ''
      };
    });

    res.json({
      success: true,
      stations: spkluStations
    });
    
  } catch (error) {
    console.error('Error searching for SPKLU:', error);
    res.status(500).json({
      success: false,
      error: "Error searching for SPKLU stations"
    });
  }
});

// Start indexing all SPKLU in Indonesia
router.post('/start-spklu-indexing', async (req, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Google Maps API key not configured"
      });
    }

    // Start the indexing process in background
    spkluFetcher.startIndexingAllSPKLU();

    res.json({
      success: true,
      message: "Indexing SPKLU di seluruh Indonesia telah dimulai."
    });
  } catch (error) {
    console.error('Error starting SPKLU indexing:', error);
    res.status(500).json({
      success: false,
      error: "Error starting SPKLU indexing"
    });
  }
});

// Get all indexed SPKLU
router.get('/all-spklu', (req, res) => {
  try {
    const spkluData = spkluFetcher.getAllSPKLU();
    
    res.json({
      success: true,
      isComplete: spkluData.isComplete,
      progress: spkluData.progress,
      count: spkluData.stations.length,
      stations: spkluData.stations
    });
  } catch (error) {
    console.error('Error getting all SPKLU:', error);
    res.status(500).json({
      success: false,
      error: "Error retrieving all SPKLU stations"
    });
  }
});

// Get indexing progress
router.get('/spklu-indexing-progress', (req, res) => {
  try {
    res.json({
      success: true,
      isComplete: spkluFetcher.isIndexingComplete(),
      progress: spkluFetcher.getIndexingProgress()
    });
  } catch (error) {
    console.error('Error getting indexing progress:', error);
    res.status(500).json({
      success: false,
      error: "Error retrieving indexing progress"
    });
  }
});

// Calculate route
router.post('/route', (req, res) => {
  try {
    const { vehicleId, startCity, endCity } = req.body;
    
    // Validate inputs
    if (!vehicleId || !startCity || !endCity) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required parameters: vehicleId, startCity, or endCity" 
      });
    }
    
    // Find vehicle
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        error: `Vehicle with ID ${vehicleId} not found` 
      });
    }
    
    // Check for known disconnected routes between islands
    const disconnectedRoutes = [
      { start: "jakarta", end: "makassar" },
      { start: "bandung", end: "makassar" },
      { start: "semarang", end: "makassar" },
      { start: "yogyakarta", end: "makassar" },
      { start: "solo", end: "makassar" },
      { start: "surabaya", end: "makassar" },
      { start: "malang", end: "makassar" },
      { start: "jakarta", end: "medan" },
      { start: "bandung", end: "medan" },
      { start: "surabaya", end: "medan" }
    ];
    
    // Check both directions
    const isDisconnected = disconnectedRoutes.some(route => 
      (route.start === startCity && route.end === endCity) || 
      (route.start === endCity && route.end === startCity)
    );
    
    if (isDisconnected) {
      return res.status(404).json({
        success: false,
        error: "Rute antar pulau ini tidak tersedia. Aplikasi saat ini hanya mendukung rute dalam pulau yang sama atau melalui jalur feri yang terhubung di dataset."
      });
    }
    
    // Initialize A* algorithm
    const astar = new AStar(roadNetwork, chargingStations, vehicle);
    
    // Find path
    const result = astar.findPath(startCity, endCity);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || "Tidak dapat menemukan rute yang sesuai. Kemungkinan tidak ada jalur yang terhubung atau SPKLU yang cukup di sepanjang rute."
      });
    }
    
    // Get complete path with coordinates
    const pathWithCoordinates = result.path.map(nodeId => {
      const node = roadNetwork.nodes.find(n => n.id === nodeId);
      return {
        id: nodeId,
        name: node.name,
        location: node.location
      };
    });
    
    // Get charging stops with coordinates
    const chargingStopsWithDetails = result.chargingStops.map(stop => {
      const node = roadNetwork.nodes.find(n => n.id === stop.nodeId);
      return {
        ...stop,
        location: node.location,
        chargingTimeMinutes: Math.round(stop.chargingTime * 60) // Convert to minutes
      };
    });
    
    // Calculate rest stops (every 2 hours of driving, excluding charging stops)
    const restStops = [];
    const drivingHoursPerSegment = 2; // Hours of driving before rest
    const totalDrivingTime = result.totalDistance / 60; // Assuming 60 km/h average speed
    
    if (totalDrivingTime > drivingHoursPerSegment) {
      let cumulativeDistance = 0;
      let lastRestStopIndex = 0;
      
      for (let i = 0; i < result.path.length - 1; i++) {
        const currentNodeId = result.path[i];
        const nextNodeId = result.path[i + 1];
        
        // Find edge between these nodes
        const edge = roadNetwork.edges.find(e => 
          (e.from === currentNodeId && e.to === nextNodeId) || 
          (e.to === currentNodeId && e.from === nextNodeId)
        );
        
        if (edge) {
          cumulativeDistance += edge.distance;
          const cumulativeDrivingTime = cumulativeDistance / 60;
          
          // Check if we need a rest stop and this isn't already a charging stop
          if (cumulativeDrivingTime >= drivingHoursPerSegment * (lastRestStopIndex + 1) && 
              !chargingStopsWithDetails.some(stop => stop.nodeId === nextNodeId)) {
            
            const node = roadNetwork.nodes.find(n => n.id === nextNodeId);
            restStops.push({
              nodeId: nextNodeId,
              name: node.name,
              location: node.location,
              restTimeMinutes: 15 // 15 minutes rest
            });
            
            lastRestStopIndex++;
          }
        }
      }
    }
    
    // Format response
    const response = {
      success: true,
      route: {
        path: pathWithCoordinates,
        chargingStops: chargingStopsWithDetails,
        restStops,
        totalDistance: result.totalDistance,
        estimatedTripTimeHours: result.estimatedTime,
        estimatedTripTimeMinutes: Math.round(result.estimatedTime * 60)
      },
      vehicle: {
        id: vehicle.id,
        name: vehicle.name,
        range: vehicle.range,
        batteryCapacity: vehicle.batteryCapacity
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({ 
      success: false, 
      error: "Server error calculating route" 
    });
  }
});

module.exports = router; 