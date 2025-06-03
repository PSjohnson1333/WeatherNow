// weather-animations.js - Overhauled for more distinct effects

let scene, camera, renderer;
let currentAnimationType = 'default';
let animationFrameId;
let effectObjects = []; // To manage all active animation elements

// --- Constants for effects ---
const RAIN_COUNT = 1200; // Adjusted count
const SNOW_COUNT = 1500;
const STAR_COUNT = 700;
const SUN_RAY_COUNT = 50;
const CLOUD_COUNT = 25;


// Texture paths (replace with your actual paths or URLs if you have textures)
const RAIN_TEXTURE_PATH = null; 
const SNOWFLAKE_TEXTURE_PATH = null; 
const SUN_GLOW_TEXTURE_PATH = null; 
const CLOUD_TEXTURE_PATH = null; 

let textureLoader;

// --- Initialization ---
function initThreeJSAnimation(canvasElement) {
    if (!canvasElement) {
        console.error("Three.js: Canvas element not provided.");
        return;
    }
    if (typeof THREE === 'undefined') {
        console.error("Three.js: THREE (Three.js library) is not defined. Ensure it's loaded before this script.");
        canvasElement.style.display = 'none';
        return;
    }

    try {
        scene = new THREE.Scene();
        textureLoader = new THREE.TextureLoader(); // Initialize texture loader
        const headerElement = canvasElement.parentElement;

        if (!headerElement || headerElement.offsetWidth === 0 || headerElement.offsetHeight === 0) {
            console.error("Three.js: Header element (canvas parent) not found or has zero dimensions. Width:", headerElement?.offsetWidth, "Height:", headerElement?.offsetHeight);
            canvasElement.style.display = 'none';
            return;
        }

        const aspectRatio = headerElement.offsetWidth / headerElement.offsetHeight;
        camera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ canvas: canvasElement, alpha: true, antialias: true });
        renderer.setSize(headerElement.offsetWidth, headerElement.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        camera.position.set(0, 1, 10); 

        window.addEventListener('resize', () => onWindowResize(canvasElement), false);
        console.log("Three.js animation system initialized.");
        startAnimationLoop();
    } catch (e) {
        console.error("Error initializing Three.js:", e);
        if (canvasElement) canvasElement.style.display = 'none';
    }
}

function onWindowResize(canvasElement) {
    if (!renderer || !camera || !canvasElement.parentElement) return;
    const headerElement = canvasElement.parentElement;
    const width = headerElement.offsetWidth;
    const height = headerElement.offsetHeight;
    if (width === 0 || height === 0) return; // Avoid issues if header collapses
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function clearAllEffects() {
    effectObjects.forEach(obj => {
        if (obj) {
            scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    });
                } else {
                    if (obj.material.map) obj.material.map.dispose();
                    obj.material.dispose();
                }
            }
        }
    });
    effectObjects = [];
    scene.fog = null;
    if (window.lightningInterval) {
        clearInterval(window.lightningInterval);
        window.lightningInterval = null;
    }
}

// --- Effect Setup Functions ---

