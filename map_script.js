// map_script.js

document.addEventListener('DOMContentLoaded', function () {
    console.log("MAP_SCRIPT.JS: DOMContentLoaded event fired, script starting."); 

    const mapElement = document.getElementById('weatherMap');
    let leafletMap; 
    let radarLayer; 

    if (mapElement) {
        console.log("MAP_SCRIPT.JS: 'weatherMap' element found.");
        try {
            leafletMap = L.map('weatherMap').setView([39.8283, -98.5795], 4); 

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMap);

            console.log("Leaflet map initialized successfully on 'weatherMap' div.");
            
            console.log("MAP_SCRIPT.JS: About to call fetchRainViewerData().");
            fetchRainViewerData(); 
        } catch (leafletError) {
            console.error("MAP_SCRIPT.JS: Error during Leaflet map initialization:", leafletError);
        }

    } else {
        console.error("Map container div with ID 'weatherMap' not found in the DOM.");
    }

    async function fetchRainViewerData() {
        console.log("MAP_SCRIPT.JS: fetchRainViewerData() function has STARTED."); 

        const mapDescription = document.querySelector('.map-description');
        let statusMessageElement = document.getElementById('radar-status-message');
        if (!statusMessageElement && mapDescription) {
            statusMessageElement = document.createElement('p');
            statusMessageElement.id = 'radar-status-message';
            mapDescription.appendChild(statusMessageElement);
        }
        
        function updateStatusMessage(message, type = 'info') {
            if (statusMessageElement) {
                statusMessageElement.textContent = message;
                statusMessageElement.style.color = type === 'error' ? 'red' : (type === 'warning' ? 'orange' : 'inherit');
            }
            if (type === 'error') console.error("Radar Status:", message);
            else if (type === 'warning') console.warn("Radar Status:", message);
            else console.log("Radar Status:", message);
        }

        try {
            updateStatusMessage("Fetching radar availability...", "info");
            console.log("MAP_SCRIPT.JS: fetchRainViewerData() - About to fetch maps.json"); 
            const response = await fetch('https://api.rainviewer.com/public/maps.json'); // Assuming this now returns an array of timestamps
            console.log("MAP_SCRIPT.JS: fetchRainViewerData() - maps.json fetch response status:", response.status); 
            
            if (!response.ok) {
                throw new Error(`RainViewer API error: ${response.status} ${response.statusText}`);
            }
            const timestampsArray = await response.json(); // Expecting an array directly
            console.log("MAP_SCRIPT.JS: Raw RainViewer API Data (expected array of timestamps):", JSON.stringify(timestampsArray, null, 2));

            const currentTimeSeconds = Math.floor(Date.now() / 1000);
            const oneHourInSeconds = 60 * 60;
            const twoDaysInSeconds = 2 * 24 * 60 * 60;
            const rainviewerHost = "https://tilecache.rainviewer.com"; // Hardcode host as it's not in the simple array response

            if (Array.isArray(timestampsArray) && timestampsArray.length > 0) {
                // Sort timestamps just in case, and pick the largest (most recent) valid one
                const validTimestamps = timestampsArray
                    .filter(ts => typeof ts === 'number' && ts < (currentTimeSeconds + oneHourInSeconds) && ts > (currentTimeSeconds - twoDaysInSeconds) )
                    .sort((a, b) => a - b); // Sort ascending

                if (validTimestamps.length > 0) {
                    const latestTimestamp = validTimestamps[validTimestamps.length - 1]; // Get the most recent valid timestamp

                    console.log("MAP_SCRIPT.JS: Using RainViewer latest valid timestamp:", latestTimestamp, `(${new Date(latestTimestamp * 1000).toUTCString()})`);
                    
                    addRadarLayer({ timestamp: latestTimestamp, host: rainviewerHost });
                    updateStatusMessage(`Displaying radar from: ${new Date(latestTimestamp * 1000).toLocaleTimeString()}`, "info");
                } else {
                    console.warn("MAP_SCRIPT.JS: No recent/valid timestamps found in the array from RainViewer.");
                    updateStatusMessage('No current or recent radar data available from provider.', 'warning');
                }
            } else {
                console.warn("MAP_SCRIPT.JS: No timestamps available or data is not an array from RainViewer.");
                updateStatusMessage('No current radar data available from provider.', 'warning');
            }

        } catch (error) {
            console.error("MAP_SCRIPT.JS: Error in fetchRainViewerData's try block:", error.message, error.stack);
            updateStatusMessage(`Could not load radar data: ${error.message}`, 'error');
        }
        console.log("MAP_SCRIPT.JS: fetchRainViewerData() function has FINISHED.");
    }

    /**
     * Adds or updates the radar layer on the map.
     * @param {object} layerInfo - Information about the layer.
     * @param {number} layerInfo.timestamp - Unix timestamp for the radar data.
     * @param {string} layerInfo.host - The host URL for tiles (e.g., "https://tilecache.rainviewer.com").
     */
    function addRadarLayer(layerInfo) {
        if (!leafletMap || !layerInfo || !layerInfo.host || typeof layerInfo.timestamp !== 'number') {
            console.error("MAP_SCRIPT.JS: Cannot add radar layer: map or layer info/host/timestamp missing or invalid.");
            return;
        }

        if (radarLayer) {
            leafletMap.removeLayer(radarLayer);
        }

        // Construct URL based on timestamp (since we are assuming a simple array of timestamps now)
        const radarTileUrl = `${layerInfo.host}/v2/radar/${layerInfo.timestamp}/{z}/{x}/{y}/256/1_1.png`;
        console.log("MAP_SCRIPT.JS: Using radar tile URL:", radarTileUrl);
        
        radarLayer = L.tileLayer(radarTileUrl, {
            tileSize: 256,
            opacity: 0.7, 
            attribution: '| Radar <a href="https://www.rainviewer.com/terms-of-use.html" target="_blank">RainViewer</a>',
            zIndex: 10 
        });

        radarLayer.on('tileerror', function(event) {
            console.warn('MAP_SCRIPT.JS: Radar Tile Error:', event.tile, event.error);
        });
        radarLayer.on('load', function() {
            console.log("MAP_SCRIPT.JS: Radar tiles loaded for this view.");
        });

        radarLayer.addTo(leafletMap);
        console.log(`MAP_SCRIPT.JS: RainViewer radar layer added for time: ${new Date(layerInfo.timestamp * 1000).toUTCString()}`);
    }
});