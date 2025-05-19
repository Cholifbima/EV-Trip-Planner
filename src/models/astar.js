/**
 * A* Search Algorithm for EV Trip Planning
 * 
 * This implementation is specialized for electric vehicles, accounting for:
 * - Battery consumption based on distance
 * - Charging stations availability
 * - Vehicle range limitations
 * - Preference for optimal routes with minimal detours
 */

class AStar {
  /**
   * Initialize the A* Search algorithm
   * @param {Object} roadNetwork - The road network data with nodes and edges
   * @param {Array} chargingStations - List of charging stations
   * @param {Object} vehicle - Vehicle specifications
   */
  constructor(roadNetwork, chargingStations, vehicle) {
    this.nodes = roadNetwork.nodes;
    this.edges = roadNetwork.edges;
    this.chargingStations = chargingStations;
    this.vehicle = vehicle;
    
    // Build adjacency list for faster lookup
    this.adjacencyList = this.buildAdjacencyList();

    // Map charging stations to nearest nodes
    this.nodeToChargingStation = this.mapChargingStationsToNodes();
    
    // Default max detour distance for finding nearby charging stations (in km)
    this.maxDetourDistance = 5;
    
    // Debug mode
    this.debug = false;
  }

  /**
   * Build adjacency list from edges
   * @returns {Object} - Adjacency list
   */
  buildAdjacencyList() {
    const adjacencyList = {};
    
    // Initialize all nodes
    this.nodes.forEach(node => {
      adjacencyList[node.id] = [];
    });

    // Add edges
    this.edges.forEach(edge => {
      // Add bidirectional connections
      adjacencyList[edge.from].push({
        node: edge.to,
        distance: edge.distance,
        condition: edge.condition,
        type: edge.type
      });
      
      adjacencyList[edge.to].push({
        node: edge.from,
        distance: edge.distance,
        condition: edge.condition,
        type: edge.type
      });
    });

    return adjacencyList;
  }

  /**
   * Map charging stations to nearest nodes
   * @returns {Object} - Map of node ID to charging station
   */
  mapChargingStationsToNodes() {
    const nodeToChargingStation = {};
    
    this.chargingStations.forEach(station => {
      // Find the nearest node
      let nearestNode = null;
      let minDistance = Infinity;
      
      this.nodes.forEach(node => {
        const distance = this.calculateDistance(
          station.location.lat, station.location.lng,
          node.location.lat, node.location.lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestNode = node.id;
        }
      });
      
      if (nearestNode) {
        if (!nodeToChargingStation[nearestNode]) {
          nodeToChargingStation[nearestNode] = [];
        }
        nodeToChargingStation[nearestNode].push({
          ...station,
          distanceToNode: minDistance
        });
      }
    });
    
    return nodeToChargingStation;
  }

  /**
   * Calculate Haversine distance between two points
   * @param {number} lat1 - Latitude of first point
   * @param {number} lng1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lng2 - Longitude of second point
   * @returns {number} - Distance in kilometers
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Angle in degrees
   * @returns {number} - Angle in radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Heuristic function for A* (straight-line distance)
   * @param {string} nodeId - Current node ID
   * @param {string} goalId - Goal node ID
   * @returns {number} - Estimated distance to goal
   */
  heuristic(nodeId, goalId) {
    const node = this.nodes.find(n => n.id === nodeId);
    const goal = this.nodes.find(n => n.id === goalId);
    
    if (!node || !goal) {
      return Infinity;
    }
    
    return this.calculateDistance(
      node.location.lat, node.location.lng,
      goal.location.lat, goal.location.lng
    );
  }

  /**
   * Calculate energy consumption between two points
   * @param {number} distance - Distance in km
   * @returns {number} - Energy consumption in kWh
   */
  calculateEnergyConsumption(distance) {
    return distance * this.vehicle.efficiency;
  }

  /**
   * Calculate charging time needed
   * @param {number} energyNeeded - Energy needed in kWh
   * @param {number} chargingSpeed - Charging speed in kW
   * @returns {number} - Charging time in hours
   */
  calculateChargingTime(energyNeeded, chargingSpeed) {
    return energyNeeded / chargingSpeed;
  }

