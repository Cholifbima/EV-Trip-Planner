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
   * Search for SPKLU (EV charging stations) using Google Places API
   * @param {Object} bounds - Map bounds {north, south, east, west}
   * @returns {Promise<Array>} - Array of SPKLU stations
   */
  async searchSPKLUFromGoogle(bounds) {
    try {
      const response = await fetch(`${this.baseUrl}/search-spklu-google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bounds })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search SPKLU');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error searching for SPKLU:', error);
      throw error;
    }
  }

  /**
   * Start indexing all SPKLU in Indonesia
   * @returns {Promise<Object>} - Status of the indexing process
   */
  async startSPKLUIndexing() {
    try {
      const response = await fetch(`${this.baseUrl}/start-spklu-indexing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start SPKLU indexing');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error starting SPKLU indexing:', error);
      throw error;
    }
  }

  /**
   * Get all indexed SPKLU in Indonesia
   * @returns {Promise<Object>} - All SPKLU data and indexing status
   */
  async getAllSPKLU() {
    try {
      const response = await fetch(`${this.baseUrl}/all-spklu`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch all SPKLU');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching all SPKLU:', error);
      throw error;
    }
  }

  /**
   * Get the progress of SPKLU indexing
   * @returns {Promise<Object>} - Indexing progress
   */
  async getSPKLUIndexingProgress() {
    try {
      const response = await fetch(`${this.baseUrl}/spklu-indexing-progress`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch indexing progress');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching indexing progress:', error);
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

  /**
   * Get the URL for a SPKLU photo
   * @param {string} photoReference - The photo reference ID from Google Places API
   * @param {number} maxWidth - Maximum width of the photo (optional)
   * @returns {string} - URL to the photo
   */
  getSpkluPhotoUrl(photoReference, maxWidth = 400) {
    if (!photoReference) return null;
    return `${this.baseUrl}/spklu-photo/${photoReference}?maxwidth=${maxWidth}`;
  }
}

// Create a global instance of the API client
const api = new ApiClient(); 