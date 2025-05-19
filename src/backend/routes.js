const express = require('express');
const router = express.Router();
const AStar = require('../models/astar');

// Load data
const roadNetwork = require('../data/road-network.json');
const chargingStations = require('../data/charging-stations.json');
const vehicles = require('../data/vehicles.json');

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
    
    // Initialize A* algorithm
    const astar = new AStar(roadNetwork, chargingStations, vehicle);
    
    // Find path
    const result = astar.findPath(startCity, endCity);
    
    if (!result.success) {
      return res.status(404).json(result);
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