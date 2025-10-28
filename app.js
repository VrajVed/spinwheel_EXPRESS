document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Configuration ---
    
    /**
     * Segment labels. Must have 8 items.
     * Uses <br> for line breaks.
     */
    const SEGMENTS = [
        "SPIN AGAIN",           // 1
        "SILVER<br>TONGUE",    // 2
        "FACT<br>CHECK",       // 3
        "INSURANCE<br>POLICY", // 4
        "SPIN AGAIN",           // 5
        "WHISPERER",            // 6
        "DECOY",                // 7
        "FOLLOW UP"             // 8
    ];

    // --- 2. DOM Elements ---
    const DOM = {
        wheelContainer: document.getElementById('wheel-container'),
        labelsContainer: document.getElementById('wheel-labels'),
        
        spinButton: document.getElementById('spin-button'),
        modal: document.getElementById('result-modal'),
        modalText: document.getElementById('result-text'),
        closeModalButton: document.getElementById('close-modal-button'),
        
        // History elements removed
        
        devControls: document.getElementById('dev-controls'),
        devSegmentSelect: document.getElementById('dev-segment-select'),
    };

    // --- 3. Game State ---
    let state = {
        isSpinning: false,
        currentRotation: 0,
        // history: [] removed
        devMode: false,
        forcedResult: null,
    };

    // --- 4. Initialization ---
    
    function init() {
        createWheel();
        initEventListeners();
        checkDevMode();
    }

    /**
     * Generates the text labels and positions them over the wheel image.
     */
    function createWheel() {
        const numSegments = SEGMENTS.length;
        const anglePerSegment = 360 / numSegments;
        
        // This is the distance from the center to place the text.
        const textRadius = 105; // Positioned closer to center
    
        DOM.labelsContainer.innerHTML = ''; // Clear any existing labels
    
        SEGMENTS.forEach((label, i) => {
            // Angle for the *center* of the segment
            const segmentCenterAngle = (i * anglePerSegment) + (anglePerSegment / 2);
            
            const labelText = document.createElement('div');
            labelText.className = 'wheel-label';
            
            // *** CHANGED ***
            // Use .innerHTML to render the <br> tags
            labelText.innerHTML = label; 
    
            // Convert angle to radians for trigonometry
            const angleRad = (segmentCenterAngle - 90) * (Math.PI / 180);
            
            // Calculate X and Y position
            const centerX = 200;
            const centerY = 200;
            const x = centerX + (textRadius * Math.cos(angleRad));
            const y = centerY + (textRadius * Math.sin(angleRad));
    
            // Convert (x, y) coordinates to CSS percentage (left, top)
            labelText.style.left = `${(x / 400) * 100}%`;
            labelText.style.top = `${(y / 400) * 100}%`;
            
            // Rotate the text itself to align radially
            labelText.style.transform = `translate(-50%, -50%) rotate(${segmentCenterAngle}deg)`;
    
            DOM.labelsContainer.appendChild(labelText);
        });
    
        // Set initial rotation
        state.currentRotation = 0;
        gsap.set(DOM.wheelContainer, { rotation: state.currentRotation, transformOrigin: '50% 50%' });
    }

    /**
     * Binds all event listeners for buttons and keys.
     */
    function initEventListeners() {
        DOM.spinButton.addEventListener('click', spinWheel);
        document.addEventListener('keydown', e => {
            if ((e.key === ' ' || e.key === 'Enter') && !state.isSpinning) {
                e.preventDefault(); // Prevent page scroll
                spinWheel();
            }
        });

        DOM.closeModalButton.addEventListener('click', hideModal);
        
        // History listeners removed
    }

    /**
     * Checks for `?dev=true` query string to enable test mode.
     */
    function checkDevMode() {
        const urlParams = new URLSearchParams(window.location.search);
        state.devMode = urlParams.get('dev') === 'true';

        if (state.devMode) {
            DOM.devControls.classList.add('show');
            // Populate dev dropdown
            SEGMENTS.forEach((label, index) => {
                const option = document.createElement('option');
                option.value = index;
                // Use textContent for the dropdown to avoid rendering HTML
                option.textContent = `${index}: ${label.replace(/<br>/g, ' ')}`;
                DOM.devSegmentSelect.appendChild(option);
            });
            // Listen for changes
            DOM.devSegmentSelect.addEventListener('change', (e) => {
                state.forcedResult = e.target.value ? parseInt(e.target.value, 10) : null;
            });
        }
    }

    // --- 5. Game Logic ---

    /**
     * Main function to trigger the spin.
     */
    function spinWheel() {
        if (state.isSpinning) return;

        // Start spin
        onSpinStart();

        // Check for reduced motion preference
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) {
            handleReducedMotion();
            return;
        }

        // --- Calculate Spin ---
        const numSegments = SEGMENTS.length;
        const anglePerSegment = 360 / numSegments;

        // 1. Determine target segment
        let targetIndex;
        if (state.devMode && state.forcedResult !== null) {
            targetIndex = state.forcedResult;
        } else {
            targetIndex = Math.floor(Math.random() * numSegments);
        }
        // Get label *without* HTML for the modal
        const targetLabel = SEGMENTS[targetIndex].replace(/<br>/g, ' ');

        // 2. Calculate rotation
        // Base rotations (e.g., 5-8 full spins)
        const minRotations = 5;
        const randomExtraRotations = Math.floor(Math.random() * 4);
        const totalBaseRotations = (minRotations + randomExtraRotations) * 360;

        // *** BUG FIX: NEW ROTATION LOGIC ***
        
        // The visual angle the wheel is currently at (e.g., -22.5 or 337.5)
        const currentAngle = state.currentRotation % 360;
        
        // The absolute target angle we want to land on
        // (e.g., index 0 = -22.5 deg, index 1 = -67.5 deg)
        const targetAngle = -((targetIndex * anglePerSegment) + (anglePerSegment / 2));

        // How much we need to spin:
        // 1. The full base rotations
        // 2. The difference between where we want to go (targetAngle) and where we are (currentAngle)
        // This ensures the wheel always spins *forward* and lands correctly.
        const additionalRotation = totalBaseRotations + (targetAngle - currentAngle);

        // The new final absolute rotation value
        const finalRotation = state.currentRotation + additionalRotation;
        
        // 3. Calculate random duration (3.5s to 6.0s)
        const spinDuration = Math.random() * 2.5 + 3.5;

        // 4. Animate with GSAP
        gsap.to(DOM.wheelContainer, {
            rotation: finalRotation,
            duration: spinDuration,
            ease: 'cubic.out', // Smooth deceleration
            onComplete: () => onSpinEnd(targetIndex, targetLabel)
        });

        // Store the final resting rotation
        state.currentRotation = finalRotation;
    }

    /**
     * Handles instant result for reduced motion.
     */
    function handleReducedMotion() {
        let targetIndex;
        if (state.devMode && state.forcedResult !== null) {
            targetIndex = state.forcedResult;
        } else {
            targetIndex = Math.floor(Math.random() * SEGMENTS.length);
        }
        const targetLabel = SEGMENTS[targetIndex].replace(/<br>/g, ' ');
        
        // Instantly set the wheel to the result
        const anglePerSegment = 360 / SEGMENTS.length;
        const targetRotation = -((targetIndex * anglePerSegment) + (anglePerSegment / 2));
        
        gsap.set(DOM.wheelContainer, { rotation: targetRotation });
        
        // *** BUG FIX ***
        // Store this as the new resting rotation
        state.currentRotation = targetRotation;
        
        // Show result after a short delay
        setTimeout(() => onSpinEnd(targetIndex, targetLabel), 500);
    }

    function onSpinStart() {
        console.log('Spin started...');
        state.isSpinning = true;
        DOM.spinButton.disabled = true;
        DOM.spinButton.setAttribute('aria-label', 'Spinning in progress');
    }

    function onSpinEnd(resultIndex, resultLabel) {
        console.log(`Spin ended. Result: ${resultLabel} (Index: ${resultIndex})`);
        state.isSpinning = false;
        
        // Reset dev mode forced result
        if (state.devMode) {
            state.forcedResult = null;
            DOM.devSegmentSelect.value = "";
        }

        // Show result modal
        showModal(resultLabel);
        
        // History update removed

        // Re-enable spin button
        DOM.spinButton.disabled = false;
        DOM.spinButton.setAttribute('aria-label', 'Spin the wheel');
    }

    // --- 6. UI Handlers (Modal) ---

    function showModal(resultLabel) {
        DOM.modalText.textContent = resultLabel;
        DOM.modal.classList.add('show');
        DOM.closeModalButton.focus(); // Focus the close button for accessibility
    }

    function hideModal() {
        DOM.modal.classList.remove('show');
        DOM.spinButton.focus(); // Return focus to the spin button
    }

    // History functions (updateHistory, showHistory, hideHistory) removed

    // --- Run Initialization ---
    init();

});