// hourly_script.js for NWS API

document.addEventListener('DOMContentLoaded', function() {
    const locationNameSpan = document.getElementById('hourly-location-name');
    // const forecastTableBody = document.getElementById('hourly-forecast-table-body'); // No longer using table body
    const forecastCardsContainer = document.getElementById('hourly-forecast-cards-container');
    const statusP = document.getElementById('hourly-status');

    if (!locationNameSpan || !forecastCardsContainer || !statusP) {
        console.error("HOURLY_SCRIPT: Critical DOM element(s) not found.");
        if(statusP) statusP.textContent = "Page error: Elements missing.";
        return;
    }

    if (typeof CONFIG === 'undefined' || !CONFIG.PROXY_API_BASE_URL) {
        statusP.textContent = 'Error: Configuration not loaded (PROXY_API_BASE_URL missing).';
        statusP.className = 'error';
        locationNameSpan.textContent = "Configuration Error";
        return;
    }
    const PROXY_API_BASE_URL = CONFIG.PROXY_API_BASE_URL;

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

    const urlParams = new URLSearchParams(window.location.search);
    const latParam = urlParams.get('lat');
    const lonParam = urlParams.get('lon');
    const nameParam = urlParams.get('name') || 'Selected Location';

    locationNameSpan.textContent = escapeHtml(decodeURIComponent(nameParam));

    if (!latParam || !lonParam) {
        statusP.textContent = 'Error: Latitude or Longitude not provided in URL.';
        statusP.className = 'error';
        locationNameSpan.textContent = "Error";
        return;
    }
    
    const lat = parseFloat(latParam).toFixed(4);
    const lon = parseFloat(lonParam).toFixed(4);

    async function fetchNwsHourlyForecast() {
        statusP.textContent = `Fetching hourly forecast for ${escapeHtml(decodeURIComponent(nameParam))}...`;
        statusP.className = 'loading';
        forecastCardsContainer.innerHTML = ''; 

        const nwsPointsUrl = `${PROXY_API_BASE_URL}/nws/points/${lat},${lon}`;
        let specificHourlyForecastUrl;

        try {
            const pointsResponse = await fetch(nwsPointsUrl);
            if (!pointsResponse.ok) {
                const errorData = await pointsResponse.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.message || `NWS Points API error: ${pointsResponse.status}`);
            }
            const pointData = await pointsResponse.json();
            if (!pointData.properties || !pointData.properties.forecastHourly) {
                throw new Error("NWS point data incomplete (hourly URL missing).");
            }
            specificHourlyForecastUrl = pointData.properties.forecastHourly;
        } catch (error) {
            console.error("NWS Point Data Error (Hourly):", error);
            statusP.textContent = `Error fetching forecast point data: ${escapeHtml(error.message)}`;
            statusP.className = 'error';
            return;
        }

        const proxyForecastUrl = `${PROXY_API_BASE_URL}/nws/forecast?url=${encodeURIComponent(specificHourlyForecastUrl)}`;
        try {
            const forecastResponse = await fetch(proxyForecastUrl);
            if (!forecastResponse.ok) {
                const errorData = await forecastResponse.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.message || `NWS Hourly API error: ${forecastResponse.status}`);
            }
            const forecastData = await forecastResponse.json(); 

            if (!forecastData.properties || !forecastData.properties.periods || forecastData.properties.periods.length === 0) {
                throw new Error("No hourly forecast periods found.");
            }
            
            // Display up to 48 periods (hours)
            displayNwsHourlyAsCards(forecastData.properties.periods.slice(0, 48));
            statusP.textContent = `Hourly forecast loaded for ${escapeHtml(decodeURIComponent(nameParam))}. Scroll right for more.`;
            statusP.className = 'info'; 
        } catch (error) {
            console.error("NWS Hourly Fetch Error:", error);
            statusP.textContent = `Error fetching hourly forecast: ${escapeHtml(error.message)}`;
            statusP.className = 'error';
        }
    }

    function displayNwsHourlyAsCards(hourlyPeriods) {
        forecastCardsContainer.innerHTML = ''; // Clear previous cards

        hourlyPeriods.forEach(hourData => {
            const card = document.createElement('div');
            card.className = 'hourly-card';

            const timeDiv = document.createElement('div');
            timeDiv.className = 'time';
            const dateObj = new Date(hourData.startTime);
            timeDiv.textContent = dateObj.toLocaleTimeString([], { weekday: 'short', hour: 'numeric', hour12: true });
            card.appendChild(timeDiv);

            const iconUrlFromAPI = hourData.icon;
            let finalIconUrl = '';
            const desiredSize = 'medium'; // Icons for cards can be a bit larger

            if (iconUrlFromAPI && typeof iconUrlFromAPI === 'string') {
                if (iconUrlFromAPI.startsWith('https://api.weather.gov/icons/')) {
                    let baseUrl = iconUrlFromAPI;
                    const queryStartIndex = baseUrl.indexOf('?');
                    if (queryStartIndex !== -1) baseUrl = baseUrl.substring(0, queryStartIndex);
                    finalIconUrl = `${baseUrl}?size=${desiredSize}`;
                } else if (iconUrlFromAPI.startsWith('/icons/')) {
                    let partialPath = iconUrlFromAPI;
                    const queryStartIndex = partialPath.indexOf('?');
                    if (queryStartIndex !== -1) partialPath = partialPath.substring(0, queryStartIndex);
                    finalIconUrl = `https://api.weather.gov${partialPath}?size=${desiredSize}`;
                } else if (iconUrlFromAPI.trim() !== '') {
                     const timeOfDay = hourData.isDaytime ? 'day' : 'night';
                     finalIconUrl = `https://api.weather.gov/icons/land/${timeOfDay}/${iconUrlFromAPI.split(' ').join('_').toLowerCase()}?size=${desiredSize}`;
                }
            }
            
            if (finalIconUrl) {
                const conditionImg = document.createElement('img');
                conditionImg.src = finalIconUrl; 
                conditionImg.alt = escapeHtml(hourData.shortForecast);
                conditionImg.title = escapeHtml(hourData.shortForecast);
                conditionImg.className = 'condition-icon';
                card.appendChild(conditionImg);
            }

            const tempDiv = document.createElement('div');
            tempDiv.className = 'temp';
            tempDiv.textContent = `${escapeHtml(String(hourData.temperature))}°${escapeHtml(hourData.temperatureUnit)}`;
            card.appendChild(tempDiv);

            const conditionTextDiv = document.createElement('div');
            conditionTextDiv.className = 'condition-text';
            conditionTextDiv.textContent = escapeHtml(hourData.shortForecast);
            card.appendChild(conditionTextDiv);
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'details';
            detailsDiv.innerHTML = `
                <p><strong>Wind:</strong> ${escapeHtml(hourData.windSpeed)} ${escapeHtml(hourData.windDirection)}</p>
                <p><strong>Humidity:</strong> ${hourData.relativeHumidity && hourData.relativeHumidity.value !== null ? escapeHtml(String(hourData.relativeHumidity.value)) + '%' : 'N/A'}</p>
                <p><strong>Precip:</strong> ${hourData.probabilityOfPrecipitation && hourData.probabilityOfPrecipitation.value !== null ? escapeHtml(String(hourData.probabilityOfPrecipitation.value)) + '%' : 'N/A'}</p>
            `;
            card.appendChild(detailsDiv);

            forecastCardsContainer.appendChild(card);
        });
    }
    
    function updateNavLinks() {
        const currentUrlParams = new URLSearchParams(window.location.search);
        const currentLatParam = currentUrlParams.get('lat');
        const currentLonParam = currentUrlParams.get('lon');
        const currentNameParam = currentUrlParams.get('name');

        if (currentLatParam && currentLonParam && currentNameParam) {
            const encodedName = encodeURIComponent(decodeURIComponent(currentNameParam)); 
            const lat = encodeURIComponent(currentLatParam);
            const lon = encodeURIComponent(currentLonParam);

            const navCurrent = document.getElementById('nav-current');
            const navAlerts = document.getElementById('nav-alerts');
            const navMaps = document.getElementById('nav-maps');

            if (navCurrent) navCurrent.href = `index.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
            if (navAlerts) navAlerts.href = `alerts.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
            if (navMaps) navMaps.href = `maps.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
        }
    }

    fetchNwsHourlyForecast();
    updateNavLinks();
});