// 1. RAIN (Line-based streaks)
function setupRain() {
    // console.log("WEATHER_ANIMATIONS: Setting up Rain");
    let rainMaterialOptions = {
        color: 0x88AED7, // Bluish rain
        transparent: true,
        opacity: 0.6,
        depthWrite: false // Often good for transparent lines/sprites
    };

    if (RAIN_TEXTURE_PATH) { // If you have a streak texture
        rainMaterialOptions.map = textureLoader.load(RAIN_TEXTURE_PATH);
        // For textured sprites, you'd typically use PointsMaterial or SpriteMaterial
        // This example will focus on the Line-based approach for simplicity if no texture.
        // If using PointsMaterial for textured sprites:
        // rainMaterialOptions.size = 0.6; // Adjust sprite size
        // rainMaterialOptions.blending = THREE.AdditiveBlending;
        // rainMaterialOptions.sizeAttenuation = true;
    } else {
        // For LineBasicMaterial if no texture:
        rainMaterialOptions.linewidth = 1.5; // Note: WebGL limitations on linewidth > 1
    }
    
    // Decide material type based on whether a texture is provided for sprites
    const material = RAIN_TEXTURE_PATH 
        ? new THREE.PointsMaterial(rainMaterialOptions) 
        : new THREE.LineBasicMaterial(rainMaterialOptions);


    const rainHolder = new THREE.Group();
    rainHolder.userData.type = 'rain_system';

    const dropHeight = 1.0; // <<< INCREASED: Length of raindrop streak
    const spawnWidth = 20;
    const spawnHeight = 15;
    const spawnDepth = 10;

    for (let i = 0; i < RAIN_COUNT; i++) {
        let rainElement;
        if (RAIN_TEXTURE_PATH) { // Create points for textured sprites
            const rainGeo = new THREE.BufferGeometry(); // Each point is a raindrop sprite
            rainGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0], 3)); // Single point
            rainElement = new THREE.Points(rainGeo, material); // Material is PointsMaterial
        } else { // Create lines for streaks
            const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -dropHeight, 0)];
            const rainDropGeometry = new THREE.BufferGeometry().setFromPoints(points);
            rainElement = new THREE.Line(rainDropGeometry, material); // Material is LineBasicMaterial
        }

        rainElement.position.set(
            Math.random() * spawnWidth - (spawnWidth / 2),
            Math.random() * spawnHeight + 5,  // Start higher
            Math.random() * spawnDepth - (spawnDepth / 2)
        );
        rainElement.userData.velocity = -(Math.random() * 0.25 + 0.20); // <<< INCREASED: Faster fall speed
        rainHolder.add(rainElement);
    }
    scene.add(rainHolder);
    effectObjects.push(rainHolder);
}


// 2. SUNNY (Radiating Light)
function setupSunny() {
    // console.log("WEATHER_ANIMATIONS: Setting up Sunny");
    const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.8);
    sunLight.position.set(5, 7, 2);
    scene.add(sunLight);
    effectObjects.push(sunLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    effectObjects.push(ambient);

    const sunDiscGeometry = new THREE.CircleGeometry(1.5, 32); // Larger
    const sunDiscMaterial = new THREE.MeshBasicMaterial({ color: 0xFFF0A0, transparent: true, opacity: 0.9 });
    const sunDisc = new THREE.Mesh(sunDiscGeometry, sunDiscMaterial);
    sunDisc.position.set(0, 6, -12); // Position sun slightly adjusted
    scene.add(sunDisc);
    effectObjects.push(sunDisc);

    const raysGroup = new THREE.Group();
    raysGroup.userData.type = 'sun_rays';
    const rayTexture = SUN_GLOW_TEXTURE_PATH ? textureLoader.load(SUN_GLOW_TEXTURE_PATH) : null;
    const rayMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFF5AA, map: rayTexture,
        transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });

    for (let i = 0; i < SUN_RAY_COUNT; i++) {
        const rayGeometry = new THREE.PlaneGeometry(0.1, 0.1); // Start small
        const ray = new THREE.Mesh(rayGeometry, rayMaterial.clone());
        ray.userData = {
            initialDelay: Math.random() * 2000,
            startTime: Date.now() + Math.random() * 2000,
            maxScale: 25 + Math.random() * 15, // Larger rays
            duration: 2500 + Math.random() * 1500,
            initialRotationZ: Math.random() * Math.PI * 2 // For varied ray orientation if using non-circular texture
        };
        ray.position.copy(sunDisc.position);
        ray.scale.set(0.01,0.01,0.01);
        ray.material.opacity = 0;
        if(!rayTexture) ray.lookAt(camera.position); // Only lookAt if no texture, otherwise texture orientation matters
        else ray.rotation.z = ray.userData.initialRotationZ; // If textured, use initial rotation

        raysGroup.add(ray);
    }
    scene.add(raysGroup);
    effectObjects.push(raysGroup);
}

// 3. CLOUDY
function setupClouds(isPartlyCloudy = false) {
    // console.log("WEATHER_ANIMATIONS: Setting up Clouds, partly:", isPartlyCloudy);
    const cloudHolder = new THREE.Group();
    cloudHolder.userData.type = 'clouds_system';
    const cloudTexture = CLOUD_TEXTURE_PATH ? textureLoader.load(CLOUD_TEXTURE_PATH) : null;

    const cloudMaterial = new THREE.SpriteMaterial({
        map: cloudTexture,
        color: isPartlyCloudy ? 0xd0d8e0 : 0xb0b8c0,
        transparent: true,
        opacity: isPartlyCloudy ? 0.65 : 0.85,
        blending: THREE.NormalBlending, 
        depthWrite: false,
        sizeAttenuation: true,
    });
    if (!cloudTexture) cloudMaterial.color = 0xffffff; // Make points visible if no texture

    const numClouds = isPartlyCloudy ? (CLOUD_COUNT / 2) : CLOUD_COUNT;
    for (let i = 0; i < numClouds; i++) {
        const cloudSprite = new THREE.Sprite(cloudMaterial.clone()); // Clone for individual opacity/scale later if needed
        const scaleBase = cloudTexture ? 8 : 0.5; // Different base scale if texture vs point
        const scale = Math.random() * 3 + scaleBase;
        cloudSprite.scale.set(scale, scale * (0.5 + Math.random()*0.5), 1);
        cloudSprite.position.set(
            Math.random() * 30 - 15,
            Math.random() * 2 + (isPartlyCloudy ? 3.5 : 2.5), // Cloud layer height
            Math.random() * 10 - 10 // More spread in Z, further back
        );
        cloudSprite.userData.driftSpeed = (Math.random() - 0.5) * 0.0025 + 0.0005; // Slower, varied drift
        cloudHolder.add(cloudSprite);
    }
    scene.add(cloudHolder);
    effectObjects.push(cloudHolder);

    const ambientStrength = isPartlyCloudy ? 0.7 : 0.45;
    const ambientLight = new THREE.AmbientLight(0xddeeff, ambientStrength); // Cooler ambient
    scene.add(ambientLight);
    effectObjects.push(ambientLight);

    if(isPartlyCloudy){
        const sunLight = new THREE.DirectionalLight(0xfff0dd, 0.6);
        sunLight.position.set(Math.random() * 10 - 5, 5, Math.random() * 5 + 2); // Varied sun position
        scene.add(sunLight);
        effectObjects.push(sunLight);
    }
}

// 4. THUNDERSTORM
function setupThunderstorm() {
    // console.log("WEATHER_ANIMATIONS: Setting up Thunderstorm");
    setupRain(); 
    const darkAmbient = new THREE.AmbientLight(0x151525, 0.7); // Very dark blue
    scene.add(darkAmbient);
    effectObjects.push(darkAmbient);
    scene.fog = new THREE.Fog(0x030308, 1, 15); 

    if (window.lightningInterval) clearInterval(window.lightningInterval); // Clear previous
    window.lightningInterval = setInterval(createLightningBolt, 2500 + Math.random() * 6000);
}

function createLightningBolt() {
    if (!scene || !camera) return; 
    // console.log("LIGHTNING STRIKE");

    const boltMaterial = new THREE.LineBasicMaterial({
        color: 0xE0E8FF, // Brighter, whiter blue
        linewidth: Math.random() * 2.5 + 1.5, // Can try thicker
        transparent: true,
        opacity: 1.0, // Start fully opaque
        blending: THREE.AdditiveBlending, // Makes it brighter
        depthWrite: false
    });

    const startY = Math.random() * 5 + 7; // Start higher
    const startX = Math.random() * 16 - 8;
    const startZ = Math.random() * 6 - 12; // More likely further back
    
    let currentPoint = new THREE.Vector3(startX, startY, startZ);
    const points = [currentPoint.clone()];
    const numSegments = Math.floor(Math.random() * 4) + 4; // 4 to 7 segments
    let remainingLength = startY - (-2 + Math.random() * 2); // Aim to hit near bottom or slightly below

    for (let i = 0; i < numSegments && remainingLength > 0.5; i++) {
        const segmentLength = Math.max(0.5, remainingLength / (numSegments - i) * (0.8 + Math.random() * 0.4));
        const nextPoint = currentPoint.clone();
        nextPoint.y -= segmentLength;
        nextPoint.x += (Math.random() - 0.5) * segmentLength * 1.8; // Wider jitter
        nextPoint.z += (Math.random() - 0.5) * segmentLength * 0.8;
        points.push(nextPoint);
        currentPoint = nextPoint;
        remainingLength -= segmentLength;
    }

    const boltGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lightningBolt = new THREE.Line(boltGeometry, boltMaterial);
    lightningBolt.userData.creationTime = Date.now();
    
    scene.add(lightningBolt);
    // This object will be removed by its own timeout, not added to general effectObjects for clearAllEffects
    // unless you want clearAllEffects to also immediately stop lightning.

    // Quick flash and fade
    setTimeout(() => {
        if (lightningBolt.material) lightningBolt.material.opacity = 0.5;
        setTimeout(() => {
            if (lightningBolt.material) lightningBolt.material.opacity = 0.2;
            setTimeout(() => {
                scene.remove(lightningBolt);
                if (lightningBolt.geometry) lightningBolt.geometry.dispose();
                if (lightningBolt.material) lightningBolt.material.dispose();
            }, 60 + Math.random() * 40);
        }, 50 + Math.random() * 30);
    }, 30 + Math.random() * 20);
}

