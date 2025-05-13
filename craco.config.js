module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          "assert": require.resolve("assert/"),
          "buffer": require.resolve("buffer/"),
          "process": require.resolve("process/browser"),
        }
      }
    }
  }
}; 