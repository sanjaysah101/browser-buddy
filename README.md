# Productivity Pal - Chrome Extension

Productivity Pal is a Chrome extension designed to help users track and improve their productivity by monitoring website usage, categorizing sites, and providing timely break reminders.

## Features

### Website Tracking & Categorization

- 📊 Tracks time spent on different websites
- 🏷️ Categorizes websites as productive, neutral, or unproductive
- 🤖 AI-powered automatic website categorization using Google's Gemini AI
- 📈 Real-time productivity score calculation

### Break Reminders

- ⏰ Customizable break intervals
- 🔔 Smart break notifications
- 🏃‍♂️ Break duration tracking
- 💪 Encourages healthy work habits

### User Interface

- 📱 Clean and intuitive popup interface
- 📊 Real-time statistics dashboard
- ⚙️ Customizable settings
- 🎨 Modern design with Tailwind CSS

## Demo

[![Productivity Pal | Chrome Extension](https://img.youtube.com/vi/pWEe6_GOU1o/0.jpg)](https://youtu.be/pWEe6_GOU1o)


## Installation

1. Clone the repository:

```bash
https://github.com/sanjaysah101/browser-buddy
```

2. Install dependencies:

```bash
pnpm i
```

3. Create a `.env` file in the root directory and add your Gemini API key:

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

4. Build the extension:

```bash
pnpm run build
```

5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from your project

## Usage

1. **View Statistics**
   - Click the extension icon to view your productivity dashboard
   - See time spent on different websites
   - Check your overall productivity score

2. **Categorize Websites**
   - Manually categorize websites as productive, neutral, or unproductive
   - Use AI categorization for automatic suggestions
   - View and manage website categories

3. **Break Reminders**
   - Set custom break intervals and durations
   - Receive notifications when it's time for a break
   - Track break compliance

## Technology Stack

- ⚛️ React
- 🎨 Tailwind CSS
- 🤖 Google Gemini AI
- 🏗️ TypeScript
- 🛠️ Vite
- 🧩 Chrome Extension APIs

## Project Structure

```bash
productivity-pal/
├── src/
│   ├── popup/           # Extension popup UI
│   ├── background/      # Background service worker
│   ├── services/        # Shared services
│   └── assets/         # Static assets
├── public/             # Public assets
└── dist/              # Built extension
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Google Gemini AI for website categorization
- Chrome Extension APIs
- React and Tailwind CSS communities

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.