// 5. WINDY
function setupWind() { /* ... Keep previous setupWind or enhance ... */ }
// 6. SNOW
function setupSnow() { /* ... Keep previous setupSnow or enhance ... */ }
// 7. FOG
function setupFog(intensity = 'normal') { /* ... Keep previous setupFog or enhance ... */ }
// 8. CLEAR NIGHT
function setupClearNight() { /* ... Keep previous setupClearNight or enhance ... */ }


// --- Animation Update Functions ---
function animateEffects() {
    const now = Date.now();
    effectObjects.forEach(obj => {
        if (!obj || !obj.userData ) return;
        
        const isGroup = obj.type === 'Group';
        const positions = !isGroup && obj.geometry?.attributes?.position?.array;

        switch (obj.userData.type) {
            case 'rain_system':
                if (isGroup) {
                    obj.children.forEach(rainElement => {
                        if (rainElement.userData && typeof rainElement.userData.velocity === 'number') {
                            rainElement.position.y += rainElement.userData.velocity;
                            // Optional: rainElement.position.x += rainElement.userData.velocity * 0.05; // Slight wind angle
                            if (rainElement.position.y < -7) {
                                rainElement.position.y = 15 + Math.random() * 3;
                                rainElement.position.x = Math.random() * 20 - 10;
                            }
                        }
                    });
                }
                break;
            // ... (All other animation cases from the previous full file, like sun_rays, clouds_system, etc.) ...
            // Make sure they are compatible with how objects are added to effectObjects
            // and whether they are Groups or single Meshes/Points.

            case 'sun_rays': 
                if (isGroup) {
                    obj.children.forEach(ray => {
                        if (now > ray.userData.startTime) {
                            const elapsedTime = now - ray.userData.startTime;
                            const progress = Math.min(elapsedTime / ray.userData.duration, 1);
                            const currentScale = progress * ray.userData.maxScale;
                            ray.scale.set(currentScale, currentScale, currentScale);
                            if (progress < 0.2) ray.material.opacity = progress * 5 * 0.3; // Faster fade in
                            else if (progress > 0.7) ray.material.opacity = (1 - (progress - 0.7)/0.3) * 0.3; // Fade out in last 30%
                            else ray.material.opacity = 0.3;

                            if(!ray.material.map) ray.lookAt(camera.position); // Only if not textured
                            else ray.rotation.z = ray.userData.initialRotationZ;


                            if (progress >= 1) {
                                ray.userData.startTime = now + ray.userData.initialDelay + Math.random() * 800;
                                ray.scale.set(0.01,0.01,0.01);
                                ray.material.opacity = 0;
                            }
                        }
                    });
                }
                break;

            case 'clouds_system':
                if (isGroup) {
                    obj.children.forEach(cloud => {
                        cloud.position.x += cloud.userData.driftSpeed; // Use += for varied directions
                        if (cloud.userData.driftSpeed > 0 && cloud.position.x > 20) cloud.position.x = -20;
                        else if (cloud.userData.driftSpeed < 0 && cloud.position.x < -20) cloud.position.x = 20;
                    });
                }
                break;
            
            case 'wind_system': // Assuming wind_system is a Group of Line streaks
                 if (isGroup) {
                    obj.children.forEach(streak => {
                        streak.position.add(streak.userData.velocity);
                        if (streak.material.opacity > 0) streak.material.opacity -= 0.015; 
                        if (streak.material.opacity <= 0) {
                            streak.position.set(
                                (Math.random() > 0.5 ? -15 : 15) + (Math.random()-0.5)*5, // Enter from sides
                                Math.random() * 10 - 5,
                                Math.random() * 10 - 7
                            );
                            streak.material.opacity = 0.2 + Math.random() * 0.2;
                            streak.userData.velocity.x = (streak.position.x > 0 ? -1 : 1) * (Math.random() * 0.1 + 0.08);
                        }
                    });
                }
                break;

            case 'snow_system': // This uses Points
                if (positions && obj.geometry.userData.velocities) {
                    const velocities = obj.geometry.userData.velocities; // This should be flat array
                    for (let i = 0; i < SNOW_COUNT; i++) { 
                        const baseIndex = i * 3;
                        positions[baseIndex + 0] += velocities[baseIndex + 0]; 
                        positions[baseIndex + 1] += velocities[baseIndex + 1]; 
                        positions[baseIndex + 2] += velocities[baseIndex + 2]; 
                        if (positions[baseIndex + 1] < -7) {
                            positions[baseIndex + 0] = Math.random() * 20 - 10;
                            positions[baseIndex + 1] = 15;
                            positions[baseIndex + 2] = Math.random() * 10 - 8;
                        }
                        if (positions[baseIndex + 0] > 10 || positions[baseIndex + 0] < -10) velocities[baseIndex+0] *= -1;
                    }
                    obj.geometry.attributes.position.needsUpdate = true;
                }
                break;
        }
    });
}

