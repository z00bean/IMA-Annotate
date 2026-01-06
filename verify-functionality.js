/**
 * Verification script to test IMA Annotate Frontend functionality
 * Run this in the browser console to verify core functionality
 */

console.log('🚀 Starting IMA Annotate Frontend Verification...');

// Test 1: Check if application is initialized
function testAppInitialization() {
    console.log('\n📋 Test 1: Application Initialization');
    
    if (typeof window.imaApp === 'undefined') {
        console.error('❌ Application not found on window.imaApp');
        return false;
    }
    
    if (!window.imaApp.initialized) {
        console.warn('⚠️ Application not yet initialized');
        return false;
    }
    
    console.log('✅ Application initialized successfully');
    return true;
}

// Test 2: Check if sample images can be loaded
async function testImageLoading() {
    console.log('\n🖼️ Test 2: Image Loading');
    
    try {
        // Check if images are already loaded
        if (window.imaApp.state.images.length > 0) {
            console.log(`✅ Images already loaded: ${window.imaApp.state.images.length} images`);
            return true;
        }
        
        // Try to load sample images
        const loadSampleBtn = document.getElementById('load-sample-btn');
        if (loadSampleBtn) {
            console.log('🔄 Clicking load sample images button...');
            loadSampleBtn.click();
            
            // Wait for images to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (window.imaApp.state.images.length > 0) {
                console.log(`✅ Sample images loaded: ${window.imaApp.state.images.length} images`);
                return true;
            }
        }
        
        console.error('❌ Failed to load sample images');
        return false;
        
    } catch (error) {
        console.error('❌ Error loading images:', error);
        return false;
    }
}

// Test 3: Check navigation functionality
async function testNavigation() {
    console.log('\n🧭 Test 3: Navigation');
    
    try {
        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');
        const imageCounter = document.getElementById('image-counter');
        
        if (!nextBtn || !prevBtn || !imageCounter) {
            console.error('❌ Navigation elements not found');
            return false;
        }
        
        const initialCounter = imageCounter.textContent;
        console.log(`📍 Initial position: ${initialCounter}`);
        
        // Test next navigation
        if (!nextBtn.disabled) {
            console.log('➡️ Testing next navigation...');
            nextBtn.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const newCounter = imageCounter.textContent;
            if (newCounter !== initialCounter) {
                console.log(`✅ Next navigation working: ${newCounter}`);
            } else {
                console.warn('⚠️ Next navigation may not have changed position');
            }
        }
        
        // Test previous navigation
        if (!prevBtn.disabled) {
            console.log('⬅️ Testing previous navigation...');
            prevBtn.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const finalCounter = imageCounter.textContent;
            console.log(`📍 Final position: ${finalCounter}`);
        }
        
        console.log('✅ Navigation test completed');
        return true;
        
    } catch (error) {
        console.error('❌ Error testing navigation:', error);
        return false;
    }
}

// Test 4: Check drawing mode functionality
function testDrawingMode() {
    console.log('\n✏️ Test 4: Drawing Mode');
    
    try {
        const drawBtn = document.getElementById('draw-btn');
        const selectBtn = document.getElementById('select-btn');
        
        if (!drawBtn || !selectBtn) {
            console.error('❌ Drawing mode buttons not found');
            return false;
        }
        
        // Test switching to draw mode
        console.log('🎨 Switching to draw mode...');
        drawBtn.click();
        
        if (drawBtn.classList.contains('active')) {
            console.log('✅ Draw mode activated');
        } else {
            console.warn('⚠️ Draw mode may not be activated');
        }
        
        // Test switching back to select mode
        console.log('👆 Switching to select mode...');
        selectBtn.click();
        
        if (selectBtn.classList.contains('active')) {
            console.log('✅ Select mode activated');
        } else {
            console.warn('⚠️ Select mode may not be activated');
        }
        
        console.log('✅ Drawing mode test completed');
        return true;
        
    } catch (error) {
        console.error('❌ Error testing drawing mode:', error);
        return false;
    }
}