  /**
   * Find the shortest path without considering battery constraints
   * @param {string} start - Start node ID
   * @param {string} goal - Goal node ID
   * @returns {Object} - Path and total distance
   */
  findShortestPath(start, goal) {
    // Check if start and goal exist
    if (!this.nodes.find(n => n.id === start) || !this.nodes.find(n => n.id === goal)) {
      return { 
        success: false, 
        error: "Start or goal node not found in the road network"
      };
    }
    
    // Set of nodes to be evaluated
    const openSet = new Set([start]);
    
    // Set of nodes already evaluated
    const closedSet = new Set();
    
    // For node n, gScore[n] is the cost of the cheapest path from start to n currently known
    const gScore = {};
    this.nodes.forEach(node => {
      gScore[node.id] = Infinity;
    });
    gScore[start] = 0;
    
    // For node n, fScore[n] = gScore[n] + heuristic(n)
    const fScore = {};
    this.nodes.forEach(node => {
      fScore[node.id] = Infinity;
    });
    fScore[start] = this.heuristic(start, goal);
    
    // cameFrom[n] is the node immediately preceding n on the cheapest path
    const cameFrom = {};
    
    // For tracking edge data between nodes
    const edgeBetween = {};
    
    while (openSet.size > 0) {
      // Find node with lowest fScore in openSet
      let current = null;
      let lowestFScore = Infinity;
      
      for (const nodeId of openSet) {
        if (fScore[nodeId] < lowestFScore) {
          lowestFScore = fScore[nodeId];
          current = nodeId;
        }
      }
      
      // If we reached the goal
      if (current === goal) {
        // Reconstruct the path and return
        const path = this.reconstructPath(cameFrom, current);
        const edges = this.getEdgesForPath(path, edgeBetween);
        
        return {
          success: true,
          path: path,
          edges: edges,
          totalDistance: gScore[goal]
        };
      }
      
      // Move current from openSet to closedSet
      openSet.delete(current);
      closedSet.add(current);
      
      // For each neighbor of current
      for (const neighbor of this.adjacencyList[current]) {
        const neighborId = neighbor.node;
        
        // Skip if neighbor is in closedSet
        if (closedSet.has(neighborId)) {
          continue;
        }
        
        // Slightly prefer highways and toll roads
        let edgeWeight = neighbor.distance;
        if (neighbor.type === 'highway' || neighbor.type === 'toll_road') {
          edgeWeight *= 0.95; // 5% bonus for highways/toll roads
        }
        
        // Penalize roads in poor condition
        if (neighbor.condition === 'poor') {
          edgeWeight *= 1.2; // 20% penalty for poor roads
        }
        
        // Calculate tentative gScore
        const tentativeGScore = gScore[current] + edgeWeight;
        
        // Add neighbor to openSet if not there
        if (!openSet.has(neighborId)) {
          openSet.add(neighborId);
        } else if (tentativeGScore >= gScore[neighborId]) {
          // This is not a better path
          continue;
        }
        
        // This path is the best until now. Record it!
        cameFrom[neighborId] = current;
        edgeBetween[`${current}-${neighborId}`] = neighbor;
        gScore[neighborId] = tentativeGScore;
        fScore[neighborId] = gScore[neighborId] + this.heuristic(neighborId, goal);
      }
    }
    
    // If we get here, no path was found
    return {
      success: false,
      error: "No path found between the given nodes"
    };
  }

  /**
   * Get all edges for a path
   * @param {Array} path - Array of node IDs
   * @param {Object} edgeBetween - Map of node pairs to edge data
   * @returns {Array} - Array of edge objects
   */
  getEdgesForPath(path, edgeBetween) {
    const edges = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      
      // Try both directions for the edge
      const edge = edgeBetween[`${from}-${to}`] || edgeBetween[`${to}-${from}`];
      
      if (edge) {
        edges.push({
          from,
          to,
          ...edge
        });
      } else {
        // Fallback to finding the edge in the original edges list
        const originalEdge = this.edges.find(e => 
          (e.from === from && e.to === to) || 
          (e.from === to && e.to === from)
        );
        
        if (originalEdge) {
          edges.push(originalEdge);
        }
      }
    }
    
