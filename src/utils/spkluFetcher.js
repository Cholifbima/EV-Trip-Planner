/**
 * Utility untuk mencari semua SPKLU di Indonesia menggunakan grid-based search
 * untuk mengatasi batasan radius Google Places API
 */
const axios = require('axios');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// Boundary koordinat Indonesia
const INDONESIA_BOUNDS = {
  north: 6,    // Batas utara (sekitar Aceh)
  south: -11,  // Batas selatan (sekitar Pulau Rote)
  east: 141,   // Batas timur (sekitar Papua)
  west: 95     // Batas barat (sekitar Sabang)
};

// Ukuran grid dalam derajat (sekitar 50-100km)
const GRID_SIZE = 1;

// Path untuk file penyimpanan data SPKLU
const DATA_FILE_PATH = path.join(__dirname, '../../data/spklu-data.json');

// Untuk menyimpan hasil pencarian
let allSPKLU = [];
let isIndexingComplete = false;
let indexingProgress = 0;

// Load data SPKLU dari file saat modul diimpor
loadSPKLUFromFile();

/**
 * Menyimpan data SPKLU ke file
 */
function saveSPKLUToFile() {
  try {
    const dataToSave = {
      stations: allSPKLU,
      lastUpdated: new Date().toISOString()
    };
    
    // Pastikan direktori ada
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Tulis ke file
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(dataToSave, null, 2));
    console.log(`Data SPKLU berhasil disimpan ke ${DATA_FILE_PATH}`);
  } catch (error) {
    console.error('Error menyimpan data SPKLU:', error);
  }
}

/**
 * Muat data SPKLU dari file
 */
function loadSPKLUFromFile() {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8'));
      
      if (data && data.stations && Array.isArray(data.stations)) {
        allSPKLU = data.stations;
        isIndexingComplete = true;
        indexingProgress = 100;
        
        console.log(`Data SPKLU dimuat dari file: ${allSPKLU.length} stasiun ditemukan`);
        console.log(`Terakhir diperbarui: ${data.lastUpdated || 'Tidak diketahui'}`);
      }
    } else {
      console.log('Tidak ada file data SPKLU yang tersimpan. Gunakan fitur "Index All SPKLU" untuk memulai.');
    }
  } catch (error) {
    console.error('Error memuat data SPKLU:', error);
  }
}

/**
 * Bagi peta Indonesia menjadi beberapa grid
 * @returns {Array} Array of grid bounds {north, south, east, west}
 */
function createGrids() {
  const grids = [];
  
  for (let lat = INDONESIA_BOUNDS.south; lat < INDONESIA_BOUNDS.north; lat += GRID_SIZE) {
    for (let lng = INDONESIA_BOUNDS.west; lng < INDONESIA_BOUNDS.east; lng += GRID_SIZE) {
      const grid = {
        north: Math.min(lat + GRID_SIZE, INDONESIA_BOUNDS.north),
        south: lat,
        east: Math.min(lng + GRID_SIZE, INDONESIA_BOUNDS.east),
        west: lng
      };
      
      grids.push(grid);
    }
  }
  
  return grids;
}

/**
 * Cari SPKLU dalam satu grid
 * @param {Object} grid - Grid bounds {north, south, east, west}
 * @returns {Promise<Array>} SPKLU dalam grid tersebut
 */
async function searchSPKLUInGrid(grid) {
  try {
    // Calculate center of grid
    const center = {
      lat: (grid.north + grid.south) / 2,
      lng: (grid.east + grid.west) / 2
    };
    
    // Calculate radius (approximate)
    const earthRadius = 6371000; // meters
    const latDiff = Math.abs(grid.north - grid.south) * Math.PI / 180;
    const lngDiff = Math.abs(grid.east - grid.west) * Math.PI / 180;
    const latDistance = latDiff * earthRadius;
    const lngDistance = lngDiff * earthRadius * Math.cos(center.lat * Math.PI / 180);
    const radius = Math.min(Math.max(latDistance, lngDistance) / 2, 50000); // max 50km
    
    // Make API call
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        key: config.googleMapsApiKey,
        location: `${center.lat},${center.lng}`,
        radius: radius,
        keyword: 'SPKLU OR EV charging station OR stasiun pengisian kendaraan listrik',
        type: 'point_of_interest'
      }
    });
    
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', response.data.status);
      return [];
    }
    
    // Transform to our format
    return response.data.results.map(place => {
      // Basic info
      let chargingSpeed = 50; // default
      let connectorTypes = ["CCS", "CHAdeMO"]; // default
      
      // Extract from name if possible
      if (place.name.toLowerCase().includes('fast') || place.name.toLowerCase().includes('cepat')) {
        chargingSpeed = 100;
      }
      
      if (place.name.toLowerCase().includes('type 2') || place.name.toLowerCase().includes('tipe 2')) {
        connectorTypes.push("Type 2");
      }
      
      // Map amenities based on types
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
  } catch (error) {
    console.error('Error searching SPKLU in grid:', error);
    return [];
  }
}

/**
 * Mulai proses pencarian SPKLU di seluruh Indonesia
 * Proses ini berjalan di background
 */
async function startIndexingAllSPKLU() {
  if (!config.googleMapsApiKey) {
    console.error('Google Maps API key tidak terkonfigurasi');
    return;
  }
  
  // Reset state
  allSPKLU = [];
  isIndexingComplete = false;
  indexingProgress = 0;
  
  // Create grids
  const grids = createGrids();
  const totalGrids = grids.length;
  
  console.log(`Mulai mengindeks SPKLU di seluruh Indonesia (${totalGrids} grid)`);
  
  // Process each grid with delay to avoid rate limiting
  for (let i = 0; i < grids.length; i++) {
    try {
      const grid = grids[i];
      const results = await searchSPKLUInGrid(grid);
      
      // Add to collection, filter out duplicates
      const uniqueResults = results.filter(newSpklu => 
        !allSPKLU.some(existing => existing.id === newSpklu.id)
      );
      
      allSPKLU = [...allSPKLU, ...uniqueResults];
      
      // Update progress
      indexingProgress = Math.min(100, Math.round((i + 1) / totalGrids * 100));
      
      console.log(`Mengindeks grid ${i+1}/${totalGrids} (${indexingProgress}%): Menemukan ${uniqueResults.length} SPKLU baru (Total: ${allSPKLU.length})`);
      
      // Save data every 10% progress
      if (i % Math.floor(totalGrids / 10) === 0) {
        saveSPKLUToFile();
      }
      
      // Add delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing grid ${i}:`, error);
    }
  }
  
  console.log(`Indexing selesai. Total SPKLU ditemukan: ${allSPKLU.length}`);
  isIndexingComplete = true;
  
  // Simpan hasil akhir
  saveSPKLUToFile();
}

/**
 * Dapatkan semua SPKLU yang sudah diindex
 */
function getAllSPKLU() {
  return {
    stations: allSPKLU,
    isComplete: isIndexingComplete,
    progress: indexingProgress
  };
}

module.exports = {
  startIndexingAllSPKLU,
  getAllSPKLU,
  isIndexingComplete: () => isIndexingComplete,
  getIndexingProgress: () => indexingProgress,
  saveSPKLUToFile,
  loadSPKLUFromFile
}; 