// ==================== navigation.js ====================
import { state } from './state.js';
import { loadImage } from './canvas.js';

export function initNavigation() {
const el = document.getElementById('navigation');
el.innerHTML =     <button id="prevBtn">Previous</button>
    <button id="nextBtn">Next</button>
 ;

document.getElementById('prevBtn').onclick = () => navigate(-1);
document.getElementById('nextBtn').onclick = () => navigate(1);
}

export async function navigateToIndex(index) {
if (index < 0 || index >= state.images.length) return;
state.currentIndex = index;
const imgMeta = state.images[state.currentIndex];

const img = new Image();
img.src = imgMeta.url; // load directly from local img folder
img.onload = () => {
state.currentImage = img;
state.annotations = [];
loadImage(img);
};
}

async function navigate(delta) {
const newIndex = state.currentIndex + delta;
await navigateToIndex(newIndex);
}