import { JSDOM } from 'jsdom';

if (typeof window !== 'undefined') {
  const storage = new JSDOM('', { url: 'http://localhost:3000' }).window.localStorage;
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage
  });
}
