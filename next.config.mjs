/** @type {import('next').NextConfig} */
const nextConfig = {
  // `ignoreBuildErrors` was on, which meant a type error shipped to production
  // silently. `tsc --noEmit` is clean and runs in CI, so the build enforcing it
  // costs nothing and closes the gap between "tests pass" and "deploy is safe".
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    // Avatars come from whichever identity provider the user signed in with, and
    // portfolio links point at arbitrary hosts, so the allowlist is broad by
    // necessity. Optimisation is still worth having: these are the hosts that
    // actually appear, and anything else falls back to being served as-is.
    remotePatterns: [
      { protocol: 'https', hostname: '**.gravatar.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.kinde.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.convex.cloud' },
    ],
    // A profile picture is never rendered larger than this.
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  serverExternalPackages: ['@react-pdf/renderer'],
}

export default nextConfig
