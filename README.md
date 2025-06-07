# Social Media React App

A full-featured social media application built with React, featuring Facebook authentication, post creation, commenting, likes, and user profiles.

## 🚀 Features

- **Facebook Login Integration** - Secure authentication using Facebook OAuth
- **User Dashboard** - Home feed with posts from all users
- **Post Creation** - Create posts with text and media support
- **Interactions** - Like, comment, and share posts
- **User Profiles** - Detailed profile pages with editable information
- **Responsive Design** - Beautiful UI that works on all devices
- **Real-time Updates** - Dynamic content updates

## 🛠️ Technologies Used

- **React 19** - Frontend framework
- **React Router** - Navigation and routing
- **Bootstrap 5** - UI components and styling
- **FontAwesome** - Icons
- **react-facebook-login** - Facebook authentication
- **Axios** - HTTP client (ready for backend integration)

## 📦 Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd social-media-react
```

2. Install dependencies:
```bash
npm install
```

3. Set up Facebook App ID:
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Create a new app or use an existing one
   - Copy your App ID
   - Open `src/components/Login.js`
   - Replace `1234567890123456` with your actual Facebook App ID

4. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## 🔧 Facebook Login Setup

### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App"
3. Choose "Consumer" as the app type
4. Enter your app name and contact email
5. Create the app

### Step 2: Configure Facebook Login

1. In your Facebook app dashboard, click "Add Product"
2. Find "Facebook Login" and click "Set Up"
3. Choose "Web" as your platform
4. Enter your site URL: `http://localhost:3000` (for development)
5. Save changes

### Step 3: Configure Valid OAuth Redirect URIs

1. Go to Facebook Login > Settings
2. Add these Valid OAuth Redirect URIs:
   - `http://localhost:3000/`
   - `http://localhost:3000` (without trailing slash)
3. Save changes

### Step 4: Get Your App ID

1. Go to Settings > Basic
2. Copy your App ID
3. Replace the placeholder in `src/components/Login.js`:

```javascript
const FACEBOOK_APP_ID = 'YOUR_ACTUAL_APP_ID_HERE';
```

## 🎯 Usage

### Demo Login
You can use the demo login with any email and password to test the app without Facebook.

### Facebook Login
Click "Continue with Facebook" to login with your Facebook account (requires Facebook App ID setup).

### Features Overview

- **Dashboard**: View and create posts, interact with content
- **Profile**: Edit your profile information, view your posts
- **Navigation**: Use the top navigation bar to switch between pages

## 📱 App Structure

```
src/
├── components/
│   ├── Dashboard.js    # Main feed and post creation
│   ├── Login.js        # Authentication component
│   ├── Navbar.js       # Navigation bar
│   └── Profile.js      # User profile page
├── App.js              # Main app component with routing
├── App.css             # Custom styles
└── index.js            # App entry point
```

## 🔮 Future Enhancements

- **Backend Integration** - Connect to a real API
- **Real-time Chat** - Add messaging functionality
- **Push Notifications** - Notify users of new interactions
- **Media Upload** - Support for photo/video uploads
- **Friend System** - Add/remove friends functionality
- **Search** - Search for users and posts
- **Groups** - Create and join interest groups

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Netlify/Vercel

1. Build the project
2. Upload the `build` folder to your hosting service
3. Update Facebook app settings with your production URL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Troubleshooting

### Facebook Login Not Working
- Ensure your App ID is correct
- Check that your domain is added to Facebook app settings
- Verify OAuth redirect URIs are configured
- Make sure your Facebook app is not in development mode for production

### Styling Issues
- Clear browser cache
- Ensure Bootstrap CSS is loading
- Check for console errors

### Build Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Check for React version compatibility

## 📞 Support

If you encounter any issues or have questions, please create an issue in the GitHub repository.

---

Built with ❤️ using React and modern web technologies.