// --- Main Animation Loop ---
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    if (!scene || !camera || !renderer) return;
    animateEffects();
    renderer.render(scene, camera);
}

function startAnimationLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animate();
}

// --- Global Function to Set Weather ---
window.setWeatherAnimation = function(weatherType) {
    if (!scene || !renderer) {
        console.warn("WEATHER_ANIMATIONS: Three.js scene/renderer not ready for animation type:", weatherType);
        return;
    }
    console.log("WEATHER_ANIMATIONS: Setting animation to: ", weatherType);
    currentAnimationType = weatherType.toLowerCase();

    clearAllEffects(); 

    // Base ambient light, can be overridden by specific effects
    const baseAmbient = new THREE.AmbientLight(0xffffff, 0.2); // Very dim base
    scene.add(baseAmbient);
    effectObjects.push(baseAmbient);

    switch (currentAnimationType) {
        case 'rain': case 'showers': case 'light rain': case 'moderate rain': case 'heavy rain':
            setupRain();
            const rainAmbient = new THREE.AmbientLight(0x607D8B, 0.7); // Cool, darker ambient
            scene.add(rainAmbient); effectObjects.push(rainAmbient);
            break;
        case 'sunny': case 'fair': case 'clear':
            setupSunny();
            break;
        case 'clear-night':
            // setupClearNight(); // Define this for stars etc.
            const nightAmbient = new THREE.AmbientLight(0x151525, 0.5); 
            scene.add(nightAmbient); effectObjects.push(nightAmbient);
            break;
        case 'cloudy': case 'mostly cloudy': case 'overcast':
            setupClouds(false);
            break;
        case 'partly cloudy': case 'partly sunny': case 'mostly clear': case 'mostly sunny':
            setupClouds(true);
            setupSunny(); // Combine with sunny elements
            break;
        case 'thunderstorm': case 'isolated thunderstorms': case 'scattered thunderstorms':
            setupThunderstorm();
            break;
        case 'snow': case 'light snow': case 'heavy snow': case 'flurries': case 'sleet':
            setupSnow();
            const snowAmbient = new THREE.AmbientLight(0x9090aa, 0.8);
            scene.add(snowAmbient); effectObjects.push(snowAmbient);
            break;
        case 'windy': case 'breezy':
            setupWind(); // Define setupWind() similar to others
            const windAmbient = new THREE.AmbientLight(0xffffff, 0.4);
            scene.add(windAmbient); effectObjects.push(windAmbient);
            break;
        case 'fog': case 'mist': case 'haze': case 'dense fog':
            setupClouds(true); // Light clouds often accompany fog
            scene.fog = new THREE.Fog(currentAnimationType === 'dense fog' ? 0x777777 : 0xaaaaaa, 1, 
                                     currentAnimationType === 'dense fog' ? 10 : 15);
            const fogAmbient = new THREE.AmbientLight(0xbbbbbb, 0.9);
            scene.add(fogAmbient); effectObjects.push(fogAmbient);
            break;
        case 'default':
        default:
             // Base ambient light is already added.
            break;
    }
};
