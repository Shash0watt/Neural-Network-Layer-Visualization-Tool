import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let layerData = [
    { name: 'Input (x)', H: 180, W: 320, C: 2 },
    { name: 'Initial Max Pool', H: 45, W: 80, C: 1 },
    { name: 'self.conv1', H: 42, W: 77, C: 8 },
    { name: 'Post-Conv1 Max Pool', H: 21, W: 38, C: 8 },
    { name: 'self.lif1', H: 21, W: 38, C: 8 },
    { name: 'self.conv2', H: 18, W: 35, C: 16 },
    { name: 'Post-Conv2 Max Pool', H: 9, W: 17, C: 16 },
    { name: 'self.lif2', H: 9, W: 17, C: 16 },
    { name: 'Flatten', H: 1, W: 1, C: 2448 },
    { name: 'self.fc1', H: 1, W: 1, C: 1 },
    { name: 'self.lif3', H: 1, W: 1, C: 1 }
];

let scene, camera, renderer, controls;
let labelRenderer; 
const networkGroup = new THREE.Group();
let totalZLength = 0;

// --- Global Settings ---
let gap = 2; 
let labelDistance = 3.0;
let labelFontSize = 12;
let blockOpacity = 0.85;
let showLabelBox = true; // Toggle for label borders

// Multiplier Variables
let heightMultiplier = 1.5;
let widthMultiplier = 1.5;
let channelMultiplier = 1.5;
// --- End Global Settings ---

const frustumSize = 100;
const showNameLabels = true; 

// Make colorMap mutable
let colorMap = {
    'Input': 0x4285F4,
    'Pool': 0xDB4437,
    'Conv': 0xF4B400,
    'LIF': 0x0F9D58,
    'Flatten': 0xAB47BC,
    'FC': 0xFF6D00,
};
const defaultColor = 0xAAAAAA;

