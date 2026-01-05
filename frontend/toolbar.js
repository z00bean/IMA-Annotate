import { state } from './state.js';

export function initToolbar() {
const el = document.getElementById('toolbar');

el.innerHTML = `
<button id="drawBtn">Draw</button>
<button id="selectBtn" class="secondary">Select</button>
<button id="clearBtn" class="danger">Clear</button>
`;

document.getElementById('drawBtn').onclick = () => state.mode = 'draw';
document.getElementById('selectBtn').onclick = () => state.mode = 'select';
document.getElementById('clearBtn').onclick = () => state.annotations = [];
}