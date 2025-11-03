import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Amro-s-Final-Project/',  // ✅ keep this
  appType: 'mpa',                  // ✅ enable multi-page mode
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',                 // your main entry
        about: 'AboutMe/aboutMe.html',       // your About Me page
      },
    },
  },
});
