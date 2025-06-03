// script.js (Frontend code for Index.html)

document.addEventListener('DOMContentLoaded', function() {
    if (typeof CONFIG === 'undefined' || !CONFIG.PROXY_API_BASE_URL) {
        const weatherInfoDiv = document.getElementById('weather-info');
        if (weatherInfoDiv) {
            weatherInfoDiv.innerHTML = '<p id="status" class="error">Error: Configuration not loaded (PROXY_API_BASE_URL missing).</p>';
        }
        console.error("CONFIG object not found or PROXY_API_BASE_URL missing.");
        return;
    }
    const PROXY_API_BASE_URL = CONFIG.PROXY_API_BASE_URL;
    const AI_ENABLED = CONFIG.AI_FEATURES_ENABLED;

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe.replace(/[&<>"']/g, function (match) {
            switch (match) {
                case '&':
                    return '&';
                case '<':
                    return '<';
                case '>':
                    return '>';
                case '"':
                    return '"';
                case "'":
                    return "'"; // or '''
                default:
                    return match;
            }
        });
    }

    const locationInput = document.getElementById('locationInput');
    const getWeatherButton = document.getElementById('getWeatherButton');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const weatherInfoDiv = document.getElementById('weather-info');
    const initialStatusP = document.getElementById('status');
    const nwsCurrentWeatherContent = document.getElementById('nws-current-weather-content');
    const contextualLinksDiv = document.getElementById('contextual-links');

    const aiInsightsContainer = document.getElementById('ai-weather-insights-container');
    const aiInsightsContent = document.getElementById('ai-insights-content');
    const aiInsightsStatus = document.getElementById('ai-insights-status');
    const getAiInsightsButton = document.getElementById('getAiInsightsButton');
    const headerElement = document.querySelector('header');

    const LAST_SEARCH_KEY_NWS = 'weatherNowLastSearchNWS';
    let debounceTimer;
    let currentHourlyForecastUrl = null;
    let currentLatitude = null;
    let currentLongitude = null;
    let currentDisplayName = null;
    let lastWeatherDataForAI = null; // This will hold the full currentPeriod object
    let lastLocationNameForAI = null;

    function showLoading(message, targetElement = weatherInfoDiv) {
        if (targetElement === weatherInfoDiv && initialStatusP) {
            if (nwsCurrentWeatherContent) nwsCurrentWeatherContent.innerHTML = '';
            if (contextualLinksDiv) contextualLinksDiv.innerHTML = '';
            if (aiInsightsContainer) aiInsightsContainer.style.display = 'none';
            initialStatusP.textContent = escapeHtml(message) || 'Loading...';
            initialStatusP.className = 'loading';
            initialStatusP.style.display = 'block';
        } else if (targetElement) { 
             targetElement.innerHTML = `<p class="loading">${escapeHtml(message) || 'Loading...'}</p>`;
        }
        if (weatherInfoDiv) weatherInfoDiv.classList.add('loading-weather');
    }

    function clearLoading(targetElement = weatherInfoDiv) {
        if (weatherInfoDiv) weatherInfoDiv.classList.remove('loading-weather');
         if (targetElement === weatherInfoDiv && initialStatusP) {
            if ((!nwsCurrentWeatherContent || !nwsCurrentWeatherContent.hasChildNodes()) && 
                (!contextualLinksDiv || !contextualLinksDiv.hasChildNodes()) &&
                (!aiInsightsContainer || aiInsightsContainer.style.display === 'none')) {
                 initialStatusP.textContent = 'Weather information will appear here.';
                 initialStatusP.className = '';
            } else {
                initialStatusP.style.display = 'none';
            }
        }
    }
    
    function showNwsError(message) {
        if (nwsCurrentWeatherContent) nwsCurrentWeatherContent.innerHTML = '';
        if (contextualLinksDiv) contextualLinksDiv.innerHTML = '';
        if (aiInsightsContainer) aiInsightsContainer.style.display = 'none';
        if (initialStatusP) {
            initialStatusP.textContent = `Error: ${escapeHtml(message)}`;
            initialStatusP.className = 'error';
            initialStatusP.style.display = 'block';
        }
        updateHeaderBackground({ shortForecast: "default", isDaytime: true }, true); // Pass a default object
    }

    function updateAllNavLinks(latitude, longitude, displayName) {
        const navHourly = document.getElementById('nav-hourly');
        const navAlerts = document.getElementById('nav-alerts');
        const navMaps = document.getElementById('nav-maps');

        if (latitude && longitude && displayName) {
            const encodedName = encodeURIComponent(displayName);
            const lat = encodeURIComponent(latitude);
            const lon = encodeURIComponent(longitude);

            if (navHourly) navHourly.href = `hourly_forecast.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
            if (navAlerts) navAlerts.href = `alerts.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
            if (navMaps) navMaps.href = `maps.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
        } else { 
            if (navHourly) navHourly.href = 'hourly_forecast.html';
            if (navAlerts) navAlerts.href = 'alerts.html';
            if (navMaps) navMaps.href = 'maps.html';
        }
    }

    function saveLastSearch(latitude, longitude, displayName) {
        try {
            localStorage.setItem(LAST_SEARCH_KEY_NWS, JSON.stringify({ latitude, longitude, displayName }));
            updateAllNavLinks(latitude, longitude, displayName);
        } catch (e) {
            console.warn("Could not save last NWS search to localStorage:", e);
        }
    }

    function loadLastSearch() {
        const urlParams = new URLSearchParams(window.location.search);
        const latParam = urlParams.get('lat');
        const lonParam = urlParams.get('lon');
        const nameParam = urlParams.get('name');

        if (latParam && lonParam && nameParam) {
            currentLatitude = latParam;
            currentLongitude = lonParam;
            currentDisplayName = decodeURIComponent(nameParam);
            if (locationInput) locationInput.value = currentDisplayName;
            showLoading(`Loading weather for ${escapeHtml(currentDisplayName)}...`);
            fetchNwsPointData(currentLatitude, currentLongitude, currentDisplayName);
            return; 
        }
        
        try {
            const lastSearch = localStorage.getItem(LAST_SEARCH_KEY_NWS);
            if (lastSearch) {
                const { latitude, longitude, displayName } = JSON.parse(lastSearch);
                if (latitude && longitude && displayName) {
                    currentLatitude = latitude;
                    currentLongitude = longitude;
                    currentDisplayName = displayName;
                    if (locationInput) locationInput.value = displayName;
                    showLoading(`Loading weather for last searched: ${escapeHtml(displayName)}...`);
                    fetchNwsPointData(latitude, longitude, displayName);
                } else { // If localStorage data is incomplete
                    updateHeaderBackground({ shortForecast: "default", isDaytime: true }, true);
                    if(initialStatusP) initialStatusP.textContent = "Enter a location above to see the weather.";
                    updateAllNavLinks(null, null, null);
                }
            } else {
                updateHeaderBackground({ shortForecast: "default", isDaytime: true }, true);
                if (initialStatusP) {
                    initialStatusP.textContent = "Enter a location above to see the weather.";
                    initialStatusP.style.display = 'block';
                }
                updateAllNavLinks(null, null, null);
            }
        } catch (e) {
            console.error("Could not load last NWS search from localStorage:", e);
            updateHeaderBackground({ shortForecast: "default", isDaytime: true }, true);
            if (initialStatusP) {
                initialStatusP.textContent = "Error loading last search. Please enter a location.";
                initialStatusP.className = 'error';
                initialStatusP.style.display = 'block';
            }
            updateAllNavLinks(null, null, null);
        }
    }

    async function searchLocationsViaPositionstack(query) {
        console.log("searchLocationsViaPositionstack called with query:", query);
        const locationQuery = query.trim();
        if (!locationQuery) {
            console.log("Query is empty, returning.");
            if (suggestionsContainer) suggestionsContainer.innerHTML = '';
            return;
        }
        showLoading('Searching for location...');
        if (suggestionsContainer) suggestionsContainer.innerHTML = '';
        const positionstackApiUrl = `${PROXY_API_BASE_URL}/geocode/positionstack?query=${encodeURIComponent(locationQuery)}`;

        try {
            const response = await fetch(positionstackApiUrl); 
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); 
                throw new Error(errorData.details || errorData.error || `Positionstack API request failed: ${response.status}`);
            }
            const result = await response.json();
            if (!result || !result.data || result.data.length === 0) {
                throw new Error("Location not found via Positionstack.");
            }
            
            if (result.data.length === 1) {
                const loc = result.data[0];
                currentLatitude = loc.latitude;
                currentLongitude = loc.longitude;
                currentDisplayName = loc.label || `${loc.name}, ${loc.region || loc.county}, ${loc.country}`;
                clearLoading(); 
                showLoading(`Found ${escapeHtml(currentDisplayName)}. Getting NWS forecast point...`);
                await fetchNwsPointData(loc.latitude, loc.longitude, currentDisplayName);
            } else {
                displayPositionstackSuggestions(result.data);
                clearLoading();
                if (initialStatusP) {
                    initialStatusP.textContent = 'Please select a location from the suggestions above.';
                    initialStatusP.className = '';
                    initialStatusP.style.display = 'block';
                }
                if (nwsCurrentWeatherContent) nwsCurrentWeatherContent.innerHTML = '';
                if (contextualLinksDiv) contextualLinksDiv.innerHTML = '';
                if (aiInsightsContainer) aiInsightsContainer.style.display = 'none';
                updateAllNavLinks(null, null, null);
            }
        } catch (error) {
            console.error("Positionstack Search Error:", error);
            showNwsError(`Location Search Error: ${error.message}`);
            if (suggestionsContainer) suggestionsContainer.innerHTML = '';
            updateAllNavLinks(null, null, null);
        }
    }

    function displayPositionstackSuggestions(locations) {
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '<p><strong>Did you mean:</strong></p>';
        locations.slice(0, 5).forEach(loc => {
            const displayName = loc.label || `${loc.name}, ${loc.region || loc.county}, ${loc.country}`;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'suggestion-item';
            itemDiv.dataset.latitude = loc.latitude;
            itemDiv.dataset.longitude = loc.longitude;
            itemDiv.dataset.label = displayName;
            itemDiv.textContent = displayName;
            itemDiv.setAttribute('role', 'button');
            itemDiv.tabIndex = 0;
            itemDiv.addEventListener('click', handlePositionstackSuggestionSelect);
            itemDiv.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && handlePositionstackSuggestionSelect.call(itemDiv));
            suggestionsContainer.appendChild(itemDiv);
        });
    }

    async function handlePositionstackSuggestionSelect() {
        if (suggestionsContainer) suggestionsContainer.innerHTML = '';
        const selectedLatitude = this.dataset.latitude;
        const selectedLongitude = this.dataset.longitude;
        const selectedLabel = this.dataset.label;

        if (locationInput) locationInput.value = selectedLabel;
        currentLatitude = selectedLatitude;
        currentLongitude = selectedLongitude;
        currentDisplayName = selectedLabel;

        showLoading(`Fetching NWS forecast point for ${escapeHtml(selectedLabel)}`);
        await fetchNwsPointData(selectedLatitude, selectedLongitude, selectedLabel);
    }

    async function fetchNwsPointData(latitude, longitude, displayName) {
        const lat = parseFloat(latitude).toFixed(4);
        const lon = parseFloat(longitude).toFixed(4);
        currentLatitude = latitude; 
        currentLongitude = longitude;
        currentDisplayName = displayName;

        showLoading(`Fetching NWS forecast information for ${escapeHtml(displayName)}`);
        const nwsPointsUrl = `${PROXY_API_BASE_URL}/nws/points/${lat},${lon}`;

        try {
            const response = await fetch(nwsPointsUrl); 
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.message || `NWS Points API request failed: ${response.status}`);
            }
            const pointData = await response.json();

            if (!pointData.properties || !pointData.properties.forecastHourly || !pointData.properties.forecast) {
                throw new Error("NWS point data is incomplete. Hourly or main forecast URL missing.");
            }
            
            currentHourlyForecastUrl = pointData.properties.forecastHourly;
            const forecastUrlToFetch = pointData.properties.forecast;

            showLoading(`Fetching current weather for ${escapeHtml(displayName)}`);
            await fetchNwsForecast(forecastUrlToFetch, displayName, latitude, longitude);
            saveLastSearch(latitude, longitude, displayName); 

        } catch (error) {
            console.error("NWS Point Data Error:", error);
            showNwsError(`NWS Point Data Error: ${error.message}. Please try a different location or check if NWS covers this area.`);
            updateAllNavLinks(null, null, null);
        }
    }

    async function fetchNwsForecast(nwsSpecificForecastUrl, displayName, lat, lon) {
        const proxyForecastUrl = `${PROXY_API_BASE_URL}/nws/forecast?url=${encodeURIComponent(nwsSpecificForecastUrl)}`;
        try {
            const response = await fetch(proxyForecastUrl); 
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.message || `NWS Forecast API request failed: ${response.status}`);
            }
            const forecastData = await response.json();

            if (!forecastData.properties || !forecastData.properties.periods || forecastData.properties.periods.length === 0) {
                throw new Error("No forecast periods found in NWS data.");
            }
            
            clearLoading(); 
            lastWeatherDataForAI = forecastData.properties.periods[0]; // Store the full period data
            displayNwsCurrentWeather(lastWeatherDataForAI, displayName, lat, lon);
        } catch (error) {
            console.error("NWS Forecast Fetch Error:", error);
            showNwsError(`NWS Forecast Error: ${error.message}`);
            updateAllNavLinks(null, null, null);
        }
    }

    function displayNwsCurrentWeather(currentPeriod, locationName, lat, lon) {
        const safeLocationName = escapeHtml(locationName);
        
        console.log("NWS API raw icon value (current):", currentPeriod.icon);
        const iconUrlFromAPI = currentPeriod.icon;
        let finalIconUrl = ''; // Default to empty or a placeholder
        const desiredSize = 'medium';

        if (iconUrlFromAPI && typeof iconUrlFromAPI === 'string') {
            if (iconUrlFromAPI.startsWith('https://api.weather.gov/icons/')) {
                let baseUrl = iconUrlFromAPI;
                const queryStartIndex = baseUrl.indexOf('?');
                if (queryStartIndex !== -1) {
                    baseUrl = baseUrl.substring(0, queryStartIndex);
                }
                finalIconUrl = `${baseUrl}?size=${desiredSize}`;
            } else if (iconUrlFromAPI.startsWith('/icons/')) {
                let partialPath = iconUrlFromAPI;
                const queryStartIndex = partialPath.indexOf('?');
                if (queryStartIndex !== -1) {
                    partialPath = partialPath.substring(0, queryStartIndex);
                }
                finalIconUrl = `https://api.weather.gov${partialPath}?size=${desiredSize}`;
            } else if (iconUrlFromAPI.trim() !== '') {
                console.warn(`Received an unexpected icon format (current): "${iconUrlFromAPI}". Assuming land/day.`);
                // Basic assumption, might need adjustment based on actual short codes if NWS sends them
                const timeOfDay = currentPeriod.isDaytime ? 'day' : 'night';
                finalIconUrl = `https://api.weather.gov/icons/land/${timeOfDay}/${iconUrlFromAPI.split(' ').join('_').toLowerCase()}?size=${desiredSize}`;
            }
        } else {
            console.error("Icon URL from NWS for current period is missing or not a string.");
        }
        console.log("Constructed finalIconUrl (current):", finalIconUrl);

        let nwsWeatherHtml = `<h3>Current Weather for ${safeLocationName}</h3>`;
        nwsWeatherHtml += `<p><strong>${escapeHtml(currentPeriod.name)}</strong></p>`;
        if (finalIconUrl) { // Only add img tag if URL is valid
            nwsWeatherHtml += `<p>
                        <img src="${finalIconUrl}" alt="${escapeHtml(currentPeriod.shortForecast)}" title="${escapeHtml(currentPeriod.shortForecast)}" style="width:50px; height:auto; vertical-align:middle;">
                        <strong>${escapeHtml(String(currentPeriod.temperature))}°${escapeHtml(currentPeriod.temperatureUnit)}</strong> - ${escapeHtml(currentPeriod.shortForecast)}
                     </p>`;
        } else { // Fallback if no icon
            nwsWeatherHtml += `<p><strong>${escapeHtml(String(currentPeriod.temperature))}°${escapeHtml(currentPeriod.temperatureUnit)}</strong> - ${escapeHtml(currentPeriod.shortForecast)}</p>`;
        }
        nwsWeatherHtml += `<p>Wind: ${escapeHtml(currentPeriod.windSpeed)} from ${escapeHtml(currentPeriod.windDirection)}</p>`;
        if (currentPeriod.relativeHumidity && currentPeriod.relativeHumidity.value !== null) {
             nwsWeatherHtml += `<p>Humidity: ${escapeHtml(String(currentPeriod.relativeHumidity.value))}%</p>`;
        }
        nwsWeatherHtml += `<p><em>${escapeHtml(currentPeriod.detailedForecast)}</em></p>`;
        
        if (nwsCurrentWeatherContent) nwsCurrentWeatherContent.innerHTML = nwsWeatherHtml;
        
        if (contextualLinksDiv) {
            contextualLinksDiv.innerHTML = ''; 

            const latParamEnc = encodeURIComponent(currentLatitude); 
            const lonParamEnc = encodeURIComponent(currentLongitude);
            const nameParamEnc = encodeURIComponent(currentDisplayName);

            if (currentHourlyForecastUrl) { 
                const hourlyLink = document.createElement('a');
                hourlyLink.href = `hourly_forecast.html?lat=${latParamEnc}&lon=${lonParamEnc}&name=${nameParamEnc}`;
                hourlyLink.className = 'button-like-link';
                hourlyLink.textContent = 'View Hourly Forecast »';
                hourlyLink.style.marginRight = "10px"; 
                contextualLinksDiv.appendChild(hourlyLink);
            }

            const alertsLink = document.createElement('a');
            alertsLink.href = `alerts.html?lat=${latParamEnc}&lon=${lonParamEnc}&name=${nameParamEnc}`;
            alertsLink.className = 'button-like-link';
            alertsLink.textContent = 'View Active Alerts »';
            contextualLinksDiv.appendChild(alertsLink);
        }
        
        if (initialStatusP) initialStatusP.style.display = 'none';
        updateAllNavLinks(lat, lon, locationName); 

        if (AI_ENABLED && aiInsightsContainer) {
            // lastWeatherDataForAI is already set before this function is called
            lastLocationNameForAI = locationName; // Update location name for AI
            fetchAIWeatherInsights(lastWeatherDataForAI, lastLocationNameForAI);
        } else if (aiInsightsContainer) {
            aiInsightsContainer.style.display = 'none';
        }
        // Pass the full currentPeriod object to updateHeaderBackground
        updateHeaderBackground(currentPeriod); 
    }

    async function fetchAIWeatherInsights(weatherData, locName) {
        // ... (fetchAIWeatherInsights function remains largely the same as before) ...
        if (!AI_ENABLED || !aiInsightsContainer) {
            if (aiInsightsContainer) aiInsightsContainer.style.display = 'none';
            return;
        }
        if (!PROXY_API_BASE_URL) {
            console.warn("Proxy API base URL not configured. AI insights disabled.");
            if (aiInsightsContainer) aiInsightsContainer.style.display = 'none';
            return;
        }
        if (!weatherData || !locName) {
            console.warn("Missing weather data or location name for AI insights.");
            if (aiInsightsContainer) aiInsightsContainer.style.display = 'none';
            return;
        }

        aiInsightsContainer.style.display = 'block';
        if (aiInsightsContent) aiInsightsContent.innerHTML = '';
        if (aiInsightsStatus) {
            aiInsightsStatus.textContent = 'Generating AI insights...';
            aiInsightsStatus.className = 'loading';
            aiInsightsStatus.style.display = 'block';
        }
        if (getAiInsightsButton) getAiInsightsButton.style.display = 'none';

        try {
            const response = await fetch(`${PROXY_API_BASE_URL}/googleai/generate-insights`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ weatherData: weatherData, locationName: locName }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ details: "Unknown error from AI service" }));
                throw new Error(errorData.details || errorData.error || `AI service request failed: ${response.status}`);
            }

            const data = await response.json();
            const formattedInsights = escapeHtml(data.insights).replace(/\n/g, '<br>');
            if (aiInsightsContent) aiInsightsContent.innerHTML = formattedInsights;
            if (aiInsightsStatus) aiInsightsStatus.style.display = 'none';
            if (getAiInsightsButton) getAiInsightsButton.style.display = 'inline-block';

        } catch (error) {
            console.error("AI Insights Error:", error);
            if (aiInsightsContent) aiInsightsContent.innerHTML = '';
            if (aiInsightsStatus) {
                aiInsightsStatus.textContent = `Error fetching AI insights: ${escapeHtml(error.message)}`;
                aiInsightsStatus.className = 'error';
                aiInsightsStatus.style.display = 'block';
            }
            if (getAiInsightsButton) getAiInsightsButton.style.display = 'inline-block';
        }
    }
    
    // UPDATED updateHeaderBackground to accept the full currentPeriod object
    function updateHeaderBackground(currentPeriodData, forceDefault = false) {
        if (!headerElement) return;
        
        // Reset base class, remove specific weather classes
        headerElement.className = 'header'; // Assuming 'header' is your base class for common header styles

        let cssClassType = 'default'; 
        let animationType = 'default';  

        // Extract shortForecast and isDaytime from the passed object
        // Provide defaults if currentPeriodData or its properties are missing
        const shortForecast = currentPeriodData ? currentPeriodData.shortForecast : null;
        // Default to true if not available, can be refined if night styles are distinct
        const isDaytime = currentPeriodData ? currentPeriodData.isDaytime : true; 

        if (forceDefault || !shortForecast || typeof shortForecast !== 'string') {
            // cssClassType and animationType remain 'default'
        } else {
            const forecastLowerCase = shortForecast.toLowerCase();
            console.log("Updating header for:", forecastLowerCase, "isDaytime:", isDaytime); // Debug

            if (forecastLowerCase.includes('thunderstorm')) {
                cssClassType = 'thunderstorm'; animationType = 'thunderstorm';
            } else if (forecastLowerCase.includes('rain') || forecastLowerCase.includes('shower')) {
                cssClassType = 'rain'; animationType = 'rain';
            } else if (forecastLowerCase.includes('snow') || forecastLowerCase.includes('flurries') || forecastLowerCase.includes('sleet')) {
                cssClassType = 'snow'; animationType = 'snow';
            } else if (forecastLowerCase.includes('fog') || forecastLowerCase.includes('mist') || forecastLowerCase.includes('haze')) {
                cssClassType = 'cloudy'; // Or a new 'fog' class for CSS
                if (forecastLowerCase.includes('dense fog')) animationType = 'dense fog';
                else if (forecastLowerCase.includes('mist')) animationType = 'mist';
                else if (forecastLowerCase.includes('haze')) animationType = 'haze';
                else animationType = 'fog';
            } else if (forecastLowerCase.includes('wind') || forecastLowerCase.includes('breezy')) {
                animationType = 'windy';
                // Determine background based on other conditions mentioned with wind
                if (forecastLowerCase.includes('sunny') || (forecastLowerCase.includes('clear') && isDaytime)) {
                    cssClassType = 'sunny'; 
                } else if (forecastLowerCase.includes('clear') && !isDaytime) {
                    cssClassType = 'default'; // Or a 'night' class for clear night with wind
                    // animationType could be 'windy-night' if you make such an animation
                } else if (forecastLowerCase.includes('cloudy') || forecastLowerCase.includes('partly cloudy')) {
                    cssClassType = 'partly-cloudy'; 
                } else {
                    cssClassType = 'default';
                }
            } else if (forecastLowerCase.includes('clear')) { // Handle "clear" specifically
                if (isDaytime) {
                    cssClassType = 'sunny'; animationType = 'sunny'; // Treat clear day as sunny
                } else {
                    cssClassType = 'default'; // Or specific 'night' CSS class
                    animationType = 'clear-night';
                }
            } else if (forecastLowerCase.includes('sunny') || forecastLowerCase.includes('fair')) {
                cssClassType = 'sunny'; animationType = 'sunny';
            } else if (forecastLowerCase.includes('mostly cloudy') || forecastLowerCase.includes('overcast')) {
                cssClassType = 'cloudy'; animationType = 'cloudy';
            } else if (forecastLowerCase.includes('partly cloudy') || forecastLowerCase.includes('partly sunny') || 
                       forecastLowerCase.includes('mostly clear') || forecastLowerCase.includes('mostly sunny')) {
                cssClassType = 'partly-cloudy'; animationType = 'partly-cloudy';
            } else { // Default for anything not specifically matched
                cssClassType = 'default'; animationType = 'default';
            }
        }
        
        headerElement.classList.add(`weather-${cssClassType}`);
        
        if (window.setWeatherAnimation && typeof window.setWeatherAnimation === 'function') {
            window.setWeatherAnimation(animationType);
        } else {
            console.warn("setWeatherAnimation function not found or not a function.");
        }
    }


    // --- Event Listeners ---
    if (getWeatherButton) {
        getWeatherButton.addEventListener('click', () => {
            console.log("Get Weather button clicked."); 
            const locationValue = locationInput ? locationInput.value : '';
            searchLocationsViaPositionstack(locationValue);
        });
    } else {
        console.error("getWeatherButton not found in the DOM.");
    }

    if (locationInput) {
        locationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log("Enter key pressed in locationInput."); 
                clearTimeout(debounceTimer);
                if (suggestionsContainer) suggestionsContainer.innerHTML = '';
                const locationValue = locationInput.value;
                searchLocationsViaPositionstack(locationValue);
            }
        });

        locationInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = locationInput.value;
            if (query.length > 2) {
                debounceTimer = setTimeout(() => {
                    console.log("Debounced search for:", query); 
                    searchLocationsViaPositionstack(query);
                }, 500);
            } else {
                if (suggestionsContainer) suggestionsContainer.innerHTML = '';
            }
        });
    } else {
        console.error("locationInput not found in the DOM.");
    }
    
    if (getAiInsightsButton) {
        getAiInsightsButton.addEventListener('click', () => {
            if (lastWeatherDataForAI && lastLocationNameForAI) {
                fetchAIWeatherInsights(lastWeatherDataForAI, lastLocationNameForAI);
            } else {
                if (aiInsightsStatus) {
                    aiInsightsStatus.textContent = "Cannot refresh, please perform a new weather search first.";
                    aiInsightsStatus.className = 'error';
                    aiInsightsStatus.style.display = 'block';
                }
            }
        });
    }

    // --- Initialization ---
    const canvas = document.getElementById('weatherAnimationCanvas');
    if (canvas) {
        if (typeof initThreeJSAnimation === 'function') { 
            initThreeJSAnimation(canvas);
        } else {
            console.warn("initThreeJSAnimation function not found (weather-animations.js might be missing or script order issue). Three.js animations will not run.");
            canvas.style.display = 'none';
        }
    }
    loadLastSearch(); 
});