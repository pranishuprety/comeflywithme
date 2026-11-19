import './style.css';
import { Game } from './core/Game';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app not found');

new Game(app);
