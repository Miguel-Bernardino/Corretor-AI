<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally and deploy to Vercel.

View your app in AI Studio: https://ai.studio/apps/drive/1-ZqJDRveXf6WvaV5aXMEEza0tm0sVxPO

## Run Locally

**Prerequisites:** Node.js (v18 or higher)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Set the `GEMINI_API_KEY` in `.env` to your Gemini API key (get one at https://aistudio.google.com/app/apikey)

4. Run the app:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

## Deploy to Vercel

1. Push your code to a GitHub repository

2. Import your repository in [Vercel](https://vercel.com)

3. Add the environment variable:
   - Key: `GEMINI_API_KEY`
   - Value: Your Gemini API key

4. Click "Deploy"

Vercel will automatically detect the Vite configuration and build your app.