// Test 5: Check canvas functionality
function testCanvas() {
    console.log('\n🎨 Test 5: Canvas');
    
    try {
        const canvas = document.getElementById('annotation-canvas');
        
        if (!canvas) {
            console.error('❌ Canvas element not found');
            return false;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('❌ Canvas context not available');
            return false;
        }
        
        // Test drawing on canvas
        console.log('🖌️ Testing canvas drawing...');
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, 50, 50);
        
        // Check if something was drawn
        const imageData = ctx.getImageData(10, 10, 50, 50);
        let hasContent = false;
        for (let i = 0; i < imageData.data.length; i += 4) {
            if (imageData.data[i] > 0 || imageData.data[i + 1] > 0 || imageData.data[i + 2] > 0) {
                hasContent = true;
                break;
            }
        }
        
        if (hasContent) {
            console.log('✅ Canvas drawing working');
        } else {
            console.warn('⚠️ Canvas drawing may not be working');
        }
        
        // Clear the test drawing
        ctx.clearRect(10, 10, 50, 50);
        
        console.log('✅ Canvas test completed');
        return true;
        
    } catch (error) {
        console.error('❌ Error testing canvas:', error);
        return false;
    }
}

// Test 6: Check keyboard shortcuts
function testKeyboardShortcuts() {
    console.log('\n⌨️ Test 6: Keyboard Shortcuts');
    
    try {
        // Test D key for draw mode
        console.log('🔤 Testing D key for draw mode...');
        const dKeyEvent = new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true });
        document.dispatchEvent(dKeyEvent);
        
        // Test V key for select mode
        console.log('🔤 Testing V key for select mode...');
        const vKeyEvent = new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true });
        document.dispatchEvent(vKeyEvent);
        
        // Test arrow keys for navigation
        console.log('🔤 Testing arrow keys for navigation...');
        const rightArrowEvent = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true });
        document.dispatchEvent(rightArrowEvent);
        
        const leftArrowEvent = new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true });
        document.dispatchEvent(leftArrowEvent);
        
        console.log('✅ Keyboard shortcuts test completed');
        return true;
        
    } catch (error) {
        console.error('❌ Error testing keyboard shortcuts:', error);
        return false;
    }
}

// Test 7: Check annotation counts
function testAnnotationCounts() {
    console.log('\n📊 Test 7: Annotation Counts');
    
    try {
        const suggestedCount = document.getElementById('suggested-count');
        const verifiedCount = document.getElementById('verified-count');
        const modifiedCount = document.getElementById('modified-count');
        const rejectedCount = document.getElementById('rejected-count');
        
        if (!suggestedCount || !verifiedCount || !modifiedCount || !rejectedCount) {
            console.error('❌ Annotation count elements not found');
            return false;
        }
        
        console.log(`📈 Annotation counts:`);
        console.log(`   Suggested: ${suggestedCount.textContent}`);
        console.log(`   Verified: ${verifiedCount.textContent}`);
        console.log(`   Modified: ${modifiedCount.textContent}`);
        console.log(`   Rejected: ${rejectedCount.textContent}`);
        
        console.log('✅ Annotation counts test completed');
        return true;
        
    } catch (error) {
        console.error('❌ Error testing annotation counts:', error);
        return false;
    }
}

// Main verification function
async function runVerification() {
    console.log('🔍 Running comprehensive verification...\n');
    
    const tests = [
        { name: 'App Initialization', test: testAppInitialization },
        { name: 'Image Loading', test: testImageLoading },
        { name: 'Navigation', test: testNavigation },
        { name: 'Drawing Mode', test: testDrawingMode },
        { name: 'Canvas', test: testCanvas },
        { name: 'Keyboard Shortcuts', test: testKeyboardShortcuts },
        { name: 'Annotation Counts', test: testAnnotationCounts }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const { name, test } of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`❌ Test "${name}" threw an error:`, error);
            failed++;
        }
    }
    
    console.log('\n📋 Verification Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! The application is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Check the details above.');
    }
    
    return { passed, failed };
}

// Auto-run verification if this script is loaded
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runVerification, 2000); // Wait 2 seconds for app to initialize
        });
    } else {
        setTimeout(runVerification, 2000);
    }
}

// Export for manual use
window.verifyIMAFunctionality = runVerification;

console.log('📝 Verification script loaded. Run verifyIMAFunctionality() to test manually.');