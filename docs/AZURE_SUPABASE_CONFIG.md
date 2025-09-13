# Azure + Supabase Configuration Guide

## Prerequisites
- Azure Web App deployed
- Supabase project created

## Configuration Steps

### 1. Supabase Dashboard Configuration

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Configure the following:

   **Site URL:**
   ```
   https://finagent-web-pps457j4wjrc6.azurewebsites.net
   ```

   **Redirect URLs (add all):**
   ```
   https://finagent-web-pps457j4wjrc6.azurewebsites.net
   https://finagent-web-pps457j4wjrc6.azurewebsites.net/*
   https://finagent-web-pps457j4wjrc6.azurewebsites.net/auth/callback
   ```

### 2. Azure App Service Configuration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Web App resource
3. Go to **Settings** → **Configuration**
4. Under **Application settings**, add:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (from Supabase dashboard) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key (from Supabase dashboard) |
   | `NEXT_PUBLIC_API_URL` | Your backend API URL (if applicable) |

5. Click **Save** and restart the app

### 3. Getting Supabase Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy:
   - **Project URL** → Use for `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon/Public Key** → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Verify Configuration

After configuration:
1. Restart your Azure Web App
2. Test authentication at your deployed URL
3. Check browser console for any API errors

## Troubleshooting

### "Invalid API key" Error
- Verify environment variables are set correctly in Azure
- Ensure Supabase URL configuration includes your Azure domain
- Check that you're using the anon/public key, not the service key

### CORS Issues
- Add your Azure domain to Supabase's allowed origins
- Verify redirect URLs include trailing wildcards

### Authentication Redirects Not Working
- Ensure Site URL in Supabase matches your Azure domain exactly
- Add both with and without trailing slashes to redirect URLs