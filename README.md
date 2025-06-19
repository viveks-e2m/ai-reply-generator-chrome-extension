# AI Email Reply Generator - Chrome Extension

A powerful Chrome Extension that helps users generate contextual email replies using AI based on the full email thread context.

## Features

### 🚀 Core Features
- **Smart Email Extraction**: Automatically extracts email content, subject, sender, and thread history
- **AI-Powered Replies**: Generates contextual replies using OpenAI's GPT models
- **Multiple Tone Options**: Choose from 4 different reply tones:
  - 😊 **Casual**: Friendly, conversational tone
  - 👔 **Formal**: Professional, business-appropriate tone
  - 💪 **Empowering**: Encouraging and motivational tone
  - 🚫 **Not Interested**: Polite but firm decline tone

### 🎯 Supported Email Clients
- **Gmail** (mail.google.com)
- **Outlook** (outlook.live.com, outlook.office.com)

### 🎨 User Interface
- **Popup Interface**: Modern, responsive popup for configuration and manual generation
- **Injected Buttons**: "🤖 AI Reply" buttons appear next to reply buttons in email clients
- **Real-time Notifications**: Status updates and error messages
- **Dark Mode Support**: Automatically adapts to system theme

## Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download the Extension**
   - Download and extract the extension files to a folder on your computer

2. **Open Chrome Extensions Page**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Configure API Key**
   - Click the extension icon in your browser toolbar
   - Enter your OpenAI API key in the popup
   - Click "Save API Key"

### Method 2: Install from Chrome Web Store (Coming Soon)
- The extension will be available on the Chrome Web Store soon

## Setup

### 1. Get OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to "API Keys" section
4. Create a new API key
5. Copy the API key (keep it secure!)

### 2. Configure the Extension
1. Click the extension icon in your browser toolbar
2. Enter your OpenAI API key in the "API Configuration" section
3. Click "Save API Key"
4. Select your preferred tone from the available options

## Usage

### Automatic Generation
1. **Open an email** in Gmail or Outlook
2. **Look for the "🤖 AI Reply" button** next to the regular reply button
3. **Click the AI Reply button** to generate a contextual reply
4. **Review and edit** the generated reply as needed
5. **Send** your email

### Manual Generation
1. **Click the extension icon** in your browser toolbar
2. **Select your preferred tone** from the options
3. **Click "Generate Reply"** to manually trigger generation
4. **The reply will be inserted** into your email client's reply field

### Tone Selection
- **Casual**: Perfect for personal emails, friends, and informal communication
- **Formal**: Ideal for business emails, professional contacts, and official communication
- **Empowering**: Great for motivational responses, encouragement, and positive reinforcement
- **Not Interested**: Useful for politely declining offers, requests, or invitations

## File Structure

```
ai-email-reply-generator/
├── manifest.json          # Extension configuration
├── popup.html             # Popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── content.js             # Content script for email clients
├── content.css            # Content script styling
├── background.js          # Background service worker
├── icons/                 # Extension icons
│   ├── icon16.png         # 16x16 icon
│   ├── icon32.png         # 32x32 icon
│   ├── icon48.png         # 48x48 icon
│   ├── icon128.png        # 128x128 icon
│   └── icon.svg           # Source SVG icon
├── generate_icons.html    # Icon generator utility
└── README.md              # This file
```

## Technical Details

### Permissions
- `activeTab`: Access to the current tab for email extraction
- `storage`: Save user preferences and API key
- `scripting`: Inject content scripts into email clients
- `host_permissions`: Access to Gmail and Outlook domains

### API Usage
- Uses OpenAI GPT-3.5-turbo model
- Processes email context and thread history
- Generates contextual, tone-appropriate replies
- Respects OpenAI's rate limits and usage policies

### Security
- API keys are stored securely in Chrome's sync storage
- No data is sent to external servers except OpenAI API
- All processing happens locally in the browser

## Troubleshooting

### Common Issues

**Extension not working in Gmail/Outlook**
- Ensure you're on the correct domain (mail.google.com, outlook.live.com, etc.)
- Refresh the page and try again
- Check if the extension is enabled in chrome://extensions/

**API Key not working**
- Verify your OpenAI API key is correct
- Check your OpenAI account has sufficient credits
- Ensure the API key has the necessary permissions

**AI Reply button not appearing**
- Refresh the email page
- Check browser console for errors
- Ensure the extension has the required permissions

**Generated replies are not relevant**
- Try selecting a different tone
- Check that the email content was properly extracted
- Review the email thread for context

### Error Messages

- **"Please configure your API key"**: Enter your OpenAI API key in the extension popup
- **"Could not extract email content"**: The extension couldn't find email content on the page
- **"API request failed"**: Check your internet connection and API key validity
- **"No active tab found"**: Ensure you're on a supported email client page

## Development

### Prerequisites
- Chrome browser
- OpenAI API key
- Basic knowledge of HTML, CSS, and JavaScript

### Local Development
1. Clone or download the extension files
2. Load as unpacked extension in Chrome
3. Make changes to the code
4. Reload the extension in chrome://extensions/
5. Test your changes

### Building Icons
1. Open `generate_icons.html` in a browser
2. Use browser dev tools to save the generated icons
3. Replace the placeholder files in the `icons/` folder

## Privacy & Data

### Data Collection
- **No personal data is collected** by the extension
- **Email content is only sent to OpenAI** for reply generation
- **API keys are stored locally** in Chrome's sync storage
- **No analytics or tracking** is implemented

### Data Usage
- Email content is processed by OpenAI's API
- Generated replies are inserted into your email client
- No data is stored or transmitted to other services

## Support

### Getting Help
- Check the troubleshooting section above
- Review the console for error messages
- Ensure all requirements are met

### Contributing
- Report bugs and issues
- Suggest new features
- Submit pull requests for improvements

## License

This project is open source and available under the MIT License.

## Changelog

### Version 1.0.0
- Initial release
- Support for Gmail and Outlook
- Four tone options
- OpenAI GPT-3.5-turbo integration
- Modern UI with dark mode support

---

**Note**: This extension requires an OpenAI API key and may incur costs based on your OpenAI usage. Please review OpenAI's pricing and terms of service. 