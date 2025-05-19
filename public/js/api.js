/**
 * API client for the EV Trip Planner
 */
class ApiClient {
  constructor() {
    this.baseUrl = '/api';
  }

  /**
   * Get all available vehicles
   * @returns {Promise<Array>} - Array of vehicles
   */
  async getVehicles() {
    try {
      const response = await fetch(`${this.baseUrl}/vehicles`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      throw error;
    }
  }

  /**
   * Get all cities (nodes in the road network)
   * @returns {Promise<Array>} - Array of cities
   */
  async getCities() {
    try {
      const response = await fetch(`${this.baseUrl}/cities`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cities');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching cities:', error);
      throw error;
    }
  }

  /**
   * Get all charging stations
   * @returns {Promise<Array>} - Array of charging stations
   */
  async getChargingStations() {
    try {
      const response = await fetch(`${this.baseUrl}/charging-stations`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch charging stations');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching charging stations:', error);
      throw error;
    }
  }

  /**
   * Plan a trip with the given parameters
   * @param {string} vehicleId - The ID of the selected vehicle
   * @param {string} startCity - The ID of the start city
   * @param {string} endCity - The ID of the destination city
   * @returns {Promise<Object>} - Trip planning result
   */
  async planTrip(vehicleId, startCity, endCity) {
    try {
      const response = await fetch(`${this.baseUrl}/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vehicleId,
          startCity,
          endCity
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to plan trip');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error planning trip:', error);
      throw error;
    }
  }
}

// Create a global instance of the API client
const api = new ApiClient(); 