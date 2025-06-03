// alerts_script.js

document.addEventListener('DOMContentLoaded', function() {
    const locationNameSpan = document.getElementById('alerts-location-name');
    const alertsContainer = document.getElementById('alerts-container');
    const statusP = document.getElementById('alerts-status');

    if (!locationNameSpan || !alertsContainer || !statusP) {
        console.error("ALERTS_SCRIPT: Critical DOM element(s) not found.");
        if (statusP) {
            statusP.textContent = 'Page Error: Essential elements missing.';
            statusP.className = 'error';
        }
        return;
    }

    if (typeof CONFIG === 'undefined' || !CONFIG.PROXY_API_BASE_URL) {
        statusP.textContent = 'Error: Configuration not loaded (PROXY_API_BASE_URL missing).';
        statusP.className = 'error';
        locationNameSpan.textContent = "Configuration Error";
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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        } catch (e) { return dateString; }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const latParam = urlParams.get('lat');
    const lonParam = urlParams.get('lon');
    const nameParam = urlParams.get('name') || 'Your Current Area';

    locationNameSpan.textContent = escapeHtml(decodeURIComponent(nameParam));

    if (!latParam || !lonParam) {
        statusP.textContent = 'Location not specified. Please search for a location on the main page to view alerts.';
        statusP.className = 'error';
        locationNameSpan.textContent = "Location Unknown";
        alertsContainer.innerHTML = `<p>Go to <a href="index.html">Current Weather</a> to select a location.</p>`;
        return;
    }

    async function fetchActiveAlerts() {
        // ... (fetchActiveAlerts function remains the same as the last fully updated version with logging) ...
        // For brevity, I'll skip pasting it again. Ensure you have the version with good logging.
        console.log("ALERTS_SCRIPT: fetchActiveAlerts called");
        statusP.textContent = `Fetching active alerts for ${escapeHtml(decodeURIComponent(nameParam))}...`;
        statusP.className = 'loading';
        alertsContainer.innerHTML = ''; 

        const alertsUrl = `${PROXY_API_BASE_URL}/nws/alerts/active?lat=${latParam}&lon=${lonParam}`;
        console.log("ALERTS_SCRIPT: Fetching from URL:", alertsUrl);

        try {
            const response = await fetch(alertsUrl);
            console.log("ALERTS_SCRIPT: Response received from proxy, status:", response.status, "ok:", response.ok);
            let alertData;
            if (response.ok) {
                try {
                    alertData = await response.json();
                    console.log("ALERTS_SCRIPT: Parsed alertData from proxy (response OK):", JSON.stringify(alertData, null, 2));
                } catch (jsonError) {
                    console.error("ALERTS_SCRIPT: Failed to parse JSON from successful proxy response", jsonError);
                    statusP.textContent = 'Error: Received invalid data format from server.'; statusP.className = 'error';
                    throw new Error("Received non-JSON response from server even though status was OK.");
                }
            } else { 
                let errorDetails = `Proxy request failed with status: ${response.status} ${response.statusText}`;
                try {
                    const errorDataFromProxy = await response.json(); 
                    console.error("ALERTS_SCRIPT: Proxy error response JSON:", errorDataFromProxy);
                    errorDetails = errorDataFromProxy.details || errorDataFromProxy.message || errorDataFromProxy.error || errorDetails;
                } catch (e) { console.warn("ALERTS_SCRIPT: Proxy error response was not JSON. Using status text."); }
                statusP.textContent = `Error fetching alerts: ${escapeHtml(errorDetails)}`; statusP.className = 'error';
                throw new Error(errorDetails);
            }
            
            if (alertData && alertData.features && alertData.features.length > 0) {
                console.log("ALERTS_SCRIPT: Alerts found:", alertData.features.length);
                displayAlerts(alertData.features); 
                statusP.textContent = `Active alerts loaded for ${escapeHtml(decodeURIComponent(nameParam))}. Click on an alert to expand.`;
                statusP.className = 'info'; 
            } else {
                console.log("ALERTS_SCRIPT: No active alerts found or features array empty. alertData:", alertData);
                statusP.textContent = `No active alerts for ${escapeHtml(decodeURIComponent(nameParam))} at this time.`;
                statusP.className = 'info'; 
            }
        } catch (error) { 
            console.error("ALERTS_SCRIPT: Error in fetchActiveAlerts' try block:", error.message, error.stack);
            if (!statusP.textContent.startsWith("Error fetching alerts:") && !statusP.textContent.startsWith("Error: Received invalid data")) {
                statusP.textContent = `Error fetching alerts: ${escapeHtml(error.message)}`;
            }
            statusP.className = 'error';
        }
        console.log("ALERTS_SCRIPT: fetchActiveAlerts finished processing.");
    }


    function displayAlerts(alertFeatures) {
        alertsContainer.innerHTML = ''; 
        try {
            alertFeatures.forEach(alertFeature => {
                const props = alertFeature.properties;
                if (!props) return;

                const alertId = props.id || `alert-${Math.random().toString(36).substr(2, 9)}`;
                let severityClass = 'minor'; 
                if (props.severity) {
                    const s = props.severity.toLowerCase();
                    if (s === 'extreme' || s === 'severe') severityClass = 'critical';
                    else if (s === 'moderate') severityClass = 'moderate';
                }

                const alertItemDiv = document.createElement('div');
                alertItemDiv.className = `alert-item expandable ${severityClass}`;
                alertItemDiv.dataset.alertId = escapeHtml(alertId);

                // Clickable Header for the alert
                const alertHeader = document.createElement('div');
                alertHeader.className = 'alert-header';
                alertHeader.setAttribute('role', 'button');
                alertHeader.tabIndex = 0; // Make it focusable
                alertHeader.innerHTML = `
                    <h4>${escapeHtml(props.event || 'Weather Alert')} <span class="expand-icon">+</span></h4>
                    <p class="alert-summary"><strong>Severity:</strong> ${escapeHtml(props.severity || 'N/A')} | <strong>Urgency:</strong> ${escapeHtml(props.urgency || 'N/A')}</p>
                    ${props.headline ? `<p class="alert-summary headline-summary">${escapeHtml(props.headline)}</p>` : ''}
                `;
                alertItemDiv.appendChild(alertHeader);

                // Content to be expanded
                const alertContent = document.createElement('div');
                alertContent.className = 'alert-content'; // Initially hidden by CSS
                let contentHtml = `
                    <p><strong>Issued:</strong> <time datetime="${escapeHtml(props.effective || '')}">${formatDate(props.effective)}</time></p>
                    <p><strong>Expires:</strong> <time datetime="${escapeHtml(props.expires || '')}">${formatDate(props.expires)}</time></p>
                `;
                if (props.headline && !alertHeader.querySelector('.headline-summary')) { // If headline wasn't short enough for summary
                    contentHtml += `<h5>Headline:</h5><p>${escapeHtml(props.headline)}</p>`;
                }
                if (props.description) {
                    contentHtml += `<h5>Description:</h5><p>${escapeHtml(props.description).replace(/\n/g, '<br>')}</p>`;
                }
                if (props.instruction) {
                    contentHtml += `<h5>Instructions:</h5><p>${escapeHtml(props.instruction).replace(/\n/g, '<br>')}</p>`;
                }
                alertContent.innerHTML = contentHtml;

                if (AI_ENABLED) {
                    const aiButton = document.createElement('button');
                    aiButton.className = 'button-like-link explain-alert-button';
                    aiButton.textContent = 'Explain with AI';
                    
                    const aiExplanationDiv = document.createElement('div');
                    aiExplanationDiv.className = 'ai-alert-explanation';
                    aiExplanationDiv.style.display = 'none'; // Hide initially
                    aiExplanationDiv.innerHTML = `
                        <p class="ai-explanation-status loading" style="display:none;">Generating AI explanation...</p>
                        <div class="ai-explanation-content" style="white-space: pre-wrap;"></div>
                    `;
                    alertContent.appendChild(aiButton);
                    alertContent.appendChild(aiExplanationDiv);

                    aiButton.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent alert header click from also firing
                        handleExplainAlert(props, alertId, aiExplanationDiv); // Pass the specific div
                    });
                }
                alertItemDiv.appendChild(alertContent);
                alertsContainer.appendChild(alertItemDiv);

                // Event listener for expanding/collapsing
                alertHeader.addEventListener('click', () => {
                    alertItemDiv.classList.toggle('expanded');
                    const icon = alertHeader.querySelector('.expand-icon');
                    if (icon) {
                        icon.textContent = alertItemDiv.classList.contains('expanded') ? '−' : '+';
                    }
                });
                alertHeader.addEventListener('keydown', (e) => { // Accessibility for keyboard
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        alertHeader.click();
                    }
                });
            });
        } catch (displayError) {
            console.error("ALERTS_SCRIPT: Error during displayAlerts execution:", displayError);
            statusP.textContent = "Error displaying alert details.";
            statusP.className = 'error';
        }
    }

    // Modified handleExplainAlert to target the specific AI explanation div
    async function handleExplainAlert(alertProperties, alertDomId, aiExplanationDivElement) {
        console.log("ALERTS_SCRIPT: handleExplainAlert called for", alertDomId);
        if (!aiExplanationDivElement) {
            console.error("ALERTS_SCRIPT: AI explanation DOM element not provided for ID:", alertDomId);
            return;
        }

        const explanationStatus = aiExplanationDivElement.querySelector('.ai-explanation-status');
        const explanationContent = aiExplanationDivElement.querySelector('.ai-explanation-content');
        // The button is outside aiExplanationDivElement now, so we don't need to disable it here
        // or find it again. Event propagation is stopped on the button click itself.

        aiExplanationDivElement.style.display = 'block';
        if(explanationContent) explanationContent.innerHTML = '';
        if(explanationStatus) {
            explanationStatus.textContent = 'Generating AI explanation...';
            explanationStatus.className = 'ai-explanation-status loading';
            explanationStatus.style.display = 'block';
        }

        try {
            const response = await fetch(`${PROXY_API_BASE_URL}/googleai/explain-alert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertProperties, locationName: decodeURIComponent(nameParam) })
            });
            
            if (!response.ok) {
                let errorDetails = `AI service request failed: ${response.status} ${response.statusText}`;
                try { const errorData = await response.json(); errorDetails = errorData.details || errorData.error || errorDetails; } catch(e) {/*ignore*/}
                throw new Error(errorDetails);
            }
            const data = await response.json();
            if(explanationContent) explanationContent.innerHTML = escapeHtml(data.explanation).replace(/\n/g, '<br>');
            if(explanationStatus) explanationStatus.style.display = 'none';

        } catch (error) {
            console.error("ALERTS_SCRIPT: AI Alert Explanation Error:", error);
            if(explanationContent) explanationContent.innerHTML = '';
            if(explanationStatus) {
                explanationStatus.textContent = `Error: ${escapeHtml(error.message)}`;
                explanationStatus.className = 'ai-explanation-status error';
                explanationStatus.style.display = 'block'; 
            }
        }
    }
    
    function updateNavLinks() {
        // ... (updateNavLinks function remains the same) ...
        const currentUrlParams = new URLSearchParams(window.location.search);
        const currentLatParam = currentUrlParams.get('lat');
        const currentLonParam = currentUrlParams.get('lon');
        const currentNameParam = currentUrlParams.get('name');

        if (currentLatParam && currentLonParam && currentNameParam) {
            const encodedName = encodeURIComponent(decodeURIComponent(currentNameParam));
            const lat = encodeURIComponent(currentLatParam);
            const lon = encodeURIComponent(currentLonParam);

            const navCurrent = document.getElementById('nav-current');
            const navHourly = document.getElementById('nav-hourly');
            const navMaps = document.getElementById('nav-maps');

            if (navCurrent) navCurrent.href = `index.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
            if (navHourly) navHourly.href = `hourly_forecast.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
            if (navMaps) navMaps.href = `maps.html?lat=${lat}&lon=${lon}&name=${encodedName}`;
        }
    }

    fetchActiveAlerts();
    updateNavLinks(); 
});