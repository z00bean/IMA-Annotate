import { state } from './state.js';
let drawing = false;
let startX, startY;

export function initCanvas() {
canvas = document.getElementById('imageCanvas');
ctx = canvas.getContext('2d');

canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseup', onMouseUp);
}

export function loadImage(img) {
canvas.width = img.width;
canvas.height = img.height;
ctx.drawImage(img, 0, 0);
}

function onMouseDown(e) {
if (state.mode !== 'draw') return;
drawing = true;
startX = e.offsetX;
startY = e.offsetY;
}

function onMouseMove(e) {
if (!drawing) return;

redraw();
const w = e.offsetX - startX;
const h = e.offsetY - startY;
ctx.strokeStyle = 'red';
ctx.lineWidth = 2;
ctx.strokeRect(startX, startY, w, h);
}

function onMouseUp(e) {
if (!drawing) return;
drawing = false;

state.annotations.push({
x: startX,
y: startY,
w: e.offsetX - startX,
h: e.offsetY - startY,
label: 'UNLABELED'
});

redraw();
}

function redraw() {
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.drawImage(state.currentImage, 0, 0);

state.annotations.forEach(a => {
ctx.strokeStyle = 'lime';
ctx.strokeRect(a.x, a.y, a.w, a.h);
});
}