function getLayerType(name) {
    const lowerName = name.toLowerCase();
    // Check against colorMap keys first
    for (const typeName in colorMap) {
        if (lowerName.includes(typeName.toLowerCase())) {
            return typeName;
        }
    }
    // Fallback checks
    if (lowerName.includes('input')) return 'Input';
    if (lowerName.includes('pool')) return 'Pool';
    if (lowerName.includes('conv')) return 'Conv';
    if (lowerName.includes('lif')) return 'LIF';
    if (lowerName.includes('flatten')) return 'Flatten';
    if (lowerName.includes('fc')) return 'FC';
    return 'Default';
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
         frustumSize * aspect / 2,
         frustumSize / 2,
        -frustumSize / 2,
         0.1,
         2000
    );
    
    camera.position.set(50, 50, 50);
    camera.zoom = 1.0;
    camera.updateProjectionMatrix();

    renderer = new THREE.WebGLRenderer({ antialiased: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none'; 
    document.body.appendChild(labelRenderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xcccccc, 1.2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(1, 1, 0.5);
    scene.add(directionalLight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

    // Call setupFontPicker *before* createNetwork
    // so the labels are created with the correct initial font.
    setupFontPicker();
    createNetwork();
    createLegend(); 
    setupEditPanelListeners();

    const centerZ = totalZLength / 2;
    camera.lookAt(0, 0, centerZ);
    controls.target.set(0, 0, centerZ);
    camera.position.set(40, 40, 40 + centerZ);
    controls.update();

    window.addEventListener('resize', onWindowResize);
}

function createLegend() {
    const legend = document.getElementById('legend');
    // Clear everything except the title
    const items = legend.querySelectorAll('.legend-item');
    items.forEach(item => item.remove());

    const addedTypes = new Set();
    for (const layerType in colorMap) {
        if (!addedTypes.has(layerType)) {
            const color = colorMap[layerType];
            const hexColor = '#' + new THREE.Color(color).getHexString();

            // Use original class names
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color-box';
            colorBox.style.backgroundColor = hexColor;
            
            const text = document.createElement('span');
            text.textContent = layerType;
            
            item.appendChild(colorBox);
            item.appendChild(text);
            legend.appendChild(item);
            
            addedTypes.add(layerType);
        }
    }
}

function createNetwork() {
    let currentZ = 0;
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    
    const lineOffset = Math.max(0.1, labelDistance - 0.2); 
    
    // Get the current font from the body
    const currentFont = document.body.style.fontFamily || "Times New Roman";

    layerData.forEach((layer, i) => {
        // Use Multiplier Variables
        const visual_W = Math.log(layer.W + 1) * widthMultiplier;
        const visual_H = Math.log(layer.H + 1) * heightMultiplier;
        const visual_C = Math.log(layer.C + 1) * channelMultiplier;

        const geometry = new THREE.BoxGeometry(visual_W, visual_H, visual_C);
        
        const layerColor = layer.color !== undefined 
            ? layer.color 
            : (colorMap[getLayerType(layer.name)] || defaultColor);
        
        const material = new THREE.MeshLambertMaterial({
            color: layerColor,
            transparent: true,
            opacity: blockOpacity
        });

        const mesh = new THREE.Mesh(geometry, material);
        const meshCenterZ = currentZ + visual_C / 2;
        mesh.position.set(0, 0, meshCenterZ);
        
        networkGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, outlineMaterial);
        line.position.copy(mesh.position); 
        networkGroup.add(line);

        // Dimension Label
        const dimLabelDiv = document.createElement('div');
        dimLabelDiv.className = 'label';
        // Add class to remove border if toggled
        if (!showLabelBox) { 
            dimLabelDiv.classList.add('label-no-border'); 
        }
        dimLabelDiv.textContent = `${layer.H}x${layer.W}x${layer.C}`;
        dimLabelDiv.style.fontSize = `${labelFontSize}px`;
        dimLabelDiv.style.fontFamily = currentFont;
        
        const dimLabel = new CSS2DObject(dimLabelDiv);
        dimLabel.position.set(0, -visual_H / 2 - labelDistance, meshCenterZ); 
        networkGroup.add(dimLabel);

        // Callout line for dimension label
        const dimLinePoints = [
            new THREE.Vector3(0, -visual_H / 2, meshCenterZ),
            new THREE.Vector3(0, -visual_H / 2 - lineOffset, meshCenterZ)
        ];
        const dimLineGeo = new THREE.BufferGeometry().setFromPoints(dimLinePoints);
        const dimLineMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 });
        const dimLine = new THREE.Line(dimLineGeo, dimLineMat);
        networkGroup.add(dimLine);

        // Name Label
        if (showNameLabels) {
            const nameLabelDiv = document.createElement('div');
            nameLabelDiv.className = 'label';
            // Add class to remove border if toggled
            if (!showLabelBox) { 
                nameLabelDiv.classList.add('label-no-border'); 
            }
            nameLabelDiv.textContent = layer.name;
            nameLabelDiv.style.fontSize = `${labelFontSize}px`;
            nameLabelDiv.style.fontFamily = currentFont;
            
            const nameLabel = new CSS2DObject(nameLabelDiv);
            nameLabel.position.set(0, visual_H / 2 + labelDistance, meshCenterZ); 
            networkGroup.add(nameLabel);

            // Callout line for name label
            const nameLinePoints = [
                new THREE.Vector3(0, visual_H / 2, meshCenterZ),
                new THREE.Vector3(0, visual_H / 2 + lineOffset, meshCenterZ)
            ];
            const nameLineGeo = new THREE.BufferGeometry().setFromPoints(nameLinePoints);
            const nameLineMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 });
            const nameLine = new THREE.Line(nameLineGeo, nameLineMat);
            networkGroup.add(nameLine);
        }

        // Connector lines
        if (i > 0) {
            const prevLayer = layerData[i-1];
            // Use Multiplier Variable
            const prev_visual_C = Math.log(prevLayer.C + 1) * channelMultiplier;
            const prevLayerZEnd = currentZ - gap;
            const prevLayerCenterZ = prevLayerZEnd - prev_visual_C / 2;

            const points = [
                new THREE.Vector3(0, 0, prevLayerCenterZ + prev_visual_C / 2),
                new THREE.Vector3(0, 0, meshCenterZ - visual_C / 2)
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 });
            const connector = new THREE.Line(lineGeo, lineMat);
            networkGroup.add(connector);
        }

        currentZ += visual_C + gap;
    });

    scene.add(networkGroup);
    totalZLength = currentZ - gap;
}

// --- Functions for Edit Panel ---

/**
 * Updates the font-family for the body, legend, and all 3D labels.
 * @param {string} fontFamily - The CSS font-family string (e.g., "Arial")
 */
function updateGlobalFont(fontFamily) {
    // 1. Change main body font
    document.body.style.fontFamily = fontFamily;
    
    // 2. Keep the edit panel font as 'Space Mono'
    const monoPanel = document.querySelector('.font-mono');
    if (monoPanel) {
        monoPanel.style.fontFamily = 'Space Mono, monospace';
    }
    
    // 3. Re-apply font to the legend
    const legend = document.getElementById('legend');
    if (legend) {
        legend.style.fontFamily = fontFamily;
    }
    
    // 4. Re-apply font to all existing 3D labels
    document.querySelectorAll('.label').forEach(label => {
        label.style.fontFamily = fontFamily;
    });
}