    return edges;
  }

  /**
   * Find charging stations near a given path within a maximum detour distance
   * @param {Array} path - Array of node IDs representing the path
   * @param {number} maxDetourDistance - Maximum detour distance in km to consider a charging station "nearby"
   * @returns {Map} - Map of node ID to nearby charging stations
   */
  findNearbyChargingStations(path, maxDetourDistance) {
    const nearbyStations = new Map();
    
    // Create a set of nodes in the path for faster lookups
    const nodesInPath = new Set(path);
    
    // First, add stations that are directly on the path
    path.forEach(nodeId => {
      if (this.nodeToChargingStation[nodeId]) {
        nearbyStations.set(nodeId, this.nodeToChargingStation[nodeId]);
      }
    });
    
    // Then add stations that are near the path (within maxDetourDistance)
    Object.keys(this.nodeToChargingStation).forEach(nodeId => {
      // Skip nodes already in the path
      if (nodesInPath.has(nodeId)) return;
      
      const stationsAtNode = this.nodeToChargingStation[nodeId];
      
      // Find the closest node in the path to this station
      const nodeObj = this.nodes.find(n => n.id === nodeId);
      if (!nodeObj) return;
      
      let minDistanceToPath = Infinity;
      let closestPathNode = null;
      
      for (const pathNodeId of path) {
        const pathNode = this.nodes.find(n => n.id === pathNodeId);
        if (!pathNode) continue;
        
        const distance = this.calculateDistance(
          nodeObj.location.lat, nodeObj.location.lng,
          pathNode.location.lat, pathNode.location.lng
        );
        
        if (distance < minDistanceToPath) {
          minDistanceToPath = distance;
          closestPathNode = pathNodeId;
        }
      }
      
      // If the station is within the max detour distance, add it to the nearbyStations
      if (minDistanceToPath <= maxDetourDistance) {
        // If this node's closest path node already has stations, append to the array
        if (nearbyStations.has(closestPathNode)) {
          // Create a new array with existing stations plus these
          const existingStations = nearbyStations.get(closestPathNode);
          const extendedStations = [...existingStations];
          
          // Add stations from this node
          stationsAtNode.forEach(station => {
            // Add the distance to the path
            station.distanceToPath = minDistanceToPath;
            extendedStations.push(station);
          });
          
          nearbyStations.set(closestPathNode, extendedStations);
        } else {
          // Add the distance to the path for each station
          const stationsWithDistance = stationsAtNode.map(station => ({
            ...station,
            distanceToPath: minDistanceToPath
          }));
          
          // Attach these stations to the closest path node
          nearbyStations.set(closestPathNode, stationsWithDistance);
        }
      }
    });
    
    return nearbyStations;
  }

  /**
   * Check if a path is feasible with the given vehicle's battery capacity
   * @param {Array} path - Array of node IDs
   * @param {Array} edges - Array of edge objects
   * @param {Map} chargingStations - Map of node ID to charging stations
   * @returns {Object} - Feasibility result with charging plan if feasible
   */
  checkPathFeasibility(path, edges, chargingStations) {
    const batteryCapacity = this.vehicle.batteryCapacity;
    const range = this.vehicle.range;
    
    // Initialize battery level (100% at start)
    let battery = batteryCapacity;
    
    // Keep track of distance traveled
    let distanceTraveled = 0;
    
    // Keep track of charging stops
    const chargingStops = [];
    
    // Log for debugging
    const log = [];
    if (this.debug) log.push(`Starting with full battery: ${battery.toFixed(2)} kWh (range: ${range} km)`);
    
    // Simulate traveling along the path
    for (let i = 0; i < path.length - 1; i++) {
      const fromNodeId = path[i];
      const toNodeId = path[i + 1];
      
      // Find the edge between these nodes
      const edge = edges.find(e => 
        (e.from === fromNodeId && e.to === toNodeId) || 
        (e.from === toNodeId && e.to === fromNodeId)
      );
      
      if (!edge) {
        if (this.debug) log.push(`Error: No edge found between ${fromNodeId} and ${toNodeId}`);
        return {
          feasible: false,
          error: `No edge found between ${fromNodeId} and ${toNodeId}`,
          log
        };
      }
      
      // Calculate energy needed for this segment
      const distance = edge.distance;
      const energyNeeded = this.calculateEnergyConsumption(distance);
      
      if (this.debug) {
        log.push(`Segment ${fromNodeId} to ${toNodeId}: ${distance.toFixed(1)} km, requires ${energyNeeded.toFixed(2)} kWh`);
        log.push(`Current battery: ${battery.toFixed(2)} kWh`);
      }
      
      // Check if we need to charge at the current node before proceeding
      if (energyNeeded > battery) {
        // We need to charge - check if there's a charging station at this node
        if (chargingStations.has(fromNodeId)) {
          const stations = chargingStations.get(fromNodeId);
          
          // Use the first station at this node
          const station = stations[0];
          
          // Check if any of the station's connector types is compatible with the vehicle
          const compatibleConnector = station.connectorTypes && 
            station.connectorTypes.some(connectorType => 
              this.vehicle.connectorType === connectorType
            );
          
          if (!compatibleConnector) {
            if (this.debug) log.push(`Error: No compatible charging connector at ${fromNodeId}`);
            return {
              feasible: false,
              error: `No compatible charging connector at ${fromNodeId}`,
              log
            };
          }
          
          // Calculate energy needed to fully charge
          const energyToCharge = batteryCapacity - battery;
          const chargingTime = this.calculateChargingTime(energyToCharge, station.chargingSpeed);
          
          // Add the charging stop
          chargingStops.push({
            nodeId: fromNodeId,
            stationId: station.id,
            stationName: station.name,
            location: station.location,
            chargingTime,
            energyAdded: energyToCharge
          });
          
          // Update battery level
          battery = batteryCapacity;
          
          if (this.debug) {
            log.push(`Charging at ${fromNodeId} (${station.name}): +${energyToCharge.toFixed(2)} kWh, ${(chargingTime * 60).toFixed(0)} min`);
            log.push(`Battery after charging: ${battery.toFixed(2)} kWh`);
          }
        } else {
          // No charging station - we can't complete this segment
          if (this.debug) log.push(`Error: No charging station at ${fromNodeId} and not enough battery to reach ${toNodeId}`);
          return {
            feasible: false,
            error: `No charging station at ${fromNodeId} and not enough battery to reach ${toNodeId}`,
            log
          };
        }
      }
      
      // Now we definitely have enough battery to complete this segment
      battery -= energyNeeded;
      distanceTraveled += distance;
      
      if (this.debug) log.push(`After segment: Battery: ${battery.toFixed(2)} kWh, Distance traveled: ${distanceTraveled.toFixed(1)} km`);
      
      // Check if we should charge at the next node
      // We'll charge if battery is below 20% and there's a charging station
      const nextNodeId = path[i + 1];
      const batteryPercentage = (battery / batteryCapacity) * 100;
      
      if (batteryPercentage < 20 && i < path.length - 2 && chargingStations.has(nextNodeId)) {
        const stations = chargingStations.get(nextNodeId);
        const station = stations[0];
        
        // Check connector compatibility
        const compatibleConnector = station.connectorTypes && 
          station.connectorTypes.some(connectorType => 
            this.vehicle.connectorType === connectorType
          );
        
        if (compatibleConnector) {
          // Calculate energy needed to fully charge
          const energyToCharge = batteryCapacity - battery;
          const chargingTime = this.calculateChargingTime(energyToCharge, station.chargingSpeed);
          
          // Add the charging stop
          chargingStops.push({
            nodeId: nextNodeId,
            stationId: station.id,
            stationName: station.name,
            location: station.location,
            chargingTime,
            energyAdded: energyToCharge
          });
          
          // Update battery level for next segment
          battery = batteryCapacity;
          
          if (this.debug) {
            log.push(`Low battery (${batteryPercentage.toFixed(1)}%), charging at ${nextNodeId} (${station.name})`);
            log.push(`Added ${energyToCharge.toFixed(2)} kWh, charging time: ${(chargingTime * 60).toFixed(0)} min`);
            log.push(`Battery after charging: ${battery.toFixed(2)} kWh`);
          }
        }
      }
    }
    
    // If we made it through the whole path, it's feasible
    return {
      feasible: true,
      chargingStops,
      finalBatteryLevel: battery,
      log
    };
  }

  /**
   * Find optimal path with charging stops
   * @param {Array} optimalPath - The optimal path ignoring battery constraints
   * @param {Array} edges - The edges of the optimal path
   * @returns {Object} - Path with charging stops
   */
  findPathWithChargingStations(optimalPath, edges) {
    // Find nearby charging stations
    const nearbyStations = this.findNearbyChargingStations(optimalPath, this.maxDetourDistance);
    
    // First try with nearby stations
    const feasibilityResult = this.checkPathFeasibility(optimalPath, edges, nearbyStations);
    
    if (feasibilityResult.feasible) {
      // The path is feasible with nearby charging stations
      return {
        success: true,
        path: optimalPath,
        edges: edges,
        chargingStops: feasibilityResult.chargingStops,
        totalDistance: edges.reduce((sum, edge) => sum + edge.distance, 0),
        log: feasibilityResult.log
      };
    }
    
    // If not feasible with nearby stations, try with more distant stations
    if (this.debug) {
      console.log(`Path not feasible with ${this.maxDetourDistance}km detour, trying with 10km...`);
    }
    
    const widerNearbyStations = this.findNearbyChargingStations(optimalPath, 10);
    const widerFeasibilityResult = this.checkPathFeasibility(optimalPath, edges, widerNearbyStations);
    
    if (widerFeasibilityResult.feasible) {
      // The path is feasible with wider nearby charging stations
      return {
        success: true,
        path: optimalPath,
        edges: edges,
        chargingStops: widerFeasibilityResult.chargingStops,
        totalDistance: edges.reduce((sum, edge) => sum + edge.distance, 0),
        log: widerFeasibilityResult.log,
        warning: "Had to use charging stations farther from the main route"
      };
    }
    
    // If we still can't make a feasible path, return the error
    return {
      success: false,
      error: widerFeasibilityResult.error || "Could not find a feasible path with charging stations",
      log: widerFeasibilityResult.log
    };
  }

  /**
   * Run A* search algorithm to find optimal path
   * @param {string} start - Start node ID
   * @param {string} goal - Goal node ID
   * @returns {Object} - Path, charging stops, and other trip details
   */
  findPath(start, goal) {
    try {
      // First, find the shortest path without considering battery constraints
      const shortestPathResult = this.findShortestPath(start, goal);
      
      if (!shortestPathResult.success) {
        return {
          success: false,
          error: shortestPathResult.error || "Could not find a path between the given locations"
        };
      }
      
      // Next, find charging stations near this path and create a feasible route
      const pathWithChargingResult = this.findPathWithChargingStations(
        shortestPathResult.path,
        shortestPathResult.edges
      );
      
      if (!pathWithChargingResult.success) {
        // Return partial information if we at least found an optimal path
        return {
          success: false,
          error: pathWithChargingResult.error,
          partialPath: shortestPathResult.path,
          totalDistance: shortestPathResult.totalDistance,
          log: pathWithChargingResult.log
        };
      }
      
      // If successful, calculate estimated time
      const totalDistance = pathWithChargingResult.totalDistance;
      const estimatedTime = this.calculateTripTime(
        totalDistance,
        pathWithChargingResult.chargingStops
      );
      
      // Find optional charging stations along the route
      const path = pathWithChargingResult.path;
      const chargingStops = pathWithChargingResult.chargingStops;
      const visitedNodes = new Set(path);
      
      // Find all nearby charging stations along the final path that weren't used
      const additionalChargingStops = [];
      const nearbyStations = this.findNearbyChargingStations(path, this.maxDetourDistance);
      
      nearbyStations.forEach((stations, nodeId) => {
        // Skip if this node already has a charging stop
        if (chargingStops.some(stop => stop.nodeId === nodeId)) return;
        
        // Only include stations along the path (within visitedNodes)
        if (visitedNodes.has(nodeId)) {
          // Take the first station at this node
          const station = stations[0];
          
          additionalChargingStops.push({
            nodeId: nodeId,
            stationId: station.id,
            stationName: station.name,
            chargingTime: 0, // No need to charge, just showing it's available
            energyAdded: 0,
            isOptional: true,
            location: station.location,
            distanceToPath: station.distanceToPath || 0
          });
        }
      });
      
      // Sort additional stops by their position in the path
      additionalChargingStops.sort((a, b) => {
        return path.indexOf(a.nodeId) - path.indexOf(b.nodeId);
      });
      
      // Combine necessary and optional charging stops
      const allChargingStops = [...chargingStops, ...additionalChargingStops];
      
      return {
        success: true,
        path: path,
        chargingStops: allChargingStops,
        totalDistance: totalDistance,
        estimatedTime: estimatedTime,
        log: pathWithChargingResult.log,
        warning: pathWithChargingResult.warning
      };
    } catch (error) {
      console.error("Error in findPath:", error);
      return {
        success: false,
        error: "An unexpected error occurred: " + error.message
      };
    }
  }

  /**
   * Reconstruct path from start to goal
   * @param {Object} cameFrom - Map of node -> previous node
   * @param {string} current - Goal node
   * @returns {Array} - Path from start to goal
   */
  reconstructPath(cameFrom, current) {
    const totalPath = [current];
    
    while (cameFrom[current]) {
      current = cameFrom[current];
      totalPath.unshift(current);
    }
    
    return totalPath;
  }

  /**
   * Calculate total trip time including driving and charging
   * @param {number} distance - Total distance in km
   * @param {Array} chargingStops - List of charging stops
   * @returns {number} - Estimated trip time in hours
   */
  calculateTripTime(distance, chargingStops) {
    // Assume average speed of 60 km/h for driving time
    const averageSpeed = 60;
    const drivingTime = distance / averageSpeed;
    
    // Add up all charging times
    const chargingTime = chargingStops.reduce((total, stop) => {
      // Only count non-optional stops
      if (!stop.isOptional) {
        return total + stop.chargingTime;
      }
      return total;
    }, 0);
    
    // Add rest time - assume 15 min rest every 2 hours of driving
    const restTime = Math.floor(drivingTime / 2) * 0.25;
    
    return drivingTime + chargingTime + restTime;
  }
}

module.exports = AStar; 