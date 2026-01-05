/ ==================== api.js ====================
import { CONFIG } from './config.js';

// For testing, we load local images from img folder
export async function fetchImageList() {
// Local image paths
return [
{id: 1, url: 'img/img-sc1.jpg'},
{id: 2, url: 'img/img-sc2.jpg'},
{id: 3, url: 'img/img-sc3.jpg'}
];
}

export async function fetchImageById(id) {
// In local mode, id is index+1, return blob of image
const images = await fetchImageList();
const imgObj = images.find(i => i.id === id);
if (!imgObj) throw new Error('Image not found');

const res = await fetch(imgObj.url);
return res.blob();
}

export async function fetchAnnotations(id) {
// Placeholder for DINO/SAM annotations
return [];
}

export async function saveAnnotations(id, annotations) {
console.log('Saving annotations for image', id, annotations);
return {success: true};
}

export function checkAPIConnection() {
const banner = document.getElementById('apiBanner');
if (!CONFIG.API_KEY || CONFIG.API_KEY.includes('<YOUR_API_KEY>')) {
banner.style.display = 'block';
} else {
banner.style.display = 'none';
}
}