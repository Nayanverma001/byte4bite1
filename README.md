# FoodCycle — Surplus Food Marketplace

Good food should never become waste. This app connects donors with buyers/NGOs.

## Run with local server (recommended)

1. **Install dependencies** (one time):
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open in browser**:  
   **http://localhost:3000**

Data is saved in:
- **Browser**: role, user, draft, saved items (per device)
- **Server**: foods, interests, notifications, reviews, messages → stored in **data.json** in the project folder

Restarting the server keeps your data. Refreshing the page loads data from the server.

## Run without server

Open **index.html** directly in your browser. Data is stored only in the browser (localStorage). Some features may behave differently when not using the server.

## Port

Default port is **3000**. To use another port:

```bash
PORT=8080 npm start
```

Then open http://localhost:8080
