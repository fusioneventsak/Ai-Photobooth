import axios, { AxiosError } from 'axios';

// Create an axios instance with default config
const axiosInstance = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

// Add request interceptor for retry logic
axiosInstance.interceptors.request.use(
  config => {
    // Initialize retry count if not set
    if (!config.retryCount) {
      config.retryCount = 0;
    }
    return config;
  },
  error => {
    // Ensure error is serializable
    const serializedError = new Error(error.message);
    serializedError.stack = error.stack;
    return Promise.reject(serializedError);
  }
);

// Add response interceptor for retries and error handling
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    
    // Only retry on network errors or 5xx server errors
    const shouldRetry = (
      !error.response || 
      (error.response.status >= 500 && error.response.status <= 599)
    );

    // Maximum retry attempts
    const maxRetries = 3;

    if (shouldRetry && config.retryCount < maxRetries) {
      config.retryCount = config.retryCount + 1;

      // Exponential backoff delay
      const delay = Math.pow(2, config.retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      return axiosInstance(config);
    }

    // Create a serializable error object
    let serializedError: Error;

    // Format error message based on response
    if (error instanceof AxiosError && error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      let message = 'An error occurred while processing your request.';
      
      if (status === 401) {
        message = 'Authentication failed. Please check your API key.';
      } else if (status === 402) {
        message = 'Account credits depleted. Please check your account.';
      } else if (status === 429) {
        message = 'Too many requests. Please wait a moment and try again.';
      } else if (status >= 500) {
        message = 'Service is temporarily unavailable. Please try again later.';
      }
      
      serializedError = new Error(data?.message || message);
    } else if (error instanceof AxiosError && error.request) {
      serializedError = new Error('No response received from server. Please check your internet connection.');
    } else if (error instanceof Error) {
      serializedError = new Error(error.message);
    } else {
      serializedError = new Error('An unexpected error occurred');
    }
    
    return Promise.reject(serializedError);
  }
);

export default axiosInstance;