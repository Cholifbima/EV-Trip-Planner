/**
 * A* Search Algorithm for EV Trip Planning
 * 
 * This implementation is specialized for electric vehicles, accounting for:
 * - Battery consumption based on distance
 * - Charging stations availability
 * - Vehicle range limitations
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
        nodeToChargingStation[nearestNode].push(station);
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
   * Run A* search algorithm to find optimal path
   * @param {string} start - Start node ID
   * @param {string} goal - Goal node ID
   * @returns {Object} - Path, charging stops, and other trip details
   */
  findPath(start, goal) {
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
    
    // Initial battery level (100%)
    const batteryLevel = {};
    this.nodes.forEach(node => {
      batteryLevel[node.id] = 0;
    });
    batteryLevel[start] = this.vehicle.batteryCapacity;
    
    // Charging stops and times
    const chargingStops = [];
    
    // Track all potential charging stations passed
    const potentialChargingStations = [];
    
    // Track nearest charging stations to the route
    const nearbyChargingStations = new Map();
    
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
        // Add nearby charging stations that weren't used for charging but are along the route
        const path = this.reconstructPath(cameFrom, current);
        const visitedNodes = new Set(path);
        
        // Find all nearby charging stations along the final path
        const additionalChargingStops = [];
        path.forEach(nodeId => {
          if (this.nodeToChargingStation[nodeId] && 
              !chargingStops.some(stop => stop.nodeId === nodeId)) {
            // This node has charging stations but wasn't used for charging
            const station = this.nodeToChargingStation[nodeId][0];
            
            // Add as a potential charging stop with zero charging time
            additionalChargingStops.push({
              nodeId: nodeId,
              stationId: station.id,
              stationName: station.name,
              chargingTime: 0, // No need to charge, just showing it's available
              energyAdded: 0,
              isOptional: true, // Mark as optional
              location: {
                lat: station.location.lat,
                lng: station.location.lng
              }
            });
          }
        });
        
        // Add any nearby charging stations that are close to our route
        nearbyChargingStations.forEach((stations, nodeId) => {
          if (visitedNodes.has(nodeId)) {
            stations.forEach(station => {
              if (!chargingStops.some(stop => stop.stationId === station.id) &&
                  !additionalChargingStops.some(stop => stop.stationId === station.id)) {
                additionalChargingStops.push({
                  nodeId: nodeId,
                  stationId: station.id,
                  stationName: station.name,
                  chargingTime: 0,
                  energyAdded: 0,
                  isOptional: true,
                  location: {
                    lat: station.location.lat,
                    lng: station.location.lng
                  }
                });
              }
            });
          }
        });
        
        // Sort additional stops by their position in the path
        additionalChargingStops.sort((a, b) => {
          return path.indexOf(a.nodeId) - path.indexOf(b.nodeId);
        });
        
        // Combine necessary and optional charging stops
        const allChargingStops = [...chargingStops, ...additionalChargingStops];
        
        // Also calculate coordinates for each charging stop
        const stopsWithCoordinates = allChargingStops.map(stop => {
          // Find the node for this stop
          const node = this.nodes.find(n => n.id === stop.nodeId);
          
          // Find the station
          let station = null;
          if (this.nodeToChargingStation[stop.nodeId]) {
            station = this.nodeToChargingStation[stop.nodeId].find(s => s.id === stop.stationId);
          }
          
          return {
            ...stop,
            location: station ? station.location : node.location
          };
        });
        
        // Reconstruct the path and return
        return {
          success: true,
          path: path,
          chargingStops: stopsWithCoordinates,
          totalDistance: gScore[goal],
          estimatedTime: this.calculateTripTime(gScore[goal], chargingStops)
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
        
        // Calculate energy needed for this segment
        const energyNeeded = this.calculateEnergyConsumption(neighbor.distance);
        
        // Calculate remaining battery after movement
        const remainingBattery = batteryLevel[current] - energyNeeded;
        
        // Check if current node has a charging station for possible route adjustments
        let currentNodeHasChargingStation = false;
        if (this.nodeToChargingStation[current]) {
          currentNodeHasChargingStation = true;
          
          // Store as a nearby charging station
          if (!nearbyChargingStations.has(current)) {
            nearbyChargingStations.set(current, this.nodeToChargingStation[current]);
          }
        }
        
        // Initialize tentative gScore
        let tentativeGScore = gScore[current] + neighbor.distance;
        
        // If we don't have enough battery to reach this neighbor
        if (remainingBattery <= 0) {
          // Check if current node has a charging station
          if (currentNodeHasChargingStation) {
            // We can charge here
            const station = this.nodeToChargingStation[current][0]; // Use the first charging station
            
            // Check if any of the station's connector types is compatible with the vehicle
            const compatibleConnector = station.connectorTypes && 
                station.connectorTypes.some(connectorType => 
                    this.vehicle.connectorType === connectorType
                );
            
            if (!compatibleConnector) {
              continue; // Incompatible charging connector, can't use this path
            }
            
            // Calculate energy needed to fully charge
            const energyToCharge = this.vehicle.batteryCapacity - batteryLevel[current];
            const chargingTime = this.calculateChargingTime(energyToCharge, station.chargingSpeed);
            
            // Add charging stop
            const chargingStopExists = chargingStops.some(stop => stop.nodeId === current);
            if (!chargingStopExists) {
              chargingStops.push({
                nodeId: current,
                stationId: station.id,
                stationName: station.name,
                location: station.location,
                chargingTime,
                energyAdded: energyToCharge
              });
            }
            
            // Now we have a full battery
            batteryLevel[current] = this.vehicle.batteryCapacity;
          } else {
            continue; // No charging station and not enough battery, can't use this path
          }
        } 
        // Battery level is getting low (less than 20%), prefer to charge if available
        else if (remainingBattery < (this.vehicle.batteryCapacity * 0.2) && currentNodeHasChargingStation) {
          // There's a charging station here, so let's charge even though we don't absolutely need to
          const station = this.nodeToChargingStation[current][0];
          const energyToCharge = this.vehicle.batteryCapacity - batteryLevel[current];
          const chargingTime = this.calculateChargingTime(energyToCharge, station.chargingSpeed);
          
          // Add charging stop if we haven't already added it
          const chargingStopExists = chargingStops.some(stop => stop.nodeId === current);
          if (!chargingStopExists) {
            chargingStops.push({
              nodeId: current,
              stationId: station.id,
              stationName: station.name,
              location: station.location,
              chargingTime,
              energyAdded: energyToCharge
            });
          }
          
          // Now we have a full battery
          batteryLevel[current] = this.vehicle.batteryCapacity;
          
          // Slightly favor routes that stop at charging stations
          // This gives a small bonus to paths that include charging stations along the way
          // The 0.95 factor means paths with charging stations will be preferred if they're within 5% of the shortest path
          tentativeGScore = gScore[current] + (neighbor.distance * 0.95);
        }
        
        // Slightly favor routes with charging stations (discount their cost a bit)
        if (currentNodeHasChargingStation && remainingBattery >= (this.vehicle.batteryCapacity * 0.2)) {
          // Apply a small discount (5%) to paths that include charging stations
          tentativeGScore = gScore[current] + (neighbor.distance * 0.95);
        }
        
        // Add neighbor to openSet if not there
        if (!openSet.has(neighborId)) {
          openSet.add(neighborId);
        } else if (tentativeGScore >= gScore[neighborId]) {
          // This is not a better path
          continue;
        }
        
        // This path is the best until now. Record it!
        cameFrom[neighborId] = current;
        gScore[neighborId] = tentativeGScore;
        fScore[neighborId] = gScore[neighborId] + this.heuristic(neighborId, goal);
        batteryLevel[neighborId] = remainingBattery;
      }
    }
    
    // If we get here, no path was found
    return {
      success: false,
      error: "No path found with the given constraints"
    };
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
    const chargingTime = chargingStops.reduce((total, stop) => total + stop.chargingTime, 0);
    
    // Add rest time - assume 15 min rest every 2 hours of driving
    const restTime = Math.floor(drivingTime / 2) * 0.25;
    
    return drivingTime + chargingTime + restTime;
  }
}

module.exports = AStar; 