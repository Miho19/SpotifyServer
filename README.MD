# Server for Spotify-Party
Nodejs (v16) express server which handles the socket io calls from the frontend

## Installation
```bash
cd SpotifyServer
npm install
```

## Usage
```bash
npx nodemon
```


## Configuration
Within index.js
```javascript
const PORT = 4000;
const HOST = "localhost";
const CORSORIGIN = "http://localhost:3000";
```
This will be changed to use environment variables in production.

## Contributing
Open to view issues and pull requests.

