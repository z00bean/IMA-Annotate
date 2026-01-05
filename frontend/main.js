/ ==================== main.js ====================
import { state } from './state.js';
import { initCanvas, loadImage } from './canvas.js';
import { initToolbar } from './toolbar.js';
import { initNavigation, navigateToIndex } from './navigation.js';
import { fetchImageList, checkAPIConnection } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
initCanvas();
initToolbar();
initNavigation();

checkAPIConnection();

// Load local sample images directly from img/ folder
state.images = [
{id: 1, url: 'img/img-sc1.jpg'},
{id: 2, url: 'img/img-sc2.jpg'},
{id: 3, url: 'img/img-sc3.jpg'}
];

if (state.images.length > 0) {
state.currentIndex = 0;
await navigateToIndex(state.currentIndex);
}
});

