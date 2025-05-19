# EV Trip Planner - Indonesia

An AI-powered electric vehicle trip planning application for Indonesia, focused on implementing AI search algorithms (A*) to find optimal routes through charging stations.

![EV Trip Planner Screenshot](screenshot.png)

## Project Overview

This web application helps users plan trips with electric vehicles across major cities in Indonesia. It uses an A* search algorithm to find optimal routes while accounting for:

- Battery range limitations
- Charging station locations and compatibility
- Required charging times
- Rest stops recommendations

The project implements a full-stack web application with:
- Backend: Node.js with Express
- Frontend: HTML, CSS, JavaScript with LeafletJS for mapping

## Key Features

- Interactive map showing roads, cities, and charging stations in Indonesia
- Selection of different electric vehicle models with varying specifications
- AI-powered route planning that considers battery constraints
- Charging and rest stop recommendations
- Animated visualization of the vehicle traveling along the route
- Detailed trip information including distance, time, and charging stops

## AI Search Implementation

The core of this project is the A* search algorithm implementation, which:

1. Uses a heuristic function (straight-line distance) for optimizing the search
2. Considers battery consumption based on distance and vehicle efficiency
3. Plans stops at charging stations when necessary
4. Handles constraints like connector compatibility between vehicles and charging stations
5. Calculates charging times based on battery needs and charging speeds
6. Optimizes for both shortest distance and time (including charging time)

## Getting Started

### Prerequisites

- Node.js (v14+ recommended)
- npm (v6+ recommended)

### Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/EV-Trip-Planner.git
cd EV-Trip-Planner
```

2. Install dependencies:
```
npm install
```

3. Start the development server:
```
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure

```
EV-Trip-Planner/
├── public/                 # Static files
│   ├── css/                # Stylesheets
│   ├── js/                 # Frontend JavaScript
│   └── index.html          # Main HTML file
├── src/                    # Source code
│   ├── backend/            # Backend server code
│   │   ├── routes.js       # API routes
│   │   └── server.js       # Express server
│   ├── data/               # Sample data
│   │   ├── charging-stations.json
│   │   ├── road-network.json
│   │   └── vehicles.json
│   └── models/             # AI algorithms
│       └── astar.js        # A* search implementation
├── package.json            # Project dependencies
└── README.md               # Documentation
```

## Usage

1. Select an electric vehicle from the dropdown
2. Choose a starting location
3. Choose a destination
4. Click "Plan Trip"
5. View the optimal route with charging stops on the map
6. Examine the detailed trip information in the sidebar

## Future Enhancements

- Add more detailed road network data for Indonesia
- Implement additional search algorithms (Dijkstra's, Bidirectional search)
- Integrate real-time traffic data
- Support for more detailed vehicle specifications
- User authentication and saved routes
- Mobile application version

## License

This project is licensed under the MIT License

## Acknowledgments

- This project was created as part of AI course requirements
- Special thanks to the contributors and instructors