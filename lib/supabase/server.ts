14:28:07.094 Running build in Washington, D.C., USA (East) – iad1
14:28:07.094 Build machine configuration: 2 cores, 8 GB
14:28:07.226 Cloning github.com/NeilC100club/FirstLastSweep (Branch: main, Commit: 0c5b048)
14:28:07.227 Previous build caches not available.
14:28:07.590 Cloning completed: 363.000ms
14:28:07.925 Running "vercel build"
14:28:07.960 Vercel CLI 59.1.4
14:28:08.192 Installing dependencies...
14:28:23.001 npm warn deprecated next@14.2.5: This version has a security vulnerability. Please upgrade to a patched version. See https://nextjs.org/blog/security-update-2025-12-11 for more details.
14:28:23.090 
14:28:23.090 added 133 packages in 15s
14:28:23.090 
14:28:23.090 34 packages are looking for funding
14:28:23.091   run `npm fund` for details
14:28:23.149 Detected Next.js version: 14.2.5
14:28:23.154 Running "npm run build"
14:28:23.275 
14:28:23.275 > first-and-last-sweep@0.1.0 build
14:28:23.275 > next build
14:28:23.276 
14:28:23.883 Attention: Next.js now collects completely anonymous telemetry regarding usage.
14:28:23.884 This information is used to shape Next.js' roadmap and prioritize features.
14:28:23.884 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
14:28:23.884 https://nextjs.org/telemetry
14:28:23.885 
14:28:23.949   ▲ Next.js 14.2.5
14:28:23.950 
14:28:23.967    Creating an optimized production build ...
14:28:32.190 <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (107kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
14:28:32.201 <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (258kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
14:28:37.914  ✓ Compiled successfully
14:28:37.915    Linting and checking validity of types ...
14:28:41.328 Failed to compile.
14:28:41.328 
14:28:41.329 ./lib/supabase/server.ts:16:16
14:28:41.329 Type error: Parameter 'cookiesToSet' implicitly has an 'any' type.
14:28:41.329 
14:28:41.329   14 |           return cookieStore.getAll();
14:28:41.330   15 |         },
14:28:41.330 > 16 |         setAll(cookiesToSet) {
14:28:41.330      |                ^
14:28:41.330   17 |           try {
14:28:41.330   18 |             cookiesToSet.forEach(({ name, value, options }) =>
14:28:41.330   19 |               cookieStore.set(name, value, options)
14:28:41.411 Error: Command "npm run build" exited with 1