function setupFontPicker() {
    const fonts = ["Times New Roman", "Arial", "Courier New", "Georgia", "Verdana"];
    const fontPicker = document.getElementById('font-picker');
    
    fontPicker.innerHTML = ''; 
    const defaultFont = "Times New Roman";

    // Set initial font for body, legend, and labels
    updateGlobalFont(defaultFont); 

    fonts.forEach(font => {
        const option = document.createElement('option');
        option.value = font;
        option.textContent = font;
        if (font === defaultFont) {
            option.selected = true;
        }
        fontPicker.appendChild(option);
    });

    // Use the new function on change
    fontPicker.addEventListener('change', (e) => {
        updateGlobalFont(e.target.value);
    });
}

function setupEditPanelListeners() {
    const overlay = document.getElementById('edit-panel-overlay');
    const showBtn = document.getElementById('show-edit-panel-btn');
    const closeBtn = document.getElementById('close-panel-btn');
    const updateBtn = document.getElementById('update-network-btn');
    const addLayerBtn = document.getElementById('add-layer-btn');
    const addTypeBtn = document.getElementById('add-type-btn');
    
    const labelSlider = document.getElementById('label-distance');
    const labelValue = document.getElementById('label-distance-value');
    const gapSlider = document.getElementById('cube-gap');
    const gapValue = document.getElementById('cube-gap-value');
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const opacitySlider = document.getElementById('block-opacity');
    const opacityValue = document.getElementById('block-opacity-value');

    // Add Label Border Toggle
    const labelBordersToggle = document.getElementById('label-borders');

    // Add Multiplier Sliders
    const heightMultSlider = document.getElementById('height-multiplier');
    const heightMultValue = document.getElementById('height-multiplier-value');
    const widthMultSlider = document.getElementById('width-multiplier');
    const widthMultValue = document.getElementById('width-multiplier-value');
    const channelMultSlider = document.getElementById('channel-multiplier');
    const channelMultValue = document.getElementById('channel-multiplier-value');

    showBtn.addEventListener('click', () => {
        populateEditPanel();
        populateLegendPanel();

        // Set initial values for all sliders and toggles
        labelSlider.value = labelDistance;
        labelValue.textContent = labelDistance.toFixed(1);
        gapSlider.value = gap;
        gapValue.textContent = gap.toFixed(1);
        fontSizeSlider.value = labelFontSize;
        fontSizeValue.textContent = labelFontSize;
        opacitySlider.value = blockOpacity;
        opacityValue.textContent = blockOpacity.toFixed(2);

        heightMultSlider.value = heightMultiplier;
        heightMultValue.textContent = heightMultiplier.toFixed(1);
        widthMultSlider.value = widthMultiplier;
        widthMultValue.textContent = widthMultiplier.toFixed(1);
        channelMultSlider.value = channelMultiplier;
        channelMultValue.textContent = channelMultiplier.toFixed(1);

        labelBordersToggle.checked = showLabelBox;

        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    });

    closeBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    });

    addLayerBtn.addEventListener('click', () => {
        addLayerRow({ name: 'New Layer', H: 1, W: 1, C: 1 });
    });

    addTypeBtn.addEventListener('click', () => {
        addLegendRow('NewType', '#aaaaaa');
    });

    updateBtn.addEventListener('click', () => {
        rebuildNetworkFromPanel();
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    });

    // --- Add listeners for sliders ---
    labelSlider.addEventListener('input', (e) => {
        labelValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
    gapSlider.addEventListener('input', (e) => {
        gapValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
    fontSizeSlider.addEventListener('input', (e) => {
        fontSizeValue.textContent = e.target.value;
    });
    opacitySlider.addEventListener('input', (e) => {
        opacityValue.textContent = parseFloat(e.target.value).toFixed(2);
    });
    heightMultSlider.addEventListener('input', (e) => {
        heightMultValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
    widthMultSlider.addEventListener('input', (e) => {
        widthMultValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
    channelMultSlider.addEventListener('input', (e) => {
        channelMultValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
    // No listener needed for the checkbox, it's read on "Update"
}

function populateEditPanel() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    layerData.forEach(layer => {
        addLayerRow(layer);
    });
}

function populateLegendPanel() {
    const list = document.getElementById('legend-list');
    list.innerHTML = '';
    for (const typeName in colorMap) {
        const hexColor = '#' + new THREE.Color(colorMap[typeName]).getHexString();
        addLegendRow(typeName, hexColor);
    }
}

function addLayerRow(layer) {
    const list = document.getElementById('layer-list');
    const row = document.createElement('div');
    row.className = 'flex items-center p-2 space-x-2';
    
    const initialColor = layer.color !== undefined 
        ? layer.color 
        : (colorMap[getLayerType(layer.name)] || defaultColor);
    const hexColor = '#' + new THREE.Color(initialColor).getHexString();

    // Use Tailwind classes for inputs
    row.innerHTML = `
        <input type="text" name="name" value="${layer.name}" class="h-9 border border-input bg-background rounded-md px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" style="flex: 1;">
        <input type="number" name="H" value="${layer.H}" min="1" class="h-9 border border-input bg-background rounded-md px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" style="width: 80px;">
        <input type="number" name="W" value="${layer.W}" min="1" class="h-9 border border-input bg-background rounded-md px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" style="width: 80px;">
        <input type="number" name="C" value="${layer.C}" min="1" class="h-9 border border-input bg-background rounded-md px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring" style="width: 80px;">
        <input type="color" name="color" value="${hexColor}" class="h-9 w-11 p-0 border-none rounded-md cursor-pointer" style="width: 44px;">
        <button class="remove-btn h-9 w-9 p-0 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center transition-colors">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
    `;
    
    row.querySelector('.remove-btn').addEventListener('click', () => {
        row.remove();
    });

    list.appendChild(row);
}

function addLegendRow(typeName, hexColor) {
    const list = document.getElementById('legend-list');
    const row = document.createElement('div');
    row.className = 'flex items-center p-2 space-x-2';
    
    row.innerHTML = `
        <input type="text" name="type-name" value="${typeName}" class="h-9 border border-input bg-background rounded-md px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring flex-[3]">
        <input type="color" name="type-color" value="${hexColor}" class="h-9 p-0 border-none rounded-md cursor-pointer flex-[1]">
        <button class="remove-btn h-9 w-9 p-0 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center transition-colors">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
    `;
    
    row.querySelector('.remove-btn').addEventListener('click', () => {
        row.remove();
    });

    list.appendChild(row);
}

function rebuildColorMapFromPanel() {
    const list = document.getElementById('legend-list');
    const rows = list.querySelectorAll('.flex');
    const newColorMap = {};
    
    rows.forEach(row => {
        const nameInput = row.querySelector('input[name="type-name"]');
        const colorInput = row.querySelector('input[name="type-color"]');
        if (nameInput && colorInput) {
            const typeName = nameInput.value;
            const colorHex = colorInput.value;
            newColorMap[typeName] = new THREE.Color(colorHex).getHex();
        }
    });
    colorMap = newColorMap;
}

function rebuildNetworkFromPanel() {
    rebuildColorMapFromPanel(); // Rebuild map first

    const list = document.getElementById('layer-list');
    const rows = list.querySelectorAll('.flex'); // Selects the rows
    const newLayerData = [];

    // Read all general settings from the panel
    labelDistance = parseFloat(document.getElementById('label-distance').value) || 3.0;
    gap = parseFloat(document.getElementById('cube-gap').value) || 2.0;
    labelFontSize = parseInt(document.getElementById('font-size').value) || 12; 
    blockOpacity = parseFloat(document.getElementById('block-opacity').value);
    showLabelBox = document.getElementById('label-borders').checked; // Read toggle value

    // Read Multiplier Values
    heightMultiplier = parseFloat(document.getElementById('height-multiplier').value) || 1.5;
    widthMultiplier = parseFloat(document.getElementById('width-multiplier').value) || 1.5;
    channelMultiplier = parseFloat(document.getElementById('channel-multiplier').value) || 1.5;

    // Read layer data from the panel
    rows.forEach(row => {
        const nameInput = row.querySelector('input[name="name"]');
        const hInput = row.querySelector('input[name="H"]');
        const wInput = row.querySelector('input[name="W"]');
        const cInput = row.querySelector('input[name="C"]');
        const colorInput = row.querySelector('input[name="color"]');

        if (nameInput && hInput && wInput && cInput && colorInput) {
            const name = nameInput.value;
            const H = parseInt(hInput.value) || 1;
            const W = parseInt(wInput.value) || 1;
            const C = parseInt(cInput.value) || 1;
            const colorHex = colorInput.value;
            const color = new THREE.Color(colorHex).getHex();
            newLayerData.push({ name, H, W, C, color });
        }
    });

    layerData = newLayerData;

    // Clear the old network
    while (networkGroup.children.length > 0) {
        const child = networkGroup.children[0];
        networkGroup.remove(child);
        // Dispose geometry and materials if needed
    }

    // Reset state and rebuild
    totalZLength = 0;
    createNetwork();
    createLegend(); // Update legend

    // Recenter camera
    const centerZ = totalZLength / 2;
    camera.lookAt(0, 0, centerZ);
    controls.target.set(0, 0, centerZ);
    camera.position.set(40, 40, 40 + centerZ);
    controls.update();
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight); 
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera); 
}

init();
animate();
