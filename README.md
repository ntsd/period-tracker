# 🌸 Period Tracker

A PWA (Progressive Web App) for menstrual cycle tracking, designed with simplicity and privacy in mind. Built with Astro v5, Flowbite, and FullCalendar for a professional and intuitive experience.

## ✨ Features

- **📱 Progressive Web App**: Install on your device for a native app experience
- **🔒 Privacy First**: All data is stored locally on your device - nothing is shared or sent to external servers
- **📅 Advanced Calendar**: Full-featured calendar with FullCalendar integration
- **🌙 Dark Mode**: Beautiful dark/light theme toggle with system preference detection
- **📊 Visual Tracking**: Color-coded period days, ovulation predictions, and fertile windows
- **📝 Daily Notes**: Add symptoms, notes, and track daily health information
- **� Smart Analytics**: Cycle length tracking, period duration, and pattern analysis
- **💾 Data Management**: Export/import your data for backup and portability
- **🎨 Professional UI**: Built with Flowbite components and Tailwind CSS
- **⚡ Lightning Fast**: Static site generation with optimal performance

## 🚀 Tech Stack

- **[Astro v5.13.2](https://astro.build/)** - Static site generator
- **[Flowbite v3.1.2](https://flowbite.com/)** - Component library and UI kit
- **[Tailwind CSS v3.4.17](https://tailwindcss.com/)** - Utility-first CSS framework
- **[FullCalendar v6.1.19](https://fullcalendar.io/)** - Full-featured calendar
- **TypeScript** - Type safety and better development experience
- **PWA APIs** - Service worker and web app manifest
- **LocalStorage** - Client-side data persistence

## 🏗️ Project Structure

```text
/
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                     # Service worker
│   ├── icon-192x192.png          # PWA icons
│   └── icon-512x512.png          
├── src/
│   ├── layouts/
│   │   └── Layout.astro          # Main layout with PWA integration
│   ├── pages/
│   │   └── index.astro           # Enhanced period tracker interface
│   ├── scripts/
│   │   ├── period-tracker.ts     # Original simple tracking logic
│   │   └── period-tracker-flowbite.ts # Enhanced Flowbite integration
│   └── styles/
│       └── global.css            # Tailwind + FullCalendar styles
├── tailwind.config.mjs           # Tailwind configuration with Flowbite
└── package.json
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `npm install`          | Installs dependencies                            |
| `npm run dev`          | Starts local dev server at `localhost:4321`     |
| `npm run build`        | Build your production site to `./dist/`         |
| `npm run preview`      | Preview your build locally, before deploying    |

## 📦 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd period-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.

## 🌐 Deployment

This app is built as a static site and can be deployed to any static hosting service:

- **Netlify**: Drop the `dist` folder or connect your Git repository
- **Vercel**: Import your Git repository  
- **GitHub Pages**: Upload the `dist` folder contents
- **Cloudflare Pages**: Connect your repository
- **Any web server**: Upload the `dist` folder contents

## 🎯 Enhanced Features

### � **Professional Calendar Integration**
- Full FullCalendar integration with multiple view modes (Month, Week, List)
- Visual period tracking with background highlighting
- Ovulation predictions based on cycle history
- Fertile window indicators
- Click to add notes on any day

### 📝 **Advanced Daily Tracking**
- **Symptoms Tracking**: Quick-select common symptoms (cramps, bloating, headache, mood changes, fatigue)
- **Daily Notes**: Add detailed notes for any day
- **Visual Indicators**: See notes and symptoms directly on the calendar

### 🌙 **Dark Mode Support**
- Automatic dark/light mode detection based on system preferences
- Manual theme toggle with persistent storage
- All components optimized for both themes

### 💾 **Data Management**
- **Export Data**: Download your complete tracking history as JSON
- **Import Data**: Restore from backup files
- **Clear Data**: Reset all tracking data (with confirmation)

### 📊 **Smart Analytics**
- Automatic cycle length calculation
- Period duration tracking
- Monthly statistics dashboard
- Visual progress indicators

## �🔐 Privacy & Security

- **Local Storage Only**: All your personal data stays on your device
- **No Tracking**: No analytics, no cookies, no external requests (except CDN for Flowbite)
- **No Registration**: Start using immediately without creating accounts
- **Offline Capable**: Works without internet connection once installed
- **Data Portability**: Export your data anytime for backup or migration

## 🎯 Usage

1. **Install the PWA**: When you visit the site, you'll get a prompt to install it on your device
2. **Start Tracking**: Click "Start Period" when your period begins
3. **Add Daily Notes**: Click any calendar day to add symptoms and notes
4. **End Period**: Click "End Period" when it ends
5. **View Analytics**: Check your dashboard for cycle insights
6. **Theme Toggle**: Switch between light and dark modes
7. **Data Management**: Use the menu to export/import your data

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Astro](https://astro.build/) - The web framework for content-driven websites
- Styled with [Flowbite](https://flowbite.com/) - Tailwind CSS component library
- Calendar powered by [FullCalendar](https://fullcalendar.io/) - The most popular JavaScript calendar
- Styled with [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